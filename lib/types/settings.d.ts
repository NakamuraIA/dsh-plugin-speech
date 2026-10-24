/**
 * Durable speech preferences shared by the Host schema and the browser form.
 *
 * The schema is the plugin's Cordis `Config`, so it is also the settings form:
 * the profile entry id (`ui-speech`) is the namespace, and every field the
 * settings screen may edit is marked `.volatile()`. A field without that mark
 * would still validate the composition, but the Host refuses to edit it.
 */
import z from '@deepseek-ai/schemastery';
/** Settings namespace owned by the speech plugin: its profile entry id. */
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
/**
 * Durable speech schema and the plugin's Cordis `Config`. Every leaf is volatile,
 * so the settings screen edits values in place instead of remounting the plugin.
 */
export declare const SpeechSettingsSchema: z<Schemastery.ObjectS<NoInfer<{
    provider: z<"edge", "edge", "volatile-defined">;
    skipCode: z<boolean, boolean, "volatile-defined">;
    edge: z<Schemastery.ObjectS<NoInfer<{
        voice: z<string, string, "volatile-defined">;
        rate: z<number, number, "volatile-defined">;
        volume: z<number, number, "volatile-defined">;
        pitch: z<number, number, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        voice: z<string, string, "volatile-defined">;
        rate: z<number, number, "volatile-defined">;
        volume: z<number, number, "volatile-defined">;
        pitch: z<number, number, "volatile-defined">;
    }>>, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    provider: z<"edge", "edge", "volatile-defined">;
    skipCode: z<boolean, boolean, "volatile-defined">;
    edge: z<Schemastery.ObjectS<NoInfer<{
        voice: z<string, string, "volatile-defined">;
        rate: z<number, number, "volatile-defined">;
        volume: z<number, number, "volatile-defined">;
        pitch: z<number, number, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        voice: z<string, string, "volatile-defined">;
        rate: z<number, number, "volatile-defined">;
        volume: z<number, number, "volatile-defined">;
        pitch: z<number, number, "volatile-defined">;
    }>>, "defined">;
}>>, "plain">;
/** The resolved Host config: every editable leaf is a live reference. */
export interface SpeechConfig {
    /** Selected provider. */
    provider: LiveRef<SpeechProviderId>;
    /** Whether read-aloud drops fenced code, inline code, and tables. */
    skipCode: LiveRef<boolean>;
    /** Edge preferences. */
    edge: {
        /** Edge voice short name. */
        voice: LiveRef<string>;
        /** Speaking rate delta. */
        rate: LiveRef<number>;
        /** Volume delta. */
        volume: LiveRef<number>;
        /** Pitch delta. */
        pitch: LiveRef<number>;
    };
}
/** What `.volatile()` parses a field into: one stable reference over the live value. */
export interface LiveRef<T> {
    /**
     * Read the value the Host currently holds.
     * @returns the live value.
     */
    get(): T;
}
/**
 * Read one field of the resolved config. A volatile leaf is a live reference; a
 * plain one is the value itself, which is what a field the profile layer left at
 * its schema default may still be.
 * @param field - one resolved config field.
 * @returns the value the Host currently holds.
 */
export declare function liveValue<T>(field: LiveRef<T> | T): T;
/**
 * Read the whole config as the plain section the selector consumes, with every
 * default filled in for a field the Host left unset.
 * @param config - resolved Host config, absent when the entry declares none.
 * @returns the durable speech settings.
 */
export declare function speechSection(config: Partial<SpeechConfig> | undefined): SpeechSettings;
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