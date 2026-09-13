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
export const MAX_TEXT_CHARS = 20_000
