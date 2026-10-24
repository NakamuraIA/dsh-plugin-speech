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
import { SPEECH_SPEAK_ROUTE, SPEECH_VOICES_ROUTE } from "./routes.js";
import { SpeechSettingsSchema, speechSection } from "./settings.js";
import { serveSpeechRequest } from "./speak-route.js";
import { serveVoiceCatalog } from "./voices-route.js";
/** Stable Cordis plugin name. */
export const name = 'ui-speech';
/** The routes need the HTTP carrier, so the plugin waits for it. */
export const inject = ['webServer'];
/**
 * The plugin's Cordis config, which is also its settings form: the Host exposes
 * every volatile field of this schema under the `ui-speech` entry.
 */
export const Config = SpeechSettingsSchema;
/**
 * Claim the two speech routes. The preferences are read through the config the
 * Loader resolved for this entry, so nothing has to be registered elsewhere.
 * @param ctx - host context carrying the webServer service.
 * @param config - resolved entry config holding the live preferences.
 */
export function apply(ctx, config) {
    // Read per request: a settings write updates the entry config in place.
    const section = () => speechSection(config);
    ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: SPEECH_SPEAK_ROUTE,
        handler: (req, res) => serveSpeechRequest(req, res, section),
    }), 'ui-speech: synthesis route');
    ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: SPEECH_VOICES_ROUTE,
        handler: serveVoiceCatalog,
    }), 'ui-speech: voice catalog route');
}
//# sourceMappingURL=index.js.map