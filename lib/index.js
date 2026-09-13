import z from "@deepseek-ai/schemastery";
import { pipeline } from "node:stream/promises";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
//#region lib/types/routes.js
/** The speech plugin's URL surface, owned in one place so routes cannot drift. */
/** Prefix serving the local engine, the ONNX runtime, and the voice model. */
const SPEECH_ROUTE = "/speech";
/** Exact route the browser posts synthesis requests to. */
const SPEECH_SPEAK_ROUTE = `${SPEECH_ROUTE}/speak`;
/** Exact route listing the selected provider's voices. */
const SPEECH_VOICES_ROUTE = `${SPEECH_ROUTE}/voices`;
//#endregion
//#region lib/types/settings.js
/** Durable speech preferences shared by the Host schema and the browser scope. */
/** Settings namespace owned by the speech plugin. */
const SPEECH_SETTINGS_NAMESPACE = "ui-speech";
/** Field carrying the selected provider. */
const PROVIDER_FIELD = "provider";
/** Field carrying whether read-aloud skips code and tables. */
const SKIP_CODE_FIELD = "skipCode";
/** Field carrying the Microsoft Edge block. */
const EDGE_FIELD = "edge";
/**
* Providers this build can speak through. The union grows with each provider
* folder; a value outside it is refused by the schema rather than silently
* falling back to another voice.
*/
const SPEECH_PROVIDERS = ["edge"];
/** Provider used when the user-settings document has no override. */
const DEFAULT_PROVIDER = "edge";
/** Edge defaults: the service always serves voices, so this block is never empty. */
const DEFAULT_EDGE_SETTINGS = Object.freeze({
	voice: "pt-BR-AntonioNeural",
	rate: 0,
	volume: 0,
	pitch: 0
});
/** Durable speech schema; also the wire envelope the browser scope validates against. */
const SpeechSettingsSchema = z.object({
	[PROVIDER_FIELD]: z.union([...SPEECH_PROVIDERS]).default(DEFAULT_PROVIDER),
	[SKIP_CODE_FIELD]: z.boolean().default(true),
	[EDGE_FIELD]: z.object({
		voice: z.string().default(DEFAULT_EDGE_SETTINGS.voice),
		rate: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.rate),
		volume: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.volume),
		pitch: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.pitch)
	}).default(DEFAULT_EDGE_SETTINGS)
});
/** The complete section with every default filled in. */
const DEFAULT_SPEECH_SETTINGS = Object.freeze({
	provider: DEFAULT_PROVIDER,
	skipCode: true,
	edge: DEFAULT_EDGE_SETTINGS
});
//#endregion
//#region lib/types/providers/edge/server.js
/**
* Microsoft Edge read-aloud provider. The free endpoint needs no account and no
* key, so it is the provider a deployment can use out of the box; the protocol
* itself (websocket handshake, request signing, audio framing) belongs to
* `msedge-tts`, which is MIT-licensed and maintained.
*/
/** Provider folder name and settings key. */
const ID = "edge";
/** Voice used when the settings name none; Edge ships voices for every language it serves. */
const DEFAULT_VOICE = "pt-BR-AntonioNeural";
/** Audio format requested from the service: 24 kHz mono MP3, the smallest stream it offers. */
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
/** Response content type matching {@link FORMAT}. */
const CONTENT_TYPE = "audio/mpeg";
/**
* Read one numeric tuning value, clamped to a range the service accepts.
* @param value - raw tuning value from settings.
* @param fallback - value used when the setting is absent or not a number.
* @param min - lowest accepted value.
* @param max - highest accepted value.
* @returns the clamped number.
*/
function number(value, fallback, min, max) {
	return Math.min(max, Math.max(min, typeof value === "number" && Number.isFinite(value) ? value : fallback));
}
/**
* Format one percentage delta the way Edge's SSML expects it.
* @param value - percentage from settings.
* @returns a signed percentage literal.
*/
function percent(value) {
	return `${value >= 0 ? "+" : ""}${value}%`;
}
//#endregion
//#region lib/types/providers/registry.js
/**
* The compiled-in provider roster. Each entry is one folder under `providers/`;
* adding a provider means adding its folder and one line here, and nothing else
* in the host changes.
*/
/** Every provider this host can call, in display order. */
const PROVIDERS = Object.freeze([{
	id: ID,
	/**
	* The service publishes its full voice list, so the settings row can offer
	* every language without the user typing a voice name.
	* @returns one entry per available voice.
	*/
	async voices() {
		return (await new MsEdgeTTS().getVoices()).map((voice) => ({
			id: voice.ShortName,
			name: voice.FriendlyName,
			language: voice.Locale,
			gender: voice.Gender
		}));
	},
	async synthesize(request, _credentials) {
		const voice = request.voice === "" ? DEFAULT_VOICE : request.voice;
		const rate = number(request.tuning["rate"], 0, -100, 100);
		const volume = number(request.tuning["volume"], 0, -100, 100);
		const pitch = number(request.tuning["pitch"], 0, -100, 100);
		const tts = new MsEdgeTTS();
		await tts.setMetadata(voice, FORMAT);
		const { audioStream } = tts.toStream(request.text, {
			rate: percent(rate),
			volume: percent(volume),
			pitch: `${pitch >= 0 ? "+" : ""}${pitch}Hz`
		});
		return {
			stream: audioStream,
			contentType: CONTENT_TYPE
		};
	}
}]);
/**
* Resolve one provider by its identifier.
* @param id - provider identifier from the settings or a request override.
* @returns the provider, or undefined when no folder claims that id.
*/
function providerById(id) {
	return PROVIDERS.find((provider) => provider.id === id);
}
//#endregion
//#region lib/types/selector.js
/**
* The speech selector: turns the durable settings section plus one request's
* overrides into the exact call a provider receives. This is the only place
* that knows how a settings block maps onto a provider, so a provider folder
* never reads settings and the HTTP route never names a vendor.
*/
/**
* Read the voice and tuning the durable block contributes.
* @param section - durable speech settings.
* @returns the block's voice and the tuning keys its provider declares.
*/
function blockOf(section) {
	return {
		voice: section.edge.voice,
		tuning: {
			rate: section.edge.rate,
			volume: section.edge.volume,
			pitch: section.edge.pitch
		}
	};
}
/**
* Resolve one synthesis call.
* @param section - durable speech settings.
* @param text - text to speak.
* @param overrides - optional preview overrides from the settings screen.
* @returns the provider and its request, or undefined when no folder claims the id.
*/
function selectSpeech(section, text, overrides = {}) {
	const provider = providerById(overrides.provider ?? section.provider);
	if (provider === void 0) return void 0;
	const block = blockOf(section);
	return {
		provider,
		request: {
			text,
			voice: overrides.voice ?? block.voice,
			tuning: {
				...block.tuning,
				...overrides.tuning
			}
		}
	};
}
//#endregion
//#region lib/types/speech-limits.js
/**
* Speech request bounds shared by the host route and the browser client. Both
* faces must agree, so the numbers live here instead of in each side: the
* browser packs its text to this size and the host refuses anything larger.
*/
/**
* Longest text one synthesis request may carry, in characters. A whole reply
* fits in one request by design — streaming needs the provider to receive the
* full text so it can start emitting audio for its first sentence — and the cap
* only bounds a single request.
*/
const MAX_TEXT_CHARS = 2e4;
//#endregion
//#region lib/types/speak-route.js
/**
* `POST /speech/speak`: the browser posts text, the host selects the provider
* from the durable settings and calls it with the deployment's credentials, and
* the audio streams straight back. Synthesis belongs to the host because the
* browser cannot hold an API key and cannot reach most providers across CORS.
*/
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
		if (size > MAX_BODY_BYTES) return void 0;
		chunks.push(buffer);
	}
	if (size === 0) return void 0;
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		return typeof parsed === "object" && parsed !== null ? parsed : void 0;
	} catch (_invalidJson) {
		return;
	}
}
/**
* Narrow one wire value to a tuning record.
* @param value - the request body's tuning member.
* @returns the record, or undefined when the body carried none.
*/
function tuningOf(value) {
	if (typeof value !== "object" || value === null) return void 0;
	return value;
}
/**
* Answer one synthesis request.
* @param req - the node:http request.
* @param res - the node:http response.
* @param ctx - host context carrying the settings service.
*/
async function serveSpeechRequest(req, res, ctx) {
	if (req.method !== "POST") {
		res.writeHead(405);
		res.end();
		return;
	}
	const body = await readBody(req);
	const text = typeof body?.text === "string" ? body.text : "";
	if (text === "" || text.length > 2e4) {
		res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify({ error: `text must be 1..${MAX_TEXT_CHARS} characters` }));
		return;
	}
	const section = ctx.get("settings")?.get(SPEECH_SETTINGS_NAMESPACE);
	const tuning = tuningOf(body?.tuning);
	const overrides = {
		...typeof body?.provider === "string" ? { provider: body.provider } : {},
		...typeof body?.voice === "string" ? { voice: body.voice } : {},
		...tuning === void 0 ? {} : { tuning }
	};
	const selected = selectSpeech(section ?? DEFAULT_SPEECH_SETTINGS, text, overrides);
	if (selected === void 0) {
		res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify({ error: `unknown speech provider "${String(overrides.provider ?? section?.provider)}"` }));
		return;
	}
	try {
		const audio = await selected.provider.synthesize(selected.request, {});
		res.writeHead(200, {
			"content-type": audio.contentType,
			"cache-control": "no-store, no-transform"
		});
		await pipeline(audio.stream, res);
	} catch (error) {
		if (res.headersSent) {
			res.destroy();
			return;
		}
		res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
	}
}
//#endregion
//#region lib/types/voices-route.js
/**
* `GET /speech/voices?provider=…`: the catalog the settings row lists. A
* provider that can enumerate its voices without an account answers here; one
* whose voices belong to the user's account is not listed at all rather than
* answering with an empty catalog.
*/
/**
* Answer one voice-catalog request.
* @param req - the node:http request.
* @param res - the node:http response.
*/
async function serveVoiceCatalog(req, res) {
	if (req.method !== "GET") {
		res.writeHead(405);
		res.end();
		return;
	}
	const id = new URL(req.url ?? "/", "http://x").searchParams.get("provider") ?? "edge";
	const voices = providerById(id)?.voices;
	if (voices === void 0) {
		res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify({ error: `provider "${id}" lists no voice catalog` }));
		return;
	}
	try {
		res.writeHead(200, {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-cache, no-transform"
		});
		res.end(JSON.stringify({ voices: await voices() }));
	} catch (error) {
		res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
	}
}
//#endregion
//#region lib/types/index.js
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
/** Stable Cordis plugin name. */
const name = "ui-speech";
/** The routes need the HTTP carrier, so the plugin waits for it. */
const inject = ["webServer"];
/**
* Register the durable speech preferences and claim the two speech routes.
* @param ctx - host context carrying the webServer service.
*/
function apply(ctx) {
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.register(SPEECH_SETTINGS_NAMESPACE, SpeechSettingsSchema);
	});
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: SPEECH_SPEAK_ROUTE,
		handler: (req, res) => serveSpeechRequest(req, res, ctx)
	}), "ui-speech: synthesis route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: SPEECH_VOICES_ROUTE,
		handler: serveVoiceCatalog
	}), "ui-speech: voice catalog route");
}
//#endregion
export { apply, inject, name };
