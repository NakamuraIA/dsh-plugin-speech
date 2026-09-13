import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import { type SpeechProviderId } from '../settings.ts';
import type { SpeechOverrides } from './speech-audio.ts';
import type { createSpeechRowStore } from './settings-store.ts';
/** Injected business face: the preference writes and the sample playback. */
export interface SpeechRowInjected {
    /** Select the service that synthesizes. */
    setProvider: (provider: SpeechProviderId) => void;
    /** Select the voice the service speaks with. */
    setVoice: (voice: string) => void;
    /** Change one tuning value. */
    setTuning: (key: 'rate' | 'volume' | 'pitch', value: number) => void;
    /** Include or leave out code blocks and tables. */
    setSkipCode: (skipCode: boolean) => void;
    /** Speak a short sample through the settings on screen, saved or not. */
    test: (text: string, overrides: SpeechOverrides) => void;
}
/** Full component props: runtime share + store share + locale seat + injected face. */
export type SpeechRowComponentProps = PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createSpeechRowStore>> & PropsLocale<'speech'> & SpeechRowInjected;
/**
 * Render the read-aloud settings row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export declare function SpeechRow({ t, useStore, setProvider, setVoice, setTuning, setSkipCode, test, }: SpeechRowComponentProps): import("react").JSX.Element;
//# sourceMappingURL=SpeechRow.d.ts.map