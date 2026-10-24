/**
 * Microsoft Edge read-aloud provider. The free endpoint needs no account and no
 * key, so it is the provider a deployment can use out of the box; the protocol
 * itself (websocket handshake, request signing, audio framing) belongs to
 * `msedge-tts`, which is MIT-licensed and maintained.
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { synthUrl } from "./gec.js";
/** Provider folder name and settings key. */
export const ID = 'edge';
/** Voice used when the settings name none; Edge ships voices for every language it serves. */
export const DEFAULT_VOICE = 'pt-BR-AntonioNeural';
/**
 * Encodings this provider answers in, each pairing the format string the service
 * wants with the response label that matches it.
 *
 * MP3 is the smallest stream the service offers and plays anywhere, whole file
 * or blob. WebM/Opus is here for one reason: `MediaSource` in Chromium refuses
 * MP3 and accepts Opus, and MediaSource is the only way a browser plays audio
 * *while* it arrives — without it a reply has to be spoken sentence by sentence,
 * which puts a fresh WebSocket handshake inside every pause.
 */
const AUDIO_FORMATS = {
    mp3: { output: OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, contentType: 'audio/mpeg' },
    webm: { output: OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS, contentType: 'audio/webm' },
};
/** Encoding used when the caller names none, which is every caller that buffers. */
const DEFAULT_FORMAT = 'mp3';
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
    const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.min(max, Math.max(min, parsed));
}
/**
 * Format one percentage delta the way Edge's SSML expects it.
 * @param value - percentage from settings.
 * @returns a signed percentage literal.
 */
function percent(value) {
    return `${value >= 0 ? '+' : ''}${value}%`;
}
/** The Edge read-aloud provider. */
export const edgeProvider = {
    id: ID,
    /**
     * The service publishes its full voice list, so the settings row can offer
     * every language without the user typing a voice name.
     * @returns one entry per available voice.
     */
    async voices() {
        const voices = await new MsEdgeTTS().getVoices();
        return voices.map(voice => ({
            id: voice.ShortName,
            name: voice.FriendlyName,
            language: voice.Locale,
            gender: voice.Gender,
        }));
    },
    async synthesize(request, _credentials) {
        const voice = request.voice === '' ? DEFAULT_VOICE : request.voice;
        const rate = number(request.tuning['rate'], 0, -100, 100);
        const volume = number(request.tuning['volume'], 0, -100, 100);
        const pitch = number(request.tuning['pitch'], 0, -100, 100);
        const target = AUDIO_FORMATS[request.format ?? DEFAULT_FORMAT];
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, target.output);
        // Prosody rides the request, so one client instance serves every tuning.
        const { audioStream } = tts.toStream(request.text, {
            rate: percent(rate),
            volume: percent(volume),
            pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz`,
        });
        return { stream: audioStream, contentType: target.contentType };
    },
};
//# sourceMappingURL=server.js.map