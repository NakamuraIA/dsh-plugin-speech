/**
 * @deepseek-ai/dsh-client-ui-speech Host half — the node side of read-aloud.
 * It owns three things, each in its own module: the preferences, the synthesis
 * route every provider call goes through, and the voice catalog the settings
 * screen lists. Providers live one per folder under `providers/`, so adding a
 * text-to-speech service means adding a folder and one line in the registry.
 *
 * The preferences are the plugin's own Cordis config rather than a namespace it
 * registers: the Host owns configuration, the profile entry id (`ui-speech`) is
 * the namespace the browser form reads and writes, and every editable leaf is
 * volatile, so a settings write is visible here without reloading the plugin.
 *
 * Synthesis belongs to the host because a browser cannot hold an API key and
 * cannot reach most providers across CORS; the browser only posts text.
 * @module @deepseek-ai/dsh-client-ui-speech
 */
import type { Context } from '@deepseek-ai/cordis';
import { type SpeechConfig } from './settings.ts';
/** Stable Cordis plugin name. */
export declare const name = "ui-speech";
/** The routes need the HTTP carrier, so the plugin waits for it. */
export declare const inject: string[];
/**
 * The plugin's Cordis config, which is also its settings form: the Host exposes
 * every volatile field of this schema under the `ui-speech` entry.
 */
export declare const Config: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
    provider: import("@deepseek-ai/schemastery").default<"edge", "edge", "volatile-defined">;
    skipCode: import("@deepseek-ai/schemastery").default<boolean, boolean, "volatile-defined">;
    edge: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
        voice: import("@deepseek-ai/schemastery").default<string, string, "volatile-defined">;
        rate: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
        volume: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
        pitch: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        voice: import("@deepseek-ai/schemastery").default<string, string, "volatile-defined">;
        rate: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
        volume: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
        pitch: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
    }>>, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    provider: import("@deepseek-ai/schemastery").default<"edge", "edge", "volatile-defined">;
    skipCode: import("@deepseek-ai/schemastery").default<boolean, boolean, "volatile-defined">;
    edge: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
        voice: import("@deepseek-ai/schemastery").default<string, string, "volatile-defined">;
        rate: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
        volume: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
        pitch: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        voice: import("@deepseek-ai/schemastery").default<string, string, "volatile-defined">;
        rate: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
        volume: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
        pitch: import("@deepseek-ai/schemastery").default<number, number, "volatile-defined">;
    }>>, "defined">;
}>>, "plain">;
/**
 * Claim the two speech routes. The preferences are read through the config the
 * Loader resolved for this entry, so nothing has to be registered elsewhere.
 * @param ctx - host context carrying the webServer service.
 * @param config - resolved entry config holding the live preferences.
 */
export declare function apply(ctx: Context, config?: SpeechConfig): void;
//# sourceMappingURL=index.d.ts.map