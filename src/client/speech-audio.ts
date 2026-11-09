/**
 * Browser playback over the host's synthesis route.
 *
 * One click sends the whole reply in **one request** and the host streams the
 * audio back while the service is still working. The browser appends every chunk
 * to a single MediaSource buffer and waits for a **6-second** head before it
 * starts the voice; a reply shorter than that finishes arriving first, so a
 * short one never waits at all.
 *
 * From there the element plays out of the buffer while the rest arrives behind
 * it. A guard watches how far ahead the buffer is: under 2 seconds of lead it
 * holds the voice, above 6 it lets go — the difference between a stall the
 * listener hears as a dropped word and one they never notice. The guard lets go
 * for good once the body is drained, because at the end of a reply the lead is
 * zero by definition and holding there would clip the final words.
 *
 * Holding the voice is not stopping it: `pause()` leaves the request and the
 * buffer alone, so synthesis carries on behind the hold and resuming continues
 * on the same word.
 *
 * A finished reply is kept in memory and replayed as one file, which is what
 * makes a second listen instant and lets it seek. When MediaSource is unusable —
 * or the engine accepts the type and then refuses the buffer — the reply is
 * played as one whole file from the start.
 */

import { SpeechError } from '../speech-errors.ts'

/** Route the host exposes for synthesis. */
const SPEAK_ROUTE = '/speech/speak'

/** Container the host answers with, and the one MediaSource must accept. */
const AUDIO_MIME = 'audio/mpeg'

/**
 * Seconds of audio to hold before starting. A head this size is what keeps the
 * voice continuous: the service delivers faster than realtime once warm, and the
 * margin absorbs the jitter that used to drain a smaller head and stall mid-word.
 * It is not a wait in practice — a reply shorter than this finishes arriving
 * first, so playback starts the moment the body ends.
 */
const PREBUFFER_SECONDS = 6

/**
 * While playing, hold the voice when the buffer falls below this many seconds
 * ahead of the playhead, and let it go again above {@link HIGH_WATER_SECONDS}.
 *
 * This is the difference between a stall the listener hears as a dropped word
 * and one they never notice: the element waits on purpose while the buffer
 * refills, instead of running dry and restarting when a chunk lands.
 */
const LOW_WATER_SECONDS = 2

/** Buffer lead that lifts the stall hold installed at {@link LOW_WATER_SECONDS}. */
const HIGH_WATER_SECONDS = 6

/** How often the playhead's buffer lead is checked while a reply streams. */
const GUARD_INTERVAL_MS = 250

/** Replies kept for replay without asking the service again. */
const CACHE_ENTRIES = 8

/** Total encoded audio the replay cache may hold. */
const CACHE_BYTES = 64 * 1024 * 1024

/** Per-request overrides the settings screen uses to preview an unsaved voice. */
export interface SpeechOverrides {
  /** Provider to call instead of the durable selection. */
  provider?: string
  /** Voice to speak with instead of the durable one. */
  voice?: string
  /** Tuning values that override the durable block for this call only. */
  tuning?: Readonly<Record<string, unknown>>
}

/**
 * Read the error a failed synthesis answered with.
 * @param response - the failed response.
 * @returns the message to report, plus the class of failure when the host named one.
 */
async function failureOf(response: Response): Promise<SpeechError> {
  try {
    const body = await response.json() as { error?: unknown; code?: unknown }
    if (typeof body.error === 'string') {
      return new SpeechError(body.error, body.code === 'endpoint' ? 'endpoint' : undefined)
    }
  } catch (_notJson) {
    // A proxy or a truncated stream can answer with something that is not the
    // route's JSON; the status line still says what happened.
  }
  return new SpeechError(`${response.status} ${response.statusText}`, undefined)
}

/**
 * Whether a caught value is the interruption a pause causes. Pausing an element
 * whose `play()` has not settled yet rejects that promise, and the platform
 * labels the rejection an abort; it reports a stop, not a fault.
 * @param error - the caught value.
 * @returns true when the platform called it an abort.
 */
function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

/**
 * Whether this browser can play encoded audio through MediaSource.
 * @returns true when the container the host sends is one MediaSource accepts.
 */
function canStream(): boolean {
  return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(AUDIO_MIME)
}

/**
 * Resolve once a buffer is ready to accept appends.
 * @param media - the MediaSource the audio element plays from.
 * @returns the source buffer, in sequence mode.
 */
function openBuffer(media: MediaSource): Promise<SourceBuffer> {
  return new Promise((resolve, reject) => {
    media.addEventListener('sourceopen', () => {
      try {
        const buffer = media.addSourceBuffer(AUDIO_MIME)
        // Raw MP3 frames carry no timestamps, so sequence mode is what lets
        // MediaSource stitch them; segments mode would reject the first append.
        buffer.mode = 'sequence'
        resolve(buffer)
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }, { once: true })
  })
}

/**
 * Append one chunk and wait for the buffer to accept it.
 * @param buffer - the source buffer.
 * @param chunk - encoded audio bytes.
 */
async function appendChunk(buffer: SourceBuffer, chunk: Uint8Array): Promise<void> {
  const settled = new Promise<void>((resolve) => {
    buffer.addEventListener('updateend', () => { resolve() }, { once: true })
  })
  // The copy re-anchors the bytes on a plain ArrayBuffer: the reader can hand
  // back a view whose buffer is shared or detached, which SourceBuffer refuses.
  buffer.appendBuffer(new Uint8Array(chunk))
  await settled
}

/**
 * How much audio the buffer holds, in seconds.
 * @param buffer - the source buffer.
 * @returns the end of the last buffered range, or zero when nothing is buffered.
 */
function bufferedSeconds(buffer: SourceBuffer): number {
  const ranges = buffer.buffered
  if (ranges === undefined || ranges.length === 0) return 0
  return ranges.end(ranges.length - 1)
}

/** Owns the audio currently playing and the requests behind it. */
export class SpeechAudio {
  /** Cancellation token: every stop or new request invalidates what is running. */
  private generation = 0
  private playing: HTMLAudioElement | undefined
  private objectUrl: string | undefined
  /** Aborts the response body a stop would otherwise keep reading forever. */
  private abort: AbortController | undefined
  /**
   * Reply audio kept for replay, oldest first. In memory on purpose: it costs no
   * disk, and it dies with the page, which is the lifetime a generated reply has.
   */
  private readonly cache = new Map<string, Blob>()
  /** Total bytes {@link cache} holds, so the cap can be enforced without summing. */
  private cachedBytes = 0
  /** Whether the READER paused; the guard must not lift that pause. */
  private readerPaused = false
  /** Whether the guard paused the element to let the buffer refill. */
  private stallPaused = false
  /** Set while a synthesis reads its body, so the guard knows more is coming. */
  private feeding = false

  /**
   * Speak one text: one request for the whole reply, played as it arrives.
   * @param text - projected spoken text.
   * @param overrides - preview overrides, or undefined to use the durable settings.
   * @param onEnded - called once the last audio has played out.
   * @param cacheKey - reply identity for replay; empty disables the cache.
   */
  async speak(
    text: string,
    overrides: SpeechOverrides | undefined,
    onEnded: () => void,
    cacheKey = '',
  ): Promise<void> {
    if (text.trim() === '') return
    const generation = ++this.generation
    this.dropPlayback()
    this.readerPaused = false
    this.stallPaused = false
    const replay = cacheKey === '' ? undefined : this.cache.get(cacheKey)
    if (replay !== undefined) {
      // A replayed reply is one finished file: no stream, no jitter, and the
      // platform's own seek applies. The service is not asked again.
      const played = await this.playBlob(replay, generation)
      if (played) onEnded()
      return
    }
    const abort = new AbortController()
    this.abort = abort
    const played = await this.playReply(text, overrides, generation, abort.signal, cacheKey)
    // A run superseded by a later stop or speak answers false, so a true answer
    // is the only thing that reports an end.
    if (played) onEnded()
  }

  /**
   * Pause the sound without touching the request behind it. Synthesis and
   * buffering continue, so the reply is further along when the reader comes back.
   */
  pause(): void {
    this.readerPaused = true
    this.playing?.pause()
  }

  /** Resume a playback the reader paused, keeping its position. */
  resume(): void {
    this.readerPaused = false
    // A hold the guard installed is lifted by the guard itself, once the buffer
    // is far enough ahead; resuming here would restart the very gap it prevents.
    if (this.stallPaused) return
    const element = this.playing
    if (element === undefined) return
    void element.play().catch(() => {})
  }

  /** Stop playback and abandon whatever is still arriving. */
  stop(): void {
    this.readerPaused = false
    this.stallPaused = false
    this.generation += 1
    this.dropPlayback()
  }

  /** Stop playback, release the last object URL, and drop every cached reply. */
  dispose(): void {
    this.stop()
    this.cache.clear()
    this.cachedBytes = 0
  }

  /**
   * Fetch one reply and play it, streaming it when the browser can.
   * @param text - the whole projected text.
   * @param overrides - preview overrides, when any.
   * @param generation - token this request belongs to.
   * @param signal - aborts the reply in flight.
   * @param cacheKey - reply identity to remember the audio under; empty skips it.
   * @returns whether playback ran to the end under the same generation.
   */
  private async playReply(
    text: string,
    overrides: SpeechOverrides | undefined,
    generation: number,
    signal: AbortSignal,
    cacheKey: string,
  ): Promise<boolean> {
    let response: Response
    try {
      response = await fetch(SPEAK_ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, ...overrides }),
        signal,
      })
    } catch (error) {
      // A stop aborts the request; that is the cancellation it asked for.
      if (generation !== this.generation) return false
      throw error
    }
    if (!response.ok) throw await failureOf(response)
    const body = response.body
    if (body === null || !canStream()) {
      const audio = await response.blob()
      if (generation !== this.generation) return false
      if (cacheKey !== '') this.remember(cacheKey, [new Uint8Array(await audio.arrayBuffer())])
      return await this.playBlob(audio, generation)
    }
    return await this.streamReply(body, generation, cacheKey)
  }

  /**
   * Append one reply's frames and start the element once the head is in.
   * @param body - the response body carrying encoded audio.
   * @param generation - token this request belongs to.
   * @param cacheKey - reply identity to remember the audio under; empty skips it.
   * @returns whether playback ran to the end under the same generation.
   */
  private async streamReply(
    body: ReadableStream<Uint8Array>,
    generation: number,
    cacheKey: string,
  ): Promise<boolean> {
    const media = new MediaSource()
    const url = URL.createObjectURL(media)
    const element = new Audio(url)
    this.playing = element
    this.objectUrl = url
    let started = false
    const play = async (): Promise<boolean> => {
      if (started) return true
      if (!await this.startPlayback(element, generation)) {
        this.releaseChunk(url)
        return false
      }
      started = true
      return true
    }
    const reader = body.getReader()
    // Everything read before playback starts, so a buffer that refuses the frames
    // still leaves a complete file to play.
    const held: Uint8Array[] = []
    // Every chunk of the reply, kept so the audio can be replayed without asking
    // the service again. Dropped when the cache key is empty.
    const whole: Uint8Array[] = []
    const keep = cacheKey !== ''
    let complete = false
    const guard = (buffer: SourceBuffer): ReturnType<typeof setInterval> => setInterval(() => {
      if (generation !== this.generation || !started || element.ended) return
      // The reader's own pause outranks the guard: it must stay paused.
      if (this.readerPaused) return
      const ahead = bufferedSeconds(buffer) - element.currentTime
      if (!this.stallPaused && ahead < LOW_WATER_SECONDS && this.feeding) {
        this.stallPaused = true
        element.pause()
        return
      }
      if (this.stallPaused && (ahead >= HIGH_WATER_SECONDS || !this.feeding)) {
        this.stallPaused = false
        void element.play().catch(() => {})
      }
    }, GUARD_INTERVAL_MS)
    this.feeding = true
    let ticker: ReturnType<typeof setInterval> | undefined
    try {
      const buffer = await openBuffer(media)
      ticker = guard(buffer)
      for (;;) {
        const { done, value } = await reader.read()
        if (generation !== this.generation) {
          await reader.cancel()
          this.releaseChunk(url)
          return false
        }
        if (value !== undefined && value.length > 0) {
          if (!started) held.push(value)
          if (keep) whole.push(value)
          await appendChunk(buffer, value)
          // The head is judged per chunk: the body stays open while the service
          // keeps sending, and waiting for it to end would delay speech by the
          // length of the whole reply.
          if (!started && bufferedSeconds(buffer) >= PREBUFFER_SECONDS) {
            if (!await play()) return false
            held.length = 0
          }
        }
        if (done) break
      }
      // The body is drained: no chunk can arrive to widen the lead again, so the
      // guard must let go before playback finishes. Near the end the lead reaches
      // zero by definition, and a hold there clips the last words and strands the
      // element short of its 'ended' — which is a stuck button, not a stall.
      this.feeding = false
      complete = true
      if (!await play()) return false
      if (media.readyState === 'open') media.endOfStream()
      await this.playedOut(element, generation)
      this.releaseChunk(url)
      return generation === this.generation
    } catch (error) {
      this.releaseChunk(url)
      if (generation !== this.generation) return false
      // A body that dies after the head went in still leaves buffered audio; the
      // element plays what it has and ends, which beats throwing it away.
      if (started) {
        if (media.readyState === 'open') media.endOfStream()
        await this.playedOut(element, generation)
        return generation === this.generation
      }
      // Nothing played: the engine refused the buffer itself. Play the reply as
      // one whole file from the bytes in hand plus the rest of the body.
      void error
      return await this.playCollected(reader, held, generation, cacheKey)
    } finally {
      this.feeding = false
      this.stallPaused = false
      if (ticker !== undefined) clearInterval(ticker)
      // A reply only enters the cache once its body really ended: a truncated one
      // would replay as the same truncation.
      if (complete && keep) this.remember(cacheKey, whole)
    }
  }

  /**
   * Drain what is left of a reply and play everything as one file.
   * @param reader - the response reader, partly consumed.
   * @param held - the chunks already in hand.
   * @param generation - token this request belongs to.
   * @param cacheKey - reply identity to remember the audio under; empty skips it.
   * @returns whether playback ran to the end under the same generation.
   */
  private async playCollected(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    held: readonly Uint8Array[],
    generation: number,
    cacheKey: string,
  ): Promise<boolean> {
    const chunks = [...held]
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (value !== undefined && value.length > 0) chunks.push(value)
        if (done) break
      }
    } catch (_bodyFailed) {
      // The body died too; the chunks in hand are what this reply will be.
    }
    if (generation !== this.generation) return false
    if (chunks.length === 0) return false
    if (cacheKey !== '') this.remember(cacheKey, chunks)
    return await this.playBlob(new Blob(chunks as BlobPart[], { type: AUDIO_MIME }), generation)
  }

  /**
   * Play one buffered file and wait for it to finish.
   * @param audio - encoded audio bytes.
   * @param generation - token this run belongs to.
   * @returns whether the file played out under the same generation.
   */
  private async playBlob(audio: Blob, generation: number): Promise<boolean> {
    const url = URL.createObjectURL(audio)
    const element = new Audio(url)
    this.playing = element
    this.objectUrl = url
    if (!await this.startPlayback(element, generation)) {
      this.releaseChunk(url)
      return false
    }
    await this.playedOut(element, generation)
    this.releaseChunk(url)
    return generation === this.generation
  }

  /**
   * Start one element, reading a pause as the cancellation it is.
   * @param element - element to start.
   * @param generation - token the run belongs to.
   * @returns whether playback started; false means a stop got there first.
   */
  private async startPlayback(element: HTMLAudioElement, generation: number): Promise<boolean> {
    try {
      await element.play()
      return true
    } catch (error) {
      // A stop, or a newer request, pauses the element while play() is still
      // settling; the platform rejects that play() with an abort. Impatience on
      // the play button is not a service failure, and saying so painted a red
      // message over a reply the user had simply paused.
      if (generation !== this.generation || isAbort(error)) return false
      // Chromium's autoplay refusal is a different error, and that one is worth
      // reporting.
      throw error
    }
  }

  /**
   * Resolve when one element stops producing sound, whether it ended, failed, or
   * was stopped by a newer request.
   * @param element - the audio element.
   * @param generation - token the run belongs to.
   */
  private async playedOut(element: HTMLAudioElement, generation: number): Promise<void> {
    if (element.ended) return
    // A stop that landed while playback was starting is already the answer; the
    // pause it caused has come and gone before this could listen for it.
    if (generation !== this.generation) return
    await new Promise<void>((resolve) => {
      const settle = (): void => { resolve() }
      element.addEventListener('ended', settle, { once: true })
      element.addEventListener('error', settle, { once: true })
      // A stop pauses the element instead of ending it. Without this branch the
      // run would wait for an 'ended' that never comes, and every reader that
      // stopped playback would leave a promise hanging behind it.
      element.addEventListener('pause', () => {
        if (generation !== this.generation) settle()
      }, { once: true })
    })
  }

  /**
   * Keep one finished reply for replay, evicting the oldest entries first.
   * @param key - reply identity.
   * @param chunks - the reply's encoded audio.
   */
  private remember(key: string, chunks: readonly Uint8Array[]): void {
    if (chunks.length === 0) return
    const audio = new Blob([...chunks] as BlobPart[], { type: AUDIO_MIME })
    if (audio.size > CACHE_BYTES) return
    const previous = this.cache.get(key)
    if (previous !== undefined) {
      this.cachedBytes -= previous.size
      this.cache.delete(key)
    }
    this.cache.set(key, audio)
    this.cachedBytes += audio.size
    // Map iteration is insertion order, so the first key is the oldest reply.
    while (this.cache.size > CACHE_ENTRIES || this.cachedBytes > CACHE_BYTES) {
      const oldest = this.cache.keys().next()
      if (oldest.done === true) break
      const evicted = this.cache.get(oldest.value)
      if (evicted !== undefined) this.cachedBytes -= evicted.size
      this.cache.delete(oldest.value)
    }
  }

  private dropPlayback(): void {
    // Aborting first ends the body read: without it a stopped reply kept a
    // reader waiting on chunks that no longer mattered.
    this.abort?.abort()
    this.abort = undefined
    const element = this.playing
    const url = this.objectUrl
    this.playing = undefined
    this.objectUrl = undefined
    element?.pause()
    if (url !== undefined) URL.revokeObjectURL(url)
  }

  private releaseChunk(url: string): void {
    if (this.objectUrl !== url) return
    this.playing = undefined
    this.objectUrl = undefined
    URL.revokeObjectURL(url)
  }
}
