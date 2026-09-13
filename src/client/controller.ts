/**
 * Read-aloud orchestration: owns the folded assistant prose, drives playback,
 * and publishes the state every speaker action renders from. One controller per
 * plugin, so a second request stops whatever the first started, across sessions
 * included. The projection onto spoken text runs per request, so a preference
 * change applies to the next reading without re-folding the log.
 */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
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
      this.publish({ active: messageId, failure: 'unavailable', detail: null })
      return
    }
    this.publish({ active: messageId, failure: null, detail: null })
    try {
      await this.audio.speak(text, overrides, () => {
        if (this.state.getSnapshot().active === messageId) this.publish({ active: null })
      })
    } catch (error) {
      const detail = messageOf(error)
      this.report(detail)
      this.publish({ active: messageId, failure: 'provider', detail })
    }
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
    if (this.state.getSnapshot().active !== null) this.publish({ active: null })
  }

  /** Release playback with the owning plugin. */
  dispose(): void {
    this.audio.dispose()
    this.publish({ active: null })
  }

  private publish(next: Partial<Omit<SpeechState, 'sources'>>): void {
    this.state.set({ ...this.state.getSnapshot(), ...next })
  }
}
