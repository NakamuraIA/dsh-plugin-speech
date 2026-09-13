/**
 * @deepseek-ai/dsh-client-ui-speech Host half — the node side of read-aloud.
 * It owns three things, each in its own module: the durable preferences, the
 * synthesis route every provider call goes through, and the voice catalog the
 * settings screen lists. Providers live one per folder under `providers/`, so
 * adding a text-to-speech service means adding a folder and one line in the
 * registry.
 *
 * Synthesis belongs to the host because a browser cannot hold an API key and
 * cannot reach most providers across CORS; the browser only posts text.
 * @module @deepseek-ai/dsh-client-ui-speech
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable Cordis plugin name. */
export declare const name = "ui-speech";
/** The routes need the HTTP carrier, so the plugin waits for it. */
export declare const inject: string[];
/**
 * Register the durable speech preferences and claim the two speech routes.
 * @param ctx - host context carrying the webServer service.
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map