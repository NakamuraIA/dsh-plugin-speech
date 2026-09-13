/**
 * Speech settings row store: a mirror of the durable section plus the voice
 * catalog and the settlement of the last write this row asked for. The plugin's
 * apply-world listener is the only writer; the row reads via props.useStore.
 */
import { defineStore } from '@deepseek-ai/dsh-client-store';
import { DEFAULT_EDGE_SETTINGS, DEFAULT_PROVIDER, DEFAULT_SKIP_CODE, } from "../settings.js";
/**
 * Declares the speech row state and write surface.
 * @returns the store handle.
 */
export function createSpeechRowStore() {
    return defineStore({
        init: () => ({
            provider: DEFAULT_PROVIDER,
            voice: DEFAULT_EDGE_SETTINGS.voice,
            rate: DEFAULT_EDGE_SETTINGS.rate,
            volume: DEFAULT_EDGE_SETTINGS.volume,
            pitch: DEFAULT_EDGE_SETTINGS.pitch,
            skipCode: DEFAULT_SKIP_CODE,
            voices: [],
            language: '',
            revision: -1,
            writeFailed: false,
        }),
        actions: {
            sync: (d, section, revision) => {
                if (revision <= d.revision)
                    return;
                d.provider = section.provider;
                d.voice = section.voice;
                d.rate = section.rate;
                d.volume = section.volume;
                d.pitch = section.pitch;
                d.skipCode = section.skipCode;
                d.revision = revision;
            },
            setVoices: (d, voices) => {
                d.voices = voices;
                // Keep the language filter on something the catalog still offers: the
                // selected voice's language first, then the first language listed.
                const selected = voices.find(voice => voice.id === d.voice);
                if (selected !== undefined) {
                    d.language = selected.language;
                    return;
                }
                if (!voices.some(voice => voice.language === d.language)) {
                    d.language = voices[0]?.language ?? '';
                }
            },
            setLanguage: (d, language) => { d.language = language; },
            // Deliberately outside the revision guard: a refused write publishes no
            // snapshot, so its settlement is the only fact that can carry it.
            markWriteFailed: (d, failed) => { d.writeFailed = failed; },
        },
    });
}
//# sourceMappingURL=settings-store.js.map