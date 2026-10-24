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
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
/** Trusted client token the free endpoint publishes; also its subscription key. */
export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
/** Socket the browser's read-aloud feature connects to. */
export const SYNTHESIS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
/**
 * Chromium build the service expects the caller to claim. The leading `2` is the
 * token generation; a first-generation tag is refused even with a valid token.
 */
export const SEC_MS_GEC_VERSION = '2-143.0.3650.75';
/** Seconds between 1601-01-01 (Windows file time epoch) and 1970-01-01. */
const WINDOWS_EPOCH_SECONDS = 11644473600;
/** One thirty-two-bit word as an unsigned number. */
function u32(value) {
    return value >>> 0;
}
/** SHA-256 initial hash values. */
const SHA256_INITIAL = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
/** Working state after folding the seven-byte prefix into the message's first block. */
const SHA256_PREFIX_STATE = [
    0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
];
/** Message-schedule words sixteen through twenty-nine for that first block. */
const SHA256_PREFIX_SCHEDULE = [
    0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491, 0xc0dd25a0,
    0xf9e70ab6, 0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33, 0xd258b060, 0x72766564,
];
/** SHA-256 round constants, in FIPS 180-4 order. */
const SHA256_ROUND_CONSTANTS = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
/** Replacement for round constant fourteen on the block that carries the prefix. */
const SHA256_PREFIX_ADJUSTMENT = 0xc9dc06a7;
/** Round constants as the prefix block sees them: standard except round fourteen. */
const SHA256_PREFIX_CONSTANTS = [
    ...SHA256_ROUND_CONSTANTS.slice(0, 14),
    SHA256_PREFIX_ADJUSTMENT,
    ...SHA256_ROUND_CONSTANTS.slice(15),
];
/** Correction folded into message-schedule word sixteen. */
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80;
/** Correction folded into message-schedule word twenty-nine. */
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0;
/** Multiply-shift coefficients of the 64-bit checksum, one pair per word. */
const CS64_COEFFICIENTS = [
    [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d], [0x3beb65bc, 0x29514038],
    [0xc89c5933, 0xb328cbdf], [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c],
    [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb], [0x06064cf3, 0xfa51a3da],
    [0xda79fa60, 0x207cc464], [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
    [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
];
/** Multiplier applied to both checksum keys. */
const CS64_FACTOR = 0x82893933;
/** Addend folded into the first word's term. */
const CS64_ADJUSTMENT0 = 0xf2f90b1a;
/** Addend folded into the first word's offset. */
const CS64_ADJUSTMENT1 = 0x0b1a0000;
/** Rotate one word left by sixteen bits. */
function rotateLeft16(value) {
    return u32((u32(value) << 16) | (u32(value) >>> 16));
}
/** Rotate one word right by `bits`. */
function rotateRight(value, bits) {
    return u32((u32(value) >>> bits) | (u32(value) << (32 - bits)));
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
    return u32((word >>> 7) ^ (word << 25) ^ (word >>> 18) ^ (word << 14) ^ (word >>> 3));
}
/** SHA-256's small-sigma one, truncated once after the combined shifts. */
function smallSigma1(value) {
    const word = u32(value);
    return u32((word >>> 17) ^ (word << 15) ^ (word >>> 19) ^ (word << 13) ^ (word >>> 10));
}
/** SHA-256's choose function. */
function choose(e, f, g) {
    return u32(g ^ (e & (f ^ g)));
}
/** SHA-256's majority function. */
function majority(a, b, c) {
    return u32((a & b) | (c & (a | b)));
}
/**
 * Expand a message schedule from word `first` up to sixty-four words.
 * @param words - schedule words already known.
 * @param first - first word to compute.
 */
function expandSchedule(words, first) {
    for (let index = first; index < 64; index += 1) {
        words.push(u32(smallSigma1(words[index - 2])
            + words[index - 7]
            + smallSigma0(words[index - 15])
            + words[index - 16]));
    }
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
    return [a, b, c, d, e, f, g, h];
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
    words.push(u32((prefix[0] << 16) | (prefix[1] << 8) | prefix[2]));
    words.push(u32((prefix[3] << 24) | (prefix[4] << 16) | (prefix[5] << 8) | prefix[6]));
    for (let index = 16; index < 30; index += 1) {
        let value = SHA256_PREFIX_SCHEDULE[index - 16];
        if (index - 2 >= 14) {
            const sigma = smallSigma1(words[index - 2]);
            value += index === 16 ? u32(sigma ^ SHA256_SIGMA1_ADJUSTMENT) : sigma;
        }
        if (index - 7 >= 14)
            value += words[index - 7];
        if (index - 15 >= 14) {
            const sigma = smallSigma0(words[index - 15]);
            value += index === 29 ? u32(sigma ^ SHA256_SIGMA0_ADJUSTMENT) : sigma;
        }
        words.push(u32(value));
    }
    words.push(u32(smallSigma1(words[28])
        + words[23]
        + smallSigma0(words[15])
        + words[14]
        + SHA256_PREFIX_ADJUSTMENT
        - SHA256_ROUND_CONSTANTS[14]));
    expandSchedule(words, 31);
    const working = rounds(SHA256_PREFIX_STATE, words, SHA256_PREFIX_CONSTANTS, 14);
    return SHA256_INITIAL.map((initial, index) => u32(initial + working[index]));
}
/**
 * Digest the token input the way the service does.
 * @param data - the token input, at least seven bytes.
 * @returns the thirty-two-byte digest.
 */
export function tokenDigest(data) {
    const length = 57 + data.length;
    const tail = Buffer.concat([
        Buffer.from(data.subarray(7)),
        Buffer.from([0x80]),
        Buffer.alloc((((55 - length) % 64) + 64) % 64),
    ]);
    const size = Buffer.alloc(8);
    size.writeBigUInt64BE(BigInt(length) * 8n);
    const padded = Buffer.concat([tail, size]);
    let state = prefixState(data.subarray(0, 7));
    for (let offset = 0; offset < padded.length; offset += 64) {
        const words = [];
        for (let index = 0; index < 16; index += 1)
            words.push(padded.readUInt32BE(offset + index * 4));
        expandSchedule(words, 16);
        const working = rounds(state, words, SHA256_ROUND_CONSTANTS);
        state = state.map((value, index) => u32(value + working[index]));
    }
    const digest = Buffer.alloc(32);
    state.forEach((word, index) => digest.writeUInt32BE(word, index * 4));
    return digest;
}
/**
 * Compute the 64-bit checksum the token prefixes its digest with.
 * @param data - the token input.
 * @param digest - the digest of the same input, which keys both lanes.
 * @returns the low and high checksum words.
 */
export function checksum64(data, digest) {
    const keys = [u32(digest.readUInt32LE(0) | 1), u32(digest.readUInt32LE(4) | 1)];
    const factors = [u32(Math.imul(keys[0], CS64_FACTOR)), u32(Math.imul(keys[1], CS64_FACTOR))];
    const terms = CS64_COEFFICIENTS.map(([coefficient], index) => u32(Math.imul(coefficient, factors[index % 2])));
    const offsets = CS64_COEFFICIENTS.map(([, offset]) => offset);
    // A zero byte leads the input, then it is read as little-endian words of an
    // even count; both details are the reference's, not a choice here.
    const prefixed = Buffer.concat([Buffer.alloc(1), Buffer.from(data)]);
    const sized = Buffer.concat([prefixed, Buffer.alloc((4 - (prefixed.length % 4)) % 4)]);
    const words = [];
    for (let offset = 0; offset < sized.length; offset += 4)
        words.push(sized.readUInt32LE(offset));
    if (words.length % 2 === 1)
        words.push(0);
    words.forEach((word, index) => {
        let term = u32(Math.imul(word, keys[index % 2]));
        let offset = u32(Math.imul(rotateLeft16(word), index % 2 === 0 ? 0xef0569fb : 0xc31713db));
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
        let product = u32(Math.imul(lane, 0x76f50f34));
        swappedAccumulator = u32(swappedAccumulator + u32(Math.imul(rotateLeft16(product), 0xc3efea97) + product));
        lane = rotateLeft16(u32(offsets[index + 1] + y));
        product = u32(Math.imul(lane, 0x1881ce3c));
        swappedLast = u32(Math.imul(rotateLeft16(product), 0x35bd1ec9) + product);
        swappedAccumulator = u32(swappedAccumulator + swappedLast);
        state = u32(Math.imul(state, keys[0]) + x);
        state = u32(Math.imul(rotateLeft16(state), 0xcf98b111));
        state = u32(Math.imul(rotateLeft16(state), 0x87085b9f));
        state = u32(Math.imul(rotateLeft16(state), 0x12ceb96d));
        state = u32(Math.imul(rotateLeft16(state), 0x257e1d83));
        accumulator = u32(accumulator + state);
        lane = u32(Math.imul(state, keys[1]) + y);
        lane = u32(Math.imul(rotateLeft16(lane), 0xa27416f5));
        lane = u32(Math.imul(rotateLeft16(lane), 0xd38396ff));
        state = u32(Math.imul(rotateLeft16(u32(Math.imul(rotateLeft16(lane), 0x7c932b89))), 0xbfa49f69));
        accumulator = u32(accumulator + state);
    }
    return [u32(swappedLast ^ state), u32(swappedAccumulator ^ accumulator)];
}
/**
 * Build the string both halves of the token digest.
 * @param nowMs - wall clock in milliseconds.
 * @returns the tick value rounded down to five minutes, then the client token.
 */
export function tokenInput(nowMs) {
    let ticks = Math.floor(nowMs / 1000) + WINDOWS_EPOCH_SECONDS;
    ticks -= ticks % 300;
    return Buffer.from(`${ticks * 1e7}${TRUSTED_CLIENT_TOKEN}`, 'ascii');
}
/**
 * Build one `Sec-MS-GEC` value. Valid for the five-minute window it names.
 * @param nowMs - wall clock in milliseconds.
 * @returns the token, `<16 hex>-<64 hex>`.
 */
export function secMsGec(nowMs) {
    const data = tokenInput(nowMs);
    const digest = tokenDigest(data);
    const [low, high] = checksum64(data, digest);
    const checksum = Buffer.alloc(8);
    checksum.writeUInt32LE(low >>> 0, 0);
    checksum.writeUInt32LE(high >>> 0, 4);
    return `${checksum.toString('hex').toUpperCase()}-${digest.toString('hex').toUpperCase()}`;
}
/**
 * Build the socket URL one synthesis request connects to, token included.
 * @param nowMs - wall clock in milliseconds; the token is minted from it.
 * @returns the complete `wss:` URL.
 */
export function synthUrl(nowMs = Date.now()) {
    // The service ignores a connection id's dashes, but the browser's own client
    // sends a bare one, so this matches what the endpoint is used to seeing.
    const connectionId = randomUUID().replaceAll('-', '');
    const query = new URLSearchParams({
        TrustedClientToken: TRUSTED_CLIENT_TOKEN,
        'Sec-MS-GEC': secMsGec(nowMs),
        'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION,
        ConnectionId: connectionId,
    });
    return `${SYNTHESIS_URL}?${query.toString()}`;
}
//# sourceMappingURL=gec.js.map