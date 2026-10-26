/**
 * Bound on one synthesis request. The browser sends a few hundred characters per
 * request by design — a dropped connection then costs only that segment — so this
 * cap exists for everything else that posts to the route: a request far larger
 * than a segment is a bug or an abusive caller, not a reply.
 */
/** Longest text one synthesis request may carry, in characters. */
export declare const MAX_TEXT_CHARS = 20000;
//# sourceMappingURL=speech-limits.d.ts.map