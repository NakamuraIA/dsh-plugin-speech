/**
 * The speech selector: turns the durable settings section plus one request's
 * overrides into the exact call a provider receives. This is the only place
 * that knows how a settings block maps onto a provider, so a provider folder
 * never reads settings and the HTTP route never names a vendor.
 */
import type { SpeechProvider, SpeechRequest } from './providers/types.ts';
import type { SpeechSettings } from './settings.ts';
/** Per-request overrides the settings screen sends while previewing a voice. */
export interface SpeechOverrides {
    /** Provider to call instead of the durable selection. */
    provider?: string;
    /** Voice to speak with instead of the durable one. */
    voice?: string;
    /** Tuning values that override the durable block for this call only. */
    tuning?: Readonly<Record<string, unknown>>;
}
/** One resolved call: the provider to drive and the request it receives. */
export interface SelectedSpeech {
    /** Provider that will synthesize. */
    provider: SpeechProvider;
    /** Request built from the durable block and any overrides. */
    request: SpeechRequest;
}
/**
 * Resolve one synthesis call.
 * @param section - durable speech settings.
 * @param text - text to speak.
 * @param overrides - optional preview overrides from the settings screen.
 * @returns the provider and its request, or undefined when no folder claims the id.
 */
export declare function selectSpeech(section: SpeechSettings, text: string, overrides?: SpeechOverrides): SelectedSpeech | undefined;
//# sourceMappingURL=selector.d.ts.map