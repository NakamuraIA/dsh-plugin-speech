/**
 * Read-aloud action for one finalized assistant message: a play/pause control in
 * the message's action strip, a stop control beside it while it is the active
 * message, and the failure the last attempt hit.
 */
import {
  IconPauseOutlineRegular, IconPlayOutlineRegular, IconStopFillRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SpeechFailure, SpeechState } from './speech-state.ts'
import type { SpeechKey } from './locales.ts'
import css from './SpeakAction.module.css'

/** Injected business face of one read-aloud action. */
export interface SpeechActionInjected {
  hooks: {
    /** Shared read-aloud state: the active message and the folded prose. */
    speech: HostObservable<SpeechState>
  }
  /**
   * Speak the message, or hold/resume it while it is the active one; a failed
   * message retries instead of pausing.
   * @param messageId - target assistant message.
   */
  toggle: (messageId: string) => void
  /** Stop the active message outright and drop the audio in flight. */
  stop: () => void
}

/** Full props of one read-aloud action. */
export type SpeechActionProps =
  PropsRuntime<'conversation.chat.assistant-actions'>
  & InjectFace<SpeechActionInjected>
  & PropsLocale<'speech'>

/** Failure copy per code, so the rendered key stays a literal for the locale seat. */
const FAILURE_KEYS: Readonly<Record<SpeechFailure, SpeechKey>> = {
  unavailable: 'speak.failed.unavailable',
  provider: 'speak.failed.provider',
  endpoint: 'speak.failed.endpoint',
}

/**
 * Render the read-aloud action.
 * @param props - composed slot props.
 * @returns the action element tree.
 */
export function SpeakAction({ messageId, t, useSpeech, toggle, stop }: SpeechActionProps) {
  const active = useSpeech(s => s.active)
  const paused = useSpeech(s => s.paused)
  const failure = useSpeech(s => s.failure)
  const detail = useSpeech(s => s.detail)
  const known = useSpeech(s => s.sources.has(messageId))
  const mine = active === messageId
  const failed = mine && failure !== null
  const speaking = mine && !failed
  const held = speaking && paused
  const label = !speaking
    ? t('speak.read')
    : held ? t('speak.resume') : t('speak.pause')
  return (
    <span className={css.wrap}>
      {failed && (
        <span className={css.failure} role="status" title={detail ?? undefined}>
          {t(FAILURE_KEYS[failure])}
        </span>
      )}
      <button
        type="button"
        className={css.action}
        aria-label={label}
        title={label}
        disabled={!known && !mine}
        onClick={() => { toggle(String(messageId)) }}
      >
        {!speaking
          ? <IconPlayOutlineRegular />
          : held ? <IconPlayOutlineRegular /> : <IconPauseOutlineRegular />}
      </button>
      {speaking && (
        <button
          type="button"
          className={css.action}
          aria-label={t('speak.stop')}
          title={t('speak.stop')}
          onClick={stop}
        >
          <IconStopFillRegular />
        </button>
      )}
    </span>
  )
}
