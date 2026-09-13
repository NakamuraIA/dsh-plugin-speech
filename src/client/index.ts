/**
 * Client plugin body: fold every finalized assistant message's prose, drive
 * read-aloud through the host's synthesis route, and register the message
 * action plus its settings row. Nothing here holds a credential — the host owns
 * the provider call and the browser only posts text.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the conversation registry merge (ctx.uiConversation).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the ui-chat SlotMap merge (the assistant-actions entry).
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SpeechVoice } from '../providers/types.ts'
import type { SpeechTextOptions } from '../speech-text.ts'
import {
  DEFAULT_SPEECH_SETTINGS, PROVIDER_FIELD, SKIP_CODE_FIELD, SPEECH_SETTINGS_NAMESPACE,
  activeBlockField, activeVoiceSettings,
  type SpeechProviderId, type SpeechSettings,
} from '../settings.ts'
import { SpeechController } from './controller.ts'
import { en, zh } from './locales.ts'
import { registerSpeechText } from './nodes.ts'
import { createSpeechRowStore, type SpeechRowSection } from './settings-store.ts'
import { SpeechAudio, type SpeechOverrides } from './speech-audio.ts'
import { createSpeechState } from './speech-state.ts'
import { SpeakAction, type SpeechActionInjected } from './SpeakAction.tsx'
import { SpeechRow, type SpeechRowInjected } from './SpeechRow.tsx'

export type { SpeechActionInjected, SpeechActionProps } from './SpeakAction.tsx'
export type { SpeechRowComponentProps, SpeechRowInjected } from './SpeechRow.tsx'
export type { SpeechRowState, SpeechRowSection } from './settings-store.ts'
export type { SpeechFailure, SpeechState } from './speech-state.ts'
export type { SpeechOverrides } from './speech-audio.ts'
export type { SpeechKey } from './locales.ts'
export type { SpeechSettings, SpeechProviderId } from '../settings.ts'

/** Namespace owning this feature's copy. */
export const SETTINGS_NS = 'speech'

/** Required services: the surfaces' registries and the settings transport. */
export const inject = ['slots', 'locale', 'uiConversation', 'remote', 'settingsScope']

/** Route the host answers the voice catalog on. */
const VOICES_ROUTE = '/speech/voices'

/**
 * Flatten the durable section into the values the settings row displays.
 * @param section - durable speech settings.
 * @returns the active provider's editable values.
 */
function rowSectionOf(section: SpeechSettings): SpeechRowSection {
  const active = activeVoiceSettings(section)
  return {
    provider: section.provider,
    voice: active.voice,
    rate: active.rate,
    volume: active.volume,
    pitch: active.pitch,
    skipCode: section.skipCode,
  }
}

/**
 * Client plugin body.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  const state = createSpeechState()
  const audio = new SpeechAudio()
  const controller = new SpeechController(state, audio, (message) => { ctx.logger.warn(message) })
  ctx.effect(() => () => { controller.dispose() }, 'ui-speech: playback teardown')

  registerSpeechText(ctx, controller)
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), 'ui-speech: dictionaries')

  const host: SettingsScope<SpeechSettings> = ctx.settingsScope
    .bind<SpeechSettings>({ namespace: SPEECH_SETTINGS_NAMESPACE })
  const section = (): SpeechSettings => host.getSnapshot().value ?? DEFAULT_SPEECH_SETTINGS
  const projection = (): SpeechTextOptions => ({ skipCode: section().skipCode })

  const store = createSpeechRowStore()
  let bound: BoundActions<typeof store> | undefined
  const sync = (): void => {
    bound?.sync(rowSectionOf(section()), host.getSnapshot().revision ?? 0)
  }
  ctx.effect(() => host.subscribe(sync), 'ui-speech: settings mirror')

  /**
   * Load the selected provider's voice catalog. A provider that publishes none
   * (its voices belong to the user's account) simply leaves the list empty.
   * @param provider - provider whose catalog is requested.
   */
  const refreshVoices = (provider: SpeechProviderId): void => {
    void fetch(`${VOICES_ROUTE}?provider=${encodeURIComponent(provider)}`)
      .then(async (response) => {
        if (!response.ok) return []
        const body = await response.json() as { voices?: SpeechVoice[] }
        return body.voices ?? []
      })
      .then((voices) => { bound?.setVoices(voices) })
      .catch((error: unknown) => { ctx.logger.warn(error instanceof Error ? error.message : String(error)) })
  }

  const toggle = (messageId: string): void => {
    const snapshot = state.getSnapshot()
    if (snapshot.active === messageId && snapshot.failure === null) {
      controller.stop()
      return
    }
    void controller.speak(messageId, projection())
  }

  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'speech',
    order: 20,
    locale: SETTINGS_NS,
    inject: (): SpeechActionInjected => ({ hooks: { speech: state }, toggle }),
  }, SpeakAction))

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'speech',
    order: 13,
    store,
    locale: SETTINGS_NS,
    inject: (actions: BoundActions<typeof store>): SpeechRowInjected => {
      bound = actions
      sync()
      refreshVoices(section().provider)
      // The transport reports a refusal as a plain settlement and reloads the
      // durable section, so the settled value is the only evidence that the
      // write survived. A memory-mode page keeps the choice process-local and
      // has no durable value to compare against.
      const settle = (written: Promise<void>, holds: () => boolean): void => {
        if (host.getSnapshot().mode === 'memory') return
        void written.then(
          () => { actions.markWriteFailed(!holds()) },
          () => { actions.markWriteFailed(true) },
        )
      }
      const writeField = (field: string, value: unknown, holds: () => boolean): void => {
        settle(host.set(field, value), holds)
      }
      const writeEntry = (entryField: string, key: string, value: unknown, holds: () => boolean): void => {
        settle(host.mutate([{ op: 'set', path: [entryField, key], value: value as never }]), holds)
      }
      return {
        setProvider: (provider: SpeechProviderId) => {
          // Widened before comparison: both sides are the same literal type, and
          // the check is about the settled value, not about the type.
          const requested: string = provider
          writeField(PROVIDER_FIELD, provider, () => (section().provider as string) === requested)
          refreshVoices(provider)
        },
        setVoice: (voice: string) => {
          writeEntry(activeBlockField(), 'voice', voice, () => activeVoiceSettings(section()).voice === voice)
        },
        setTuning: (key, value) => {
          writeEntry(activeBlockField(), key, value, () => activeVoiceSettings(section())[key] === value)
        },
        setSkipCode: (skipCode: boolean) => {
          writeField(SKIP_CODE_FIELD, skipCode, () => section().skipCode === skipCode)
        },
        test: (text: string, overrides: SpeechOverrides) => {
          void controller.speakSample(text, overrides)
        },
      }
    },
  }, SpeechRow))
}
