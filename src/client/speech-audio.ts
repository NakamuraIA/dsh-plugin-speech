/**
 * Browser playback over the host's synthesis route.
 *
 * A reply is spoken in **segments** — a few hundred characters each, cut on
 * sentence ends — and every segment's audio is appended to the **same**
 * MediaSource buffer. Two properties come out of that one decision:
 *
 * - continuity: one buffer, one element, no seams between segments, so the
 *   voice never pauses at a boundary;
 * - resilience: the service drops a connection now and then with no error
 *   frame, and a dropped connection can only cost the segment it was carrying.
 *   One request for the whole reply meant one drop silenced the reading.
 *
 * Playback starts once a few seconds of audio are buffered, early enough to feel
 * immediate and late enough that it cannot catch the network and stall in the
 * middle of a sentence. The next segment is already being fetched while the
 * current one is appended, so the buffer fills ahead of the voice.
 *
 * When MediaSource is unusable the reply is still spoken, one segment per blob.
 */

import { splitSentences } from './sentences.ts'

/** Route the host exposes for synthesis. */
const SPEAK_ROUTE = '/speech/speak'

/** Container the host answers with, and the one MediaSource must accept. */
const AUDIO_MIME = 'audio/mpeg'

/**
 * Longest text one segment carries. Small enough that a single dropped
 * connection loses little, large enough that a reply does not open dozens of
 * sockets.
 */
const SEGMENT_CHARS = 400

/** Attempts one segment gets before its failure ends the reading. */
const SEGMENT_ATTEMPTS = 2

/**
 * Seconds of audio to buffer before playback starts. Below this, a reply that
 * arrives slower than it is spoken would run dry mid-sentence; above it, the
 * wait starts to feel like the browser is thinking.
 */
const PREBUFFER_SECONDS = 4

/**
 * Audio seconds the service must be delivering per wall-clock second before
 * playback is allowed to start on the pre-buffer alone. Below this the buffer
 * would drain mid-sentence, so a reply is buffered whole instead — a pause
 * between sentences is worse than waiting a little longer for the first one.
 */
const MIN_DELIVERY_RATE = 1.1

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
 * @returns the host's message, or the status line.
 */
async function failureOf(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string') return body.error
  } catch (_notJson) {
    // A proxy or a truncated stream can answer with something that is not the
    // route's JSON; the status line still says what happened.
  }
  return `${response.status} ${response.statusText}`
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
        // MediaSource stitch every segment into one continuous timeline;
        // segments mode would reject the first append.
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
  /** Aborts the response bodies a stop would otherwise keep reading forever. */
  private abort: AbortController | undefined

  /**
   * Speak one text, segment by segment, into one continuous buffer.
   * @param text - projected spoken text.
   * @param overrides - preview overrides, or undefined to use the durable settings.
   * @param onEnded - called once the last audio has played out.
   */
  async speak(text: string, overrides: SpeechOverrides | undefined, onEnded: () => void): Promise<void> {
    const segments = splitSentences(text, SEGMENT_CHARS)
    if (segments.length === 0) return
    const generation = ++this.generation
    this.dropPlayback()
    const abort = new AbortController()
    this.abort = abort
    const played = canStream()
      ? await this.streamSegments(segments, overrides, generation, abort.signal)
      : await this.playSegmentBySegment(segments, overrides, generation, abort.signal)
    // Both paths answer false when a later stop or speak superseded them, so a
    // true answer is the only thing that reports an end.
    this.report(played, onEnded)
  }

  /**
   * Report an end for a run that played out, and stay silent for one that a
   * later stop or speak superseded.
   * @param played - whether the run reached its last audio frame.
   * @param onEnded - the caller's end callback.
   */
  private report(played: boolean, onEnded: () => void): void {
    if (played) onEnded()
  }

  /** Stop playback and abandon whatever is still arriving. */
  stop(): void {
    this.generation += 1
    this.dropPlayback()
  }

  /** Stop playback and release the last object URL. */
  dispose(): void {
    this.stop()
  }

  /**
   * Append every segment to one buffer and play the result as one reading.
   * @param segments - sentence-sized spans, in order.
   * @param overrides - preview overrides, when any.
   * @param generation - token this run belongs to.
   * @param signal - aborts the replies in flight.
   * @returns whether playback ran to the end under the same generation.
   */
  private async streamSegments(
    segments: readonly string[],
    overrides: SpeechOverrides | undefined,
    generation: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    const media = new MediaSource()
    const url = URL.createObjectURL(media)
    const element = new Audio(url)
    this.playing = element
    this.objectUrl = url
    let started = false
    /** Start the element once; the buffer is already ahead of it by then. */
    const play = async (): Promise<boolean> => {
      if (started) return true
      if (!await this.startPlayback(element, generation)) {
        this.releaseChunk(url)
        return false
      }
      started = true
      return true
    }
    try {
      let buffer: SourceBuffer
      try {
        buffer = await openBuffer(media)
      } catch (error) {
        // The engine accepted the type and refused the buffer. Nothing has
        // played, so the reply is still worth speaking segment by segment.
        this.releaseChunk(url)
        void error
        return await this.playSegmentBySegment(segments, overrides, generation, signal)
      }
      // Start the element as soon as the buffer is ahead of the voice — but only
      // when the service is actually outrunning it. A service delivering audio
      // slower than speech fills the buffer slower than playback drains it, and
      // starting there produces exactly the pauses this plugin exists to avoid;
      // such a reply is buffered whole and played once, after the loop.
      const beganAt = Date.now()
      const gate = async (): Promise<boolean> => {
        if (started) return true
        const buffered = bufferedSeconds(buffer)
        if (buffered < PREBUFFER_SECONDS) return true
        const elapsed = (Date.now() - beganAt) / 1000
        const rate = elapsed <= 0 ? Number.POSITIVE_INFINITY : buffered / elapsed
        if (rate < MIN_DELIVERY_RATE) return true
        return await play()
      }
      // The next segment is requested while the current one is appended, which
      // is what keeps the buffer filling ahead of the voice.
      let ahead: Promise<Response | undefined> = this.fetchSegment(segments[0] as string, overrides, signal)
      for (const [index, segment] of segments.entries()) {
        const response = await ahead
        const next = segments[index + 1]
        ahead = next === undefined
          ? Promise.resolve(undefined)
          : this.fetchSegment(next, overrides, signal)
        const bytes = await this.appendSegment(buffer, segment, response, overrides, signal, generation, gate)
        if (generation !== this.generation) {
          this.releaseChunk(url)
          return false
        }
        if (bytes > 0 && !started) {
          if (!await gate()) return false
        }
      }
      // A reply shorter than the pre-buffer, or one whose segments all arrived
      // at once: play what is buffered.
      if (!await play()) return false
      if (media.readyState === 'open') media.endOfStream()
      await this.playedOut(element, generation)
      this.releaseChunk(url)
      return generation === this.generation
    } catch (error) {
      this.releaseChunk(url)
      // A stop aborts the bodies, which arrives here as a failed read.
      if (generation !== this.generation) return false
      // Whatever is already buffered still deserves to be heard: a failure this
      // late ends the reading, it does not silence what came before it.
      if (started) {
        if (media.readyState === 'open') media.endOfStream()
        await this.playedOut(element, generation)
        return generation === this.generation
      }
      throw error
    }
  }

  /**
   * Append one segment's audio, retrying a segment the service cut before it
   * produced anything.
   * @param buffer - the source buffer every segment shares.
   * @param text - the segment to speak.
   * @param response - its first reply.
   * @param overrides - preview overrides, when any.
   * @param signal - aborts the replies in flight.
   * @param generation - token this run belongs to.
   * @param gate - asked after every append whether playback may start yet.
   * @returns how many audio bytes this segment contributed.
   */
  private async appendSegment(
    buffer: SourceBuffer,
    text: string,
    response: Response | undefined,
    overrides: SpeechOverrides | undefined,
    signal: AbortSignal,
    generation: number,
    gate: () => Promise<boolean>,
  ): Promise<number> {
    let reply = response
    let bytes = 0
    for (let attempt = 0; attempt < SEGMENT_ATTEMPTS; attempt += 1) {
      if (reply === undefined) {
        reply = await this.fetchSegment(text, overrides, signal)
      }
      bytes = await this.appendBody(buffer, reply, generation, gate)
      if (bytes > 0 || generation !== this.generation) return bytes
      // A cut before any audio: the next attempt opens its own connection.
      reply = undefined
    }
    return bytes
  }

  /**
   * Read one reply's body into the buffer.
   * @param buffer - the source buffer.
   * @param response - the reply carrying this segment's audio.
   * @param generation - token this run belongs to.
   * @param gate - asked after every append whether playback may start yet.
   * @returns how many audio bytes reached the buffer.
   */
  private async appendBody(
    buffer: SourceBuffer,
    response: Response,
    generation: number,
    gate: () => Promise<boolean>,
  ): Promise<number> {
    const body = response.body
    if (body === null) return 0
    const reader = body.getReader()
    let bytes = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (generation !== this.generation) {
          await reader.cancel()
          return bytes
        }
        if (value !== undefined && value.length > 0) {
          await appendChunk(buffer, value)
          bytes += value.length
          // The pre-buffer is judged per chunk: a segment's body stays open for
          // as long as the service keeps sending, so waiting for it to end would
          // hold playback back long after enough audio is in hand.
          if (!await gate()) {
            await reader.cancel()
            return bytes
          }
        }
        if (done) break
      }
    } catch (error) {
      if (generation !== this.generation) return bytes
      // The service cut this connection mid-segment. What arrived is already
      // buffered and plays; the reading continues with the next segment.
      void error
    }
    return bytes
  }

  /**
   * Request one segment's audio.
   * @param text - the segment to speak.
   * @param overrides - preview overrides, when any.
   * @param signal - aborts the reply in flight.
   * @returns the reply, its body still unread.
   */
  private async fetchSegment(
    text: string,
    overrides: SpeechOverrides | undefined,
    signal: AbortSignal,
  ): Promise<Response> {
    const response = await fetch(SPEAK_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, ...overrides }),
      signal,
    })
    if (!response.ok) throw new Error(await failureOf(response))
    return response
  }

  /**
   * Fallback for a browser without MediaSource: one segment per blob, played in
   * order. It cannot overlap segments, so a boundary is audible here.
   * @param segments - sentence-sized spans, in order.
   * @param overrides - preview overrides, when any.
   * @param generation - token this run belongs to.
   * @param signal - aborts the replies in flight.
   * @returns whether every segment played out under the same generation.
   */
  private async playSegmentBySegment(
    segments: readonly string[],
    overrides: SpeechOverrides | undefined,
    generation: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    let pending: Promise<Blob> | undefined
    for (const [index, segment] of segments.entries()) {
      pending ??= this.fetchAudio(segment, overrides, signal)
      const audio = await pending
      pending = undefined
      if (generation !== this.generation) return false
      const next = segments[index + 1]
      if (next !== undefined) {
        pending = this.fetchAudio(next, overrides, signal)
        // A stop cancels the lookahead; the loop reports that through the
        // generation, so the rejection must not surface as unhandled.
        pending.catch(() => {})
      }
      if (!await this.playBlob(audio, generation)) return false
    }
    return true
  }

  /**
   * Fetch the audio of one segment as a whole file.
   * @param text - segment to speak.
   * @param overrides - preview overrides, when any.
   * @param signal - aborts the reply in flight.
   * @returns the encoded audio the host answered with.
   */
  private async fetchAudio(text: string, overrides: SpeechOverrides | undefined, signal: AbortSignal): Promise<Blob> {
    const response = await fetch(SPEAK_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, ...overrides }),
      signal,
    })
    if (!response.ok) throw new Error(await failureOf(response))
    return await response.blob()
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

  private dropPlayback(): void {
    // Aborting first ends the body reads: without it a stopped reply kept a
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
