/**
 * Read-aloud orchestration: owns the folded assistant prose, drives playback,
 * and publishes the state every speaker action renders from. One controller per
 * plugin, so a second request stops whatever the first started, across sessions
 * included. The projection onto spoken text runs per request, so a preference
 * change applies to the next reading without re-folding the log.
 */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { SpeechError } from '../speech-errors.ts'
import { speechText, type SpeechTextOptions } from '../speech-text.ts'
import type { SpeechAudio, SpeechOverrides } from './speech-audio.ts'
import type { SpeechState } from './speech-state.ts'

/**
 * Read the detail behind a caught failure.
 * @param error - the thrown value.
 * @returns its message.
 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Owns read-aloud state transitions over one playback engine. */
export class SpeechController {
  /**
   * @param state - the shared state source every action reads.
   * @param audio - playback over the host's synthesis route.
   * @param report - receives failure detail (the surface shows the code's copy).
   */
  constructor(
    private readonly state: SnapshotStore<SpeechState>,
    private readonly audio: SpeechAudio,
    private readonly report: (message: string) => void,
  ) {}

  /**
   * Fold one finalized assistant message's prose.
   * @param messageId - the message the prose belongs to.
   * @param source - the message's raw text blocks, before projection.
   */
  record(messageId: string, source: string): void {
    const snapshot = this.state.getSnapshot()
    if (snapshot.sources.get(messageId) === source) return
    const sources = new Map(snapshot.sources)
    sources.set(messageId, source)
    this.state.set({ ...snapshot, sources })
  }

  /**
   * Speak one message, replacing whatever is playing. A request superseded by a
   * newer one starts nothing.
   * @param messageId - message whose audio is requested.
   * @param options - projection options in effect for this reading.
   * @param overrides - preview overrides when the settings screen asks for them.
   */
  async speak(messageId: string, options: SpeechTextOptions, overrides?: SpeechOverrides): Promise<void> {
    const source = this.state.getSnapshot().sources.get(messageId)
    const text = source === undefined ? '' : speechText(source, options)
    if (text === '') {
      // Nothing a voice can say: either the log has not delivered the message
      // yet or the reader's preferences projected its content away.
      this.publish({ active: messageId, paused: false, failure: 'unavailable', detail: null })
      return
    }
    this.publish({ active: messageId, paused: false, failure: null, detail: null })
    try {
      // A preview speaks values that are not the durable ones, so its audio must
      // not become the cached reply for that message.
      const cacheKey = overrides === undefined ? messageId : ''
      await this.audio.speak(text, overrides, () => {
        if (this.state.getSnapshot().active === messageId) this.publish({ active: null, paused: false })
      }, cacheKey)
    } catch (error) {
      const detail = messageOf(error)
      // A run superseded by a newer request has nothing left to report: painting
      // its failure now would put a red message over whatever replaced it.
      if (this.state.getSnapshot().active !== messageId) return
      this.report(detail)
      // A refused handshake is not a transient fault: say so, so the reader
      // knows the fix is an update rather than another attempt.
      const refused = error instanceof SpeechError && error.code === 'endpoint'
      this.publish({
        active: messageId,
        paused: false,
        failure: refused ? 'endpoint' : 'provider',
        detail,
      })
    }
  }

  /**
   * The speaker button: start the message, or hold it while it is the active one.
   * Pausing here stops the sound only — the reply keeps being synthesized and
   * buffered, so resuming continues where the voice stopped instead of
   * regenerating the whole reading.
   * @param messageId - target assistant message.
   * @param options - projection options in effect for this reading.
   */
  async toggle(messageId: string, options: SpeechTextOptions): Promise<void> {
    const snapshot = this.state.getSnapshot()
    if (snapshot.active === messageId && snapshot.failure === null) {
      if (snapshot.paused) {
        this.audio.resume()
        this.publish({ paused: false })
      } else {
        this.audio.pause()
        this.publish({ paused: true })
      }
      return
    }
    await this.speak(messageId, options)
  }

  /**
   * Speak one ad-hoc sample for the settings row's test button, through the
   * settings currently on screen rather than the durable ones.
   * @param text - sample to speak.
   * @param overrides - provider, voice, and tuning to preview.
   */
  async speakSample(text: string, overrides: SpeechOverrides): Promise<void> {
    const sample = text.trim()
    if (sample === '') return
    this.audio.stop()
    try {
      await this.audio.speak(sample, overrides, () => {})
    } catch (error) {
      this.report(messageOf(error))
    }
  }

  /** Stop the current playback and clear the active message. */
  stop(): void {
    this.audio.stop()
    if (this.state.getSnapshot().active !== null) this.publish({ active: null, paused: false })
  }

  /** Release playback with the owning plugin. */
  dispose(): void {
    this.audio.dispose()
    this.publish({ active: null, paused: false })
  }

  private publish(next: Partial<Omit<SpeechState, 'sources'>>): void {
    this.state.set({ ...this.state.getSnapshot(), ...next })
  }
}
