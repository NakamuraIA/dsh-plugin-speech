/**
 * `POST /speech/speak`: the browser posts text, the host selects the provider
 * from its entry config and calls it with the deployment's credentials, and the
 * audio streams straight back. Synthesis belongs to the host because the browser
 * cannot hold an API key and cannot reach most providers across CORS.
 */
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { selectSpeech } from "./selector.js";
import { MAX_TEXT_CHARS } from "./speech-limits.js";
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
 * Narrow the encoding hint a browser sends. An unknown value is ignored rather
 * than refused: the field only says what the caller can demux, and the
 * provider's own default is a better answer than a failed reply.
 * @param value - the request body's format member.
 * @returns the encoding, or undefined to keep the provider's default.
 */
function formatOf(value) {
    return value === 'mp3' || value === 'webm' ? value : undefined;
}
/**
 * Re-yield whatever a stream iterator has left after its first chunk.
 * @param iterator - the iterator the route already advanced once.
 * @returns the remaining chunks.
 */
async function* remaining(iterator) {
    for (;;) {
        const next = await iterator.next();
        if (next.done === true)
            return;
        yield next.value;
    }
}
/**
 * Answer one synthesis request.
 * @param req - the node:http request.
 * @param res - the node:http response.
 * @param section - reads the live preferences of this plugin's entry.
 */
export async function serveSpeechRequest(req, res, section) {
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
    const tuning = tuningOf(body?.tuning);
    const format = formatOf(body?.format);
    const overrides = {
        ...(typeof body?.provider === 'string' ? { provider: body.provider } : {}),
        ...(typeof body?.voice === 'string' ? { voice: body.voice } : {}),
        ...(tuning === undefined ? {} : { tuning }),
        ...(format === undefined ? {} : { format }),
    };
    const selected = selectSpeech(section(), text, overrides);
    if (selected === undefined) {
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'unknown speech provider' }));
        return;
    }
    try {
        const audio = await selected.provider.synthesize(selected.request, {});
        const chunks = audio.stream[Symbol.asyncIterator]();
        // Commit the response only once the service has produced audio. Committing
        // first would turn a provider that fails on its very first frame into an
        // empty 200 — silence with nothing the browser can report — which is what a
        // dropped handshake used to look like here.
        const first = await chunks.next();
        res.writeHead(200, {
            'content-type': audio.contentType,
            // Audio is already compressed and is consumed once: never deflate it, and
            // never let a proxy hold it for another request.
            'cache-control': 'no-store, no-transform',
        });
        if (first.done === true) {
            res.end();
            return;
        }
        res.write(first.value);
        // The pipeline carries the rest and ends the response itself.
        await pipeline(Readable.from(remaining(chunks)), res);
    }
    catch (error) {
        // Past the first chunk the response is committed and its length is already
        // promised, so the only honest thing left is to tear it down.
        if (res.headersSent) {
            res.destroy();
            return;
        }
        res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
}
//# sourceMappingURL=speak-route.js.map