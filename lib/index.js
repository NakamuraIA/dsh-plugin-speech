import z from "@deepseek-ai/schemastery";
import { pipeline } from "node:stream/promises";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { Buffer as Buffer$1 } from "node:buffer";
import { randomUUID } from "node:crypto";
//#region src/routes.ts
/** The speech plugin's URL surface, owned in one place so routes cannot drift. */
/** Prefix serving the local engine, the ONNX runtime, and the voice model. */
const SPEECH_ROUTE = "/speech";
/** Exact route the browser posts synthesis requests to. */
const SPEECH_SPEAK_ROUTE = `${SPEECH_ROUTE}/speak`;
/** Exact route listing the selected provider's voices. */
const SPEECH_VOICES_ROUTE = `${SPEECH_ROUTE}/voices`;
//#endregion
//#region src/settings.ts
/**
* Durable speech preferences shared by the Host schema and the browser form.
*
* The schema is the plugin's Cordis `Config`, so it is also the settings form:
* the profile entry id (`ui-speech`) is the namespace, and every field the
* settings screen may edit is marked `.volatile()`. A field without that mark
* would still validate the composition, but the Host refuses to edit it.
*/
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
/**
* Durable speech schema and the plugin's Cordis `Config`. Every leaf is volatile,
* so the settings screen edits values in place instead of remounting the plugin.
*/
const SpeechSettingsSchema = z.object({
	[PROVIDER_FIELD]: z.union([...SPEECH_PROVIDERS]).default(DEFAULT_PROVIDER).volatile(),
	[SKIP_CODE_FIELD]: z.boolean().default(true).volatile(),
	[EDGE_FIELD]: z.object({
		voice: z.string().default(DEFAULT_EDGE_SETTINGS.voice).volatile(),
		rate: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.rate).volatile(),
		volume: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.volume).volatile(),
		pitch: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.pitch).volatile()
	}).default(DEFAULT_EDGE_SETTINGS)
});
/**
* Read one field of the resolved config. A volatile leaf is a live reference; a
* plain one is the value itself, which is what a field the profile layer left at
* its schema default may still be.
* @param field - one resolved config field.
* @returns the value the Host currently holds.
*/
function liveValue(field) {
	if (typeof field === "object" && field !== null && !Array.isArray(field)) {
		const getter = field.get;
		if (typeof getter === "function") return getter.call(field);
	}
	return field;
}
/**
* Read the whole config as the plain section the selector consumes, with every
* default filled in for a field the Host left unset.
* @param config - resolved Host config, absent when the entry declares none.
* @returns the durable speech settings.
*/
function speechSection(config) {
	const edge = config?.edge;
	return {
		provider: liveValue(config?.provider) ?? "edge",
		skipCode: liveValue(config?.skipCode) ?? true,
		edge: {
			voice: liveValue(edge?.voice) ?? DEFAULT_EDGE_SETTINGS.voice,
			rate: liveValue(edge?.rate) ?? DEFAULT_EDGE_SETTINGS.rate,
			volume: liveValue(edge?.volume) ?? DEFAULT_EDGE_SETTINGS.volume,
			pitch: liveValue(edge?.pitch) ?? DEFAULT_EDGE_SETTINGS.pitch
		}
	};
}
Object.freeze({
	provider: DEFAULT_PROVIDER,
	skipCode: true,
	edge: DEFAULT_EDGE_SETTINGS
});
//#endregion
//#region src/providers/edge/gec.ts
/**
* The `Sec-MS-GEC` token the Edge read-aloud endpoint demands.
*
* Until October 2026 the endpoint accepted the SHA-256 of
* `<windowsTicks><trustedClientToken>`. It then began requiring a second
* generation of the token: the same tick input, but digested by a deliberately
* modified SHA-256 and paired with a 64-bit checksum, formatted as
* `<16 hex>-<64 hex>`. The digest is not standard SHA-256 — round 14 carries a
* patched constant, two schedule words fold in corrections, and the first block
* of the message is built around a seven-byte prefix — so it is reproduced
* operation by operation from the reference implementation in `rany2/edge-tts`
* (`src/edge_tts/drm.py`), which is the port the service is known to accept.
*
* Every step is 32-bit arithmetic on purpose: the service recomputes the token
* and answers a bare 403 when a single bit disagrees, so the values here are
* compared against the reference rather than reasoned about.
*/
/** Trusted client token the free endpoint publishes; also its subscription key. */
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
/** Socket the browser's read-aloud feature connects to. */
const SYNTHESIS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
/**
* Chromium build the service expects the caller to claim. The leading `2` is the
* token generation; a first-generation tag is refused even with a valid token.
*/
const SEC_MS_GEC_VERSION = "2-143.0.3650.75";
/** Seconds between 1601-01-01 (Windows file time epoch) and 1970-01-01. */
const WINDOWS_EPOCH_SECONDS = 11644473600;
/** One thirty-two-bit word as an unsigned number. */
function u32(value) {
	return value >>> 0;
}
/** SHA-256 initial hash values. */
const SHA256_INITIAL = [
	1779033703,
	3144134277,
	1013904242,
	2773480762,
	1359893119,
	2600822924,
	528734635,
	1541459225
];
/** Working state after folding the seven-byte prefix into the message's first block. */
const SHA256_PREFIX_STATE = [
	4255104674,
	2435071207,
	3192492180,
	3442351626,
	1811967817,
	79508907,
	4272990180,
	66059218
];
/** Message-schedule words sixteen through twenty-nine for that first block. */
const SHA256_PREFIX_SCHEDULE = [
	3945054110,
	358115615,
	2696978146,
	217723578,
	2787307148,
	3520959633,
	3235718560,
	4192668342,
	4039316851,
	1884868174,
	1904797190,
	15051571,
	3529027680,
	1920361828
];
/** SHA-256 round constants, in FIPS 180-4 order. */
const SHA256_ROUND_CONSTANTS = [
	1116352408,
	1899447441,
	3049323471,
	3921009573,
	961987163,
	1508970993,
	2453635748,
	2870763221,
	3624381080,
	310598401,
	607225278,
	1426881987,
	1925078388,
	2162078206,
	2614888103,
	3248222580,
	3835390401,
	4022224774,
	264347078,
	604807628,
	770255983,
	1249150122,
	1555081692,
	1996064986,
	2554220882,
	2821834349,
	2952996808,
	3210313671,
	3336571891,
	3584528711,
	113926993,
	338241895,
	666307205,
	773529912,
	1294757372,
	1396182291,
	1695183700,
	1986661051,
	2177026350,
	2456956037,
	2730485921,
	2820302411,
	3259730800,
	3345764771,
	3516065817,
	3600352804,
	4094571909,
	275423344,
	430227734,
	506948616,
	659060556,
	883997877,
	958139571,
	1322822218,
	1537002063,
	1747873779,
	1955562222,
	2024104815,
	2227730452,
	2361852424,
	2428436474,
	2756734187,
	3204031479,
	3329325298
];
/** Replacement for round constant fourteen on the block that carries the prefix. */
const SHA256_PREFIX_ADJUSTMENT = 3386640039;
/** Round constants as the prefix block sees them: standard except round fourteen. */
const SHA256_PREFIX_CONSTANTS = [
	...SHA256_ROUND_CONSTANTS.slice(0, 14),
	SHA256_PREFIX_ADJUSTMENT,
	...SHA256_ROUND_CONSTANTS.slice(15)
];
/** Correction folded into message-schedule word sixteen. */
const SHA256_SIGMA0_ADJUSTMENT = 94112640;
/** Correction folded into message-schedule word twenty-nine. */
const SHA256_SIGMA1_ADJUSTMENT = 758464;
/** Multiply-shift coefficients of the 64-bit checksum, one pair per word. */
const CS64_COEFFICIENTS = [
	[3895366065, 3005677776],
	[1155409094, 2296378653],
	[1005282748, 693190712],
	[3365689651, 3005795295],
	[2367603217, 3557143765],
	[827258325, 652566332],
	[3911487921, 1618477510],
	[4037392853, 2192753147],
	[101076211, 4199654362],
	[3665427040, 545047652],
	[3201434976, 1010595059],
	[2314848760, 3536931681],
	[905590982, 3137643201],
	[3410617286, 3311559015]
];
/** Multiplier applied to both checksum keys. */
const CS64_FACTOR = 2190031155;
/** Addend folded into the first word's term. */
const CS64_ADJUSTMENT0 = 4076407578;
/** Addend folded into the first word's offset. */
const CS64_ADJUSTMENT1 = 186253312;
/** Rotate one word left by sixteen bits. */
function rotateLeft16(value) {
	return u32(u32(value) << 16 | u32(value) >>> 16);
}
/** Rotate one word right by `bits`. */
function rotateRight(value, bits) {
	return u32(u32(value) >>> bits | u32(value) << 32 - bits);
}
/** SHA-256's capital-sigma zero. */
function bigSigma0(value) {
	return u32(rotateRight(value, 2) ^ rotateRight(value, 13) ^ rotateRight(value, 22));
}
/** SHA-256's capital-sigma one. */
function bigSigma1(value) {
	return u32(rotateRight(value, 6) ^ rotateRight(value, 11) ^ rotateRight(value, 25));
}
/** SHA-256's small-sigma zero, truncated once after the combined shifts. */
function smallSigma0(value) {
	const word = u32(value);
	return u32(word >>> 7 ^ word << 25 ^ word >>> 18 ^ word << 14 ^ word >>> 3);
}
/** SHA-256's small-sigma one, truncated once after the combined shifts. */
function smallSigma1(value) {
	const word = u32(value);
	return u32(word >>> 17 ^ word << 15 ^ word >>> 19 ^ word << 13 ^ word >>> 10);
}
/** SHA-256's choose function. */
function choose(e, f, g) {
	return u32(g ^ e & (f ^ g));
}
/** SHA-256's majority function. */
function majority(a, b, c) {
	return u32(a & b | c & (a | b));
}
/**
* Expand a message schedule from word `first` up to sixty-four words.
* @param words - schedule words already known.
* @param first - first word to compute.
*/
function expandSchedule(words, first) {
	for (let index = first; index < 64; index += 1) words.push(u32(smallSigma1(words[index - 2]) + words[index - 7] + smallSigma0(words[index - 15]) + words[index - 16]));
}
/**
* Run the compression rounds, adding each round's working state into `state`.
* @param state - hash state the rounds start from.
* @param words - complete sixty-four-word message schedule.
* @param constants - round constants, indexed alongside `words`.
* @param first - first round to run; later rounds reuse the incoming state.
* @returns the eight working words to add into `state`.
*/
function rounds(state, words, constants, first = 0) {
	let [a, b, c, d, e, f, g, h] = state;
	for (let index = first; index < 64; index += 1) {
		const t1 = u32(h + bigSigma1(e) + choose(e, f, g) + constants[index] + words[index]);
		const t2 = u32(bigSigma0(a) + majority(a, b, c));
		h = g;
		g = f;
		f = e;
		e = u32(d + t1);
		d = c;
		c = b;
		b = a;
		a = u32(t1 + t2);
	}
	return [
		a,
		b,
		c,
		d,
		e,
		f,
		g,
		h
	];
}
/**
* Compute the state after the message's first block, which holds the seven-byte
* prefix and none of the text: the reference implementation precomputes the
* schedule words and the rounds before the prefix, and starts from there.
* @param prefix - the first seven bytes of the token input.
* @returns the hash state the remaining blocks continue from.
*/
function prefixState(prefix) {
	const words = new Array(14).fill(0);
	words.push(u32(prefix[0] << 16 | prefix[1] << 8 | prefix[2]));
	words.push(u32(prefix[3] << 24 | prefix[4] << 16 | prefix[5] << 8 | prefix[6]));
	for (let index = 16; index < 30; index += 1) {
		let value = SHA256_PREFIX_SCHEDULE[index - 16];
		if (index - 2 >= 14) {
			const sigma = smallSigma1(words[index - 2]);
			value += index === 16 ? u32(sigma ^ SHA256_SIGMA1_ADJUSTMENT) : sigma;
		}
		if (index - 7 >= 14) value += words[index - 7];
		if (index - 15 >= 14) {
			const sigma = smallSigma0(words[index - 15]);
			value += index === 29 ? u32(sigma ^ SHA256_SIGMA0_ADJUSTMENT) : sigma;
		}
		words.push(u32(value));
	}
	words.push(u32(smallSigma1(words[28]) + words[23] + smallSigma0(words[15]) + words[14] + SHA256_PREFIX_ADJUSTMENT - SHA256_ROUND_CONSTANTS[14]));
	expandSchedule(words, 31);
	const working = rounds(SHA256_PREFIX_STATE, words, SHA256_PREFIX_CONSTANTS, 14);
	return SHA256_INITIAL.map((initial, index) => u32(initial + working[index]));
}
/**
* Digest the token input the way the service does.
* @param data - the token input, at least seven bytes.
* @returns the thirty-two-byte digest.
*/
function tokenDigest(data) {
	const length = 57 + data.length;
	const tail = Buffer$1.concat([
		Buffer$1.from(data.subarray(7)),
		Buffer$1.from([128]),
		Buffer$1.alloc(((55 - length) % 64 + 64) % 64)
	]);
	const size = Buffer$1.alloc(8);
	size.writeBigUInt64BE(BigInt(length) * 8n);
	const padded = Buffer$1.concat([tail, size]);
	let state = prefixState(data.subarray(0, 7));
	for (let offset = 0; offset < padded.length; offset += 64) {
		const words = [];
		for (let index = 0; index < 16; index += 1) words.push(padded.readUInt32BE(offset + index * 4));
		expandSchedule(words, 16);
		const working = rounds(state, words, SHA256_ROUND_CONSTANTS);
		state = state.map((value, index) => u32(value + working[index]));
	}
	const digest = Buffer$1.alloc(32);
	state.forEach((word, index) => digest.writeUInt32BE(word, index * 4));
	return digest;
}
/**
* Compute the 64-bit checksum the token prefixes its digest with.
* @param data - the token input.
* @param digest - the digest of the same input, which keys both lanes.
* @returns the low and high checksum words.
*/
function checksum64(data, digest) {
	const keys = [u32(digest.readUInt32LE(0) | 1), u32(digest.readUInt32LE(4) | 1)];
	const factors = [u32(Math.imul(keys[0], CS64_FACTOR)), u32(Math.imul(keys[1], CS64_FACTOR))];
	const terms = CS64_COEFFICIENTS.map(([coefficient], index) => u32(Math.imul(coefficient, factors[index % 2])));
	const offsets = CS64_COEFFICIENTS.map(([, offset]) => offset);
	const prefixed = Buffer$1.concat([Buffer$1.alloc(1), Buffer$1.from(data)]);
	const sized = Buffer$1.concat([prefixed, Buffer$1.alloc((4 - prefixed.length % 4) % 4)]);
	const words = [];
	for (let offset = 0; offset < sized.length; offset += 4) words.push(sized.readUInt32LE(offset));
	if (words.length % 2 === 1) words.push(0);
	words.forEach((word, index) => {
		let term = u32(Math.imul(word, keys[index % 2]));
		let offset = u32(Math.imul(rotateLeft16(word), index % 2 === 0 ? 4010109435 : 3273069531));
		if (index === 0) {
			term = u32(term + Math.imul(CS64_ADJUSTMENT0, factors[0]));
			offset = u32(offset + CS64_ADJUSTMENT1);
		}
		terms.push(term);
		offsets.push(offset);
	});
	let swappedAccumulator = 0;
	let swappedLast = 0;
	let state = 0;
	let accumulator = 0;
	for (let index = 0; index < terms.length; index += 2) {
		const x = terms[index];
		const y = terms[index + 1];
		let lane = rotateLeft16(u32(offsets[index] + x));
		let product = u32(Math.imul(lane, 1995771700));
		swappedAccumulator = u32(swappedAccumulator + u32(Math.imul(rotateLeft16(product), 3287280279) + product));
		lane = rotateLeft16(u32(offsets[index + 1] + y));
		product = u32(Math.imul(lane, 411160124));
		swappedLast = u32(Math.imul(rotateLeft16(product), 901586633) + product);
		swappedAccumulator = u32(swappedAccumulator + swappedLast);
		state = u32(Math.imul(state, keys[0]) + x);
		state = u32(Math.imul(rotateLeft16(state), 3482890513));
		state = u32(Math.imul(rotateLeft16(state), 2265471903));
		state = u32(Math.imul(rotateLeft16(state), 315537773));
		state = u32(Math.imul(rotateLeft16(state), 629022083));
		accumulator = u32(accumulator + state);
		lane = u32(Math.imul(state, keys[1]) + y);
		lane = u32(Math.imul(rotateLeft16(lane), 2725517045));
		lane = u32(Math.imul(rotateLeft16(lane), 3548616447));
		state = u32(Math.imul(rotateLeft16(u32(Math.imul(rotateLeft16(lane), 2090019721))), 3215236969));
		accumulator = u32(accumulator + state);
	}
	return [u32(swappedLast ^ state), u32(swappedAccumulator ^ accumulator)];
}
/**
* Build the string both halves of the token digest.
* @param nowMs - wall clock in milliseconds.
* @returns the tick value rounded down to five minutes, then the client token.
*/
function tokenInput(nowMs) {
	let ticks = Math.floor(nowMs / 1e3) + WINDOWS_EPOCH_SECONDS;
	ticks -= ticks % 300;
	return Buffer$1.from(`${ticks * 1e7}${TRUSTED_CLIENT_TOKEN}`, "ascii");
}
/**
* Build one `Sec-MS-GEC` value. Valid for the five-minute window it names.
* @param nowMs - wall clock in milliseconds.
* @returns the token, `<16 hex>-<64 hex>`.
*/
function secMsGec(nowMs) {
	const data = tokenInput(nowMs);
	const digest = tokenDigest(data);
	const [low, high] = checksum64(data, digest);
	const checksum = Buffer$1.alloc(8);
	checksum.writeUInt32LE(low >>> 0, 0);
	checksum.writeUInt32LE(high >>> 0, 4);
	return `${checksum.toString("hex").toUpperCase()}-${digest.toString("hex").toUpperCase()}`;
}
/**
* Build the socket URL one synthesis request connects to, token included.
* @param nowMs - wall clock in milliseconds; the token is minted from it.
* @returns the complete `wss:` URL.
*/
function synthUrl(nowMs = Date.now()) {
	const connectionId = randomUUID().replaceAll("-", "");
	const query = new URLSearchParams({
		TrustedClientToken: TRUSTED_CLIENT_TOKEN,
		"Sec-MS-GEC": secMsGec(nowMs),
		"Sec-MS-GEC-Version": SEC_MS_GEC_VERSION,
		ConnectionId: connectionId
	});
	return `${SYNTHESIS_URL}?${query.toString()}`;
}
//#endregion
//#region src/providers/edge/server.ts
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
* Point the library at {@link synthUrl}. Its socket URL comes from a private
* static keyed to its own class name, so a subclass cannot reach it: replacing
* the static is the one seam that decides the token the handshake carries. The
* library builds a first-generation token, which the service refuses with a
* bare 403 since October 2026, and it also stamps the token version as `1-…`;
* `synthUrl` supplies both the accepted token and the accepted version.
*
* Installed at module load because every client this provider constructs must
* inherit it, and the replacement is a pure function of the clock.
*/
const library = MsEdgeTTS;
library.getSynthUrl = async () => synthUrl();
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
//#region src/providers/registry.ts
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
//#region src/selector.ts
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
//#region src/speech-limits.ts
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
//#region src/speak-route.ts
/** Largest request body accepted; one reply is far below this. */
const MAX_BODY_BYTES = 262144;
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
* @param section - reads the live preferences of this plugin's entry.
*/
async function serveSpeechRequest(req, res, section) {
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
	const tuning = tuningOf(body?.tuning);
	const overrides = {
		...typeof body?.provider === "string" ? { provider: body.provider } : {},
		...typeof body?.voice === "string" ? { voice: body.voice } : {},
		...tuning === void 0 ? {} : { tuning }
	};
	const selected = selectSpeech(section(), text, overrides);
	if (selected === void 0) {
		res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify({ error: "unknown speech provider" }));
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
//#region src/voices-route.ts
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
//#region src/index.ts
/** Stable Cordis plugin name. */
const name = "ui-speech";
/** The routes need the HTTP carrier, so the plugin waits for it. */
const inject = ["webServer"];
/**
* The plugin's Cordis config, which is also its settings form: the Host exposes
* every volatile field of this schema under the `ui-speech` entry.
*/
const Config = SpeechSettingsSchema;
/**
* Claim the two speech routes. The preferences are read through the config the
* Loader resolved for this entry, so nothing has to be registered elsewhere.
* @param ctx - host context carrying the webServer service.
* @param config - resolved entry config holding the live preferences.
*/
function apply(ctx, config) {
	const section = () => speechSection(config);
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: SPEECH_SPEAK_ROUTE,
		handler: (req, res) => serveSpeechRequest(req, res, section)
	}), "ui-speech: synthesis route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: SPEECH_VOICES_ROUTE,
		handler: serveVoiceCatalog
	}), "ui-speech: voice catalog route");
}
//#endregion
export { Config, apply, inject, name };
