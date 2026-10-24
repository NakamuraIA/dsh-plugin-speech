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
/** Trusted client token the free endpoint publishes; also its subscription key. */
export declare const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
/** Socket the browser's read-aloud feature connects to. */
export declare const SYNTHESIS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
/**
 * Chromium build the service expects the caller to claim. The leading `2` is the
 * token generation; a first-generation tag is refused even with a valid token.
 */
export declare const SEC_MS_GEC_VERSION = "2-143.0.3650.75";
/**
 * Digest the token input the way the service does.
 * @param data - the token input, at least seven bytes.
 * @returns the thirty-two-byte digest.
 */
export declare function tokenDigest(data: Uint8Array): Buffer;
/**
 * Compute the 64-bit checksum the token prefixes its digest with.
 * @param data - the token input.
 * @param digest - the digest of the same input, which keys both lanes.
 * @returns the low and high checksum words.
 */
export declare function checksum64(data: Uint8Array, digest: Buffer): readonly [number, number];
/**
 * Build the string both halves of the token digest.
 * @param nowMs - wall clock in milliseconds.
 * @returns the tick value rounded down to five minutes, then the client token.
 */
export declare function tokenInput(nowMs: number): Buffer;
/**
 * Build one `Sec-MS-GEC` value. Valid for the five-minute window it names.
 * @param nowMs - wall clock in milliseconds.
 * @returns the token, `<16 hex>-<64 hex>`.
 */
export declare function secMsGec(nowMs: number): string;
/**
 * Build the socket URL one synthesis request connects to, token included.
 * @param nowMs - wall clock in milliseconds; the token is minted from it.
 * @returns the complete `wss:` URL.
 */
export declare function synthUrl(nowMs?: number): string;
//# sourceMappingURL=gec.d.ts.map