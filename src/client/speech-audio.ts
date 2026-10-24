/**
 * Browser playback over the host's synthesis route.
 *
 * The whole reply travels in one request and is played as one audio file: the
 * body is read to the end, handed to a single element as a blob, and played
 * from start to finish. One file has no seams, so a reading is continuous by
 * construction — the MediaSource path this replaced could not promise that on
 * every engine, and a browser that silently refused to start it left the reply
 * silent.
 *
 * Waiting for the whole body costs less than it sounds: the service synthesizes
 * faster than a voice speaks, so a twenty-second reading arrives in about a
 * second. Only a reply larger than one request may carry is spoken sentence by
 * sentence, because no single request could hold it.
 */

import { splitRequests, splitSentences } from './sentences.ts'

/** Route the host exposes for synthesis. */
const SPEAK_ROUTE = '/speech/speak'

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
 * Read the request bound a refusal named.
 * @param message - the host's error text.
 * @returns the character limit, or undefined when the refusal was about something else.
 */
function limitOf(message: string): number | undefined {
  const match = /1\.\.(\d+) characters/.exec(message)
  if (match === null) return undefined
  // A matched group is always a string here; the cast states the regex's own
  // guarantee instead of adding a branch no input can reach.
  const limit = Number.parseInt(match[1] as string, 10)
  return Number.isFinite(limit) && limit > 0 ? limit : undefined
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

/** Owns the audio currently playing and the requests behind it. */
export class SpeechAudio {
  /** Cancellation token: every stop or new request invalidates what is running. */
  private generation = 0
  private playing: HTMLAudioElement | undefined
  private objectUrl: string | undefined

  /**
   * Speak one text. The whole reply travels in one request and plays as one
   * file; a reply too large for that is spoken sentence by sentence.
   * @param text - projected spoken text.
   * @param overrides - preview overrides, or undefined to use the durable settings.
   * @param onEnded - called once the last audio has played out.
   */
  async speak(text: string, overrides: SpeechOverrides | undefined, onEnded: () => void): Promise<void> {
    const requests = splitRequests(text)
    if (requests.length === 0) return
    const generation = ++this.generation
    this.dropPlayback()
    const played = requests.length === 1
      ? await this.playWhole(requests[0] as string, overrides, generation)
      : await this.playSentenceBySentence(splitSentences(text), overrides, generation)
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
   * Fetch one reply and play it as a single file.
   * @param text - the whole projected text.
   * @param overrides - preview overrides, when any.
   * @param generation - token this request belongs to.
   * @returns whether playback ran to the end under the same generation.
   */
  private async playWhole(
    text: string,
    overrides: SpeechOverrides | undefined,
    generation: number,
  ): Promise<boolean> {
    const response = await fetch(SPEAK_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, ...overrides }),
    })
    if (!response.ok) {
      const message = await failureOf(response)
      const limit = limitOf(message)
      if (limit === undefined) throw new Error(message)
      // The host enforces a smaller request than this build sends — an older
      // server, or a tighter deployment bound. Speak in pieces it accepts
      // instead of failing the whole reply.
      return await this.playSentenceBySentence(splitSentences(text, limit), overrides, generation)
    }
    const audio = await response.blob()
    if (generation !== this.generation) return false
    return await this.playBlob(audio, generation)
  }

  /**
   * Fallback path for a reply one request cannot carry: one request per
   * sentence, each played as a blob.
   * @param sentences - sentence-sized spans.
   * @param overrides - preview overrides, when any.
   * @param generation - token this run belongs to.
   * @returns whether every span played out under the same generation.
   */
  private async playSentenceBySentence(
    sentences: readonly string[],
    overrides: SpeechOverrides | undefined,
    generation: number,
  ): Promise<boolean> {
    let pending: Promise<Blob> | undefined
    for (const [index, sentence] of sentences.entries()) {
      pending ??= this.fetchAudio(sentence, overrides)
      const audio = await pending
      pending = undefined
      if (generation !== this.generation) return false
      const next = sentences[index + 1]
      if (next !== undefined) {
        pending = this.fetchAudio(next, overrides)
        // A stop cancels the lookahead; the loop reports that through the
        // generation, so the rejection must not surface as unhandled.
        pending.catch(() => {})
      }
      if (!await this.playBlob(audio, generation)) return false
    }
    return true
  }

  /**
   * Fetch the audio of one span.
   * @param text - span to speak.
   * @param overrides - preview overrides, when any.
   * @returns the encoded audio the host answered with.
   */
  private async fetchAudio(text: string, overrides: SpeechOverrides | undefined): Promise<Blob> {
    const response = await fetch(SPEAK_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, ...overrides }),
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
   * Resolve when one element stops producing sound, whether it ended, failed, or
   * was stopped by a newer request.
   * @param element - the audio element.
   * @param generation - token the run belongs to.
   */
  private async playedOut(element: HTMLAudioElement, generation: number): Promise<void> {
    if (element.ended) return
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

  private dropPlayback(): void {
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
