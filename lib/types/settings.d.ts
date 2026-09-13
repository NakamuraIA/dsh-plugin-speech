/** Durable speech preferences shared by the Host schema and the browser scope. */
import z from '@deepseek-ai/schemastery';
/** Settings namespace owned by the speech plugin. */
export declare const SPEECH_SETTINGS_NAMESPACE = "ui-speech";
/** Field carrying the selected provider. */
export declare const PROVIDER_FIELD = "provider";
/** Field carrying whether read-aloud skips code and tables. */
export declare const SKIP_CODE_FIELD = "skipCode";
/** Field carrying the Microsoft Edge block. */
export declare const EDGE_FIELD = "edge";
/**
 * Providers this build can speak through. The union grows with each provider
 * folder; a value outside it is refused by the schema rather than silently
 * falling back to another voice.
 */
export declare const SPEECH_PROVIDERS: readonly ["edge"];
/** One selectable speech provider. */
export type SpeechProviderId = typeof SPEECH_PROVIDERS[number];
/** Provider used when the user-settings document has no override. */
export declare const DEFAULT_PROVIDER: SpeechProviderId;
/** Whether read-aloud skips code when the user-settings document has no override. */
export declare const DEFAULT_SKIP_CODE = true;
/** Microsoft Edge read-aloud preferences. */
export interface EdgeSettings {
    /** Edge voice short name, for example `pt-BR-AntonioNeural`. */
    voice: string;
    /** Speaking rate as a percentage delta (-50..50). */
    rate: number;
    /** Volume as a percentage delta (-50..50). */
    volume: number;
    /** Pitch as a Hz delta (-50..50). */
    pitch: number;
}
/** Edge defaults: the service always serves voices, so this block is never empty. */
export declare const DEFAULT_EDGE_SETTINGS: EdgeSettings;
/** Durable speech section shared by the Host schema and the browser scope. */
export interface SpeechSettings {
    /** Selected provider. */
    provider: SpeechProviderId;
    /** Whether read-aloud drops fenced code, inline code, and tables. */
    skipCode: boolean;
    /** Edge preferences. */
    edge: EdgeSettings;
}
/** Durable speech schema; also the wire envelope the browser scope validates against. */
export declare const SpeechSettingsSchema: z<SpeechSettings>;
/** The complete section with every default filled in. */
export declare const DEFAULT_SPEECH_SETTINGS: SpeechSettings;
/**
 * Narrow one wire or registry value to a selectable provider.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value names a provider this build can call.
 */
export declare function isSpeechProvider(value: unknown): value is SpeechProviderId;
/**
 * Read the voice and tuning the active provider's block holds.
 * @param section - durable speech settings.
 * @returns the editable values of the selected provider.
 */
export declare function activeVoiceSettings(section: SpeechSettings): EdgeSettings;
/**
 * Name the settings field holding the active provider's block.
 * @returns the namespace field the selected provider's values live under.
 */
export declare function activeBlockField(): string;
//# sourceMappingURL=settings.d.ts.map