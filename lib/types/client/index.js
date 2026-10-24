import { DEFAULT_SPEECH_SETTINGS, PROVIDER_FIELD, SKIP_CODE_FIELD, SPEECH_SETTINGS_NAMESPACE, activeBlockField, activeVoiceSettings, } from "../settings.js";
import { SpeechController } from "./controller.js";
import { en, zh } from "./locales.js";
import { registerSpeechText } from "./nodes.js";
import { createSpeechRowStore } from "./settings-store.js";
import { SpeechAudio } from "./speech-audio.js";
import { createSpeechState } from "./speech-state.js";
import { SpeakAction } from "./SpeakAction.js";
import { SpeechRow } from "./SpeechRow.js";
/** Namespace owning this feature's copy. */
export const SETTINGS_NS = 'speech';
/** Required services: the surfaces' registries and the settings transport. */
export const inject = ['slots', 'locale', 'uiConversation', 'configForms'];
/** Route the host answers the voice catalog on. */
const VOICES_ROUTE = '/speech/voices';
/**
 * Flatten the durable section into the values the settings row displays.
 * @param section - durable speech settings.
 * @returns the active provider's editable values.
 */
function rowSectionOf(section) {
    const active = activeVoiceSettings(section);
    return {
        provider: section.provider,
        voice: active.voice,
        rate: active.rate,
        volume: active.volume,
        pitch: active.pitch,
        skipCode: section.skipCode,
    };
}
/**
 * Client plugin body.
 * @param ctx - client cordis context.
 */
export function apply(ctx) {
    const state = createSpeechState();
    const audio = new SpeechAudio();
    const controller = new SpeechController(state, audio, (message) => { ctx.logger.warn(message); });
    ctx.effect(() => () => { controller.dispose(); }, 'ui-speech: playback teardown');
    registerSpeechText(ctx, controller);
    ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), 'ui-speech: dictionaries');
    // The Host entry id is the settings namespace: the form is the projection of
    // the config this plugin declares, and writes ride the settings transport the
    // provider owns — no caller-scoped binding exists any more.
    const host = ctx.configForms.get(SPEECH_SETTINGS_NAMESPACE);
    const section = () => host.getSnapshot().value ?? DEFAULT_SPEECH_SETTINGS;
    const projection = () => ({ skipCode: section().skipCode });
    const store = createSpeechRowStore();
    let bound;
    const sync = () => {
        bound?.sync(rowSectionOf(section()), host.getSnapshot().revision ?? 0);
    };
    ctx.effect(() => host.subscribe(sync), 'ui-speech: settings mirror');
    /**
     * Load the selected provider's voice catalog. A provider that publishes none
     * (its voices belong to the user's account) simply leaves the list empty.
     * @param provider - provider whose catalog is requested.
     */
    const refreshVoices = (provider) => {
        void fetch(`${VOICES_ROUTE}?provider=${encodeURIComponent(provider)}`)
            .then(async (response) => {
            if (!response.ok)
                return [];
            const body = await response.json();
            return body.voices ?? [];
        })
            .then((voices) => { bound?.setVoices(voices); })
            .catch((error) => { ctx.logger.warn(error instanceof Error ? error.message : String(error)); });
    };
    const toggle = (messageId) => {
        const snapshot = state.getSnapshot();
        if (snapshot.active === messageId && snapshot.failure === null) {
            controller.stop();
            return;
        }
        void controller.speak(messageId, projection());
    };
    ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
        name: 'conversation.chat.assistant-actions',
        id: 'speech',
        order: 20,
        locale: SETTINGS_NS,
        inject: () => ({ hooks: { speech: state }, toggle }),
    }, SpeakAction));
    ctx.slots.inject('settings.general.item', () => ctx.slots.register({
        name: 'settings.general.item',
        id: 'speech',
        order: 13,
        store,
        locale: SETTINGS_NS,
        inject: (actions) => {
            bound = actions;
            sync();
            refreshVoices(section().provider);
            // A write answers whether the Host accepted it; a refusal also reloads the
            // durable section, so a rejected value is visible twice over. A memory-mode
            // page keeps the choice process-local and resolves every write as refused
            // without ever reaching the Host, so its settlement says nothing.
            const settle = (written) => {
                if (host.getSnapshot().mode === 'memory')
                    return;
                void written.then((accepted) => { actions.markWriteFailed(!accepted); }, () => { actions.markWriteFailed(true); });
            };
            const writeField = (field, value) => {
                settle(host.set(field, value));
            };
            const writeEntry = (entryField, key, value) => {
                settle(host.mutate([{ op: 'set', path: [entryField, key], value: value }]));
            };
            return {
                setProvider: (provider) => {
                    writeField(PROVIDER_FIELD, provider);
                    refreshVoices(provider);
                },
                setVoice: (voice) => {
                    writeEntry(activeBlockField(), 'voice', voice);
                },
                setTuning: (key, value) => {
                    writeEntry(activeBlockField(), key, value);
                },
                setSkipCode: (skipCode) => {
                    writeField(SKIP_CODE_FIELD, skipCode);
                },
                test: (text, overrides) => {
                    void controller.speakSample(text, overrides);
                },
            };
        },
    }, SpeechRow));
}
//# sourceMappingURL=index.js.map