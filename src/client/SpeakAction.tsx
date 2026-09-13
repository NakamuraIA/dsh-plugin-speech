/**
 * Read-aloud action for one finalized assistant message: a play/stop control in
 * the message's action strip, with the failure it hit shown beside it.
 */
import { IconPlayOutline16, IconStopFill16 } from '@deepseek-ai/dsh-client-ui-primitives'
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
   * Speak the message, or stop it while it is the active one; a failed message
   * retries instead of stopping.
   * @param messageId - target assistant message.
   */
  toggle: (messageId: string) => void
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
}

/**
 * Render the read-aloud action.
 * @param props - composed slot props.
 * @returns the action element tree.
 */
export function SpeakAction({ messageId, t, useSpeech, toggle }: SpeechActionProps) {
  const active = useSpeech(s => s.active)
  const failure = useSpeech(s => s.failure)
  const detail = useSpeech(s => s.detail)
  const known = useSpeech(s => s.sources.has(messageId))
  const mine = active === messageId
  const failed = mine && failure !== null
  const speaking = mine && !failed
  const label = speaking ? t('speak.stop') : t('speak.read')
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
        {speaking ? <IconStopFill16 /> : <IconPlayOutline16 />}
      </button>
    </span>
  )
}
