/**
 * `POST /speech/speak`: the browser posts text, the host selects the provider
 * from the durable settings and calls it with the deployment's credentials, and
 * the audio streams straight back. Synthesis belongs to the host because the
 * browser cannot hold an API key and cannot reach most providers across CORS.
 */
import { pipeline } from 'node:stream/promises';
import { selectSpeech } from "./selector.js";
import { MAX_TEXT_CHARS } from "./speech-limits.js";
import { DEFAULT_SPEECH_SETTINGS, SPEECH_SETTINGS_NAMESPACE } from "./settings.js";
/** Largest request body accepted; one reply is far below this. */
const MAX_BODY_BYTES = 256 * 1024;
/**
 * Read a bounded JSON request body.
 * @param req - the node:http request.
 * @returns the parsed body, or undefined when it is absent, oversized, or not JSON.
 */
async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = chunk;
        size += buffer.length;
        if (size > MAX_BODY_BYTES)
            return undefined;
        chunks.push(buffer);
    }
    if (size === 0)
        return undefined;
    try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
    }
    catch (_invalidJson) {
        return undefined;
    }
}
/**
 * Narrow one wire value to a tuning record.
 * @param value - the request body's tuning member.
 * @returns the record, or undefined when the body carried none.
 */
function tuningOf(value) {
    if (typeof value !== 'object' || value === null)
        return undefined;
    return value;
}
/**
 * Answer one synthesis request.
 * @param req - the node:http request.
 * @param res - the node:http response.
 * @param ctx - host context carrying the settings service.
 */
export async function serveSpeechRequest(req, res, ctx) {
    if (req.method !== 'POST') {
        res.writeHead(405);
        res.end();
        return;
    }
    const body = await readBody(req);
    const text = typeof body?.text === 'string' ? body.text : '';
    if (text === '' || text.length > MAX_TEXT_CHARS) {
        res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `text must be 1..${MAX_TEXT_CHARS} characters` }));
        return;
    }
    const section = ctx.get('settings')?.get(SPEECH_SETTINGS_NAMESPACE);
    const tuning = tuningOf(body?.tuning);
    const overrides = {
        ...(typeof body?.provider === 'string' ? { provider: body.provider } : {}),
        ...(typeof body?.voice === 'string' ? { voice: body.voice } : {}),
        ...(tuning === undefined ? {} : { tuning }),
    };
    const selected = selectSpeech(section ?? DEFAULT_SPEECH_SETTINGS, text, overrides);
    if (selected === undefined) {
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'unknown speech provider' }));
        return;
    }
    try {
        const audio = await selected.provider.synthesize(selected.request, {});
        res.writeHead(200, {
            'content-type': audio.contentType,
            // Audio is already compressed and is consumed once: never deflate it, and
            // never let a proxy hold it for another request.
            'cache-control': 'no-store, no-transform',
        });
        await pipeline(audio.stream, res);
    }
    catch (error) {
        // The response is committed once streaming starts; a failure before that
        // point is reported as a provider fault the browser can show.
        if (res.headersSent) {
            res.destroy();
            return;
        }
        res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
}
//# sourceMappingURL=speak-route.js.map