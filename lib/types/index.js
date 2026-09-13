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
import { SPEECH_SPEAK_ROUTE, SPEECH_VOICES_ROUTE } from "./routes.js";
import { SPEECH_SETTINGS_NAMESPACE, SpeechSettingsSchema } from "./settings.js";
import { serveSpeechRequest } from "./speak-route.js";
import { serveVoiceCatalog } from "./voices-route.js";
/** Stable Cordis plugin name. */
export const name = 'ui-speech';
/** The routes need the HTTP carrier, so the plugin waits for it. */
export const inject = ['webServer'];
/**
 * Register the durable speech preferences and claim the two speech routes.
 * @param ctx - host context carrying the webServer service.
 */
export function apply(ctx) {
    ctx.inject(['settings'], (settingsCtx) => {
        settingsCtx.settings.register(SPEECH_SETTINGS_NAMESPACE, SpeechSettingsSchema);
    });
    ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: SPEECH_SPEAK_ROUTE,
        handler: (req, res) => serveSpeechRequest(req, res, ctx),
    }), 'ui-speech: synthesis route');
    ctx.effect(() => ctx.webServer.register({
        kind: 'exact',
        path: SPEECH_VOICES_ROUTE,
        handler: serveVoiceCatalog,
    }), 'ui-speech: voice catalog route');
}
//# sourceMappingURL=index.js.map