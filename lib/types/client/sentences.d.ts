/**
 * Text chunking for read-aloud. A reply is normally sent as one request, so the
 * provider can stream audio while it works through the text; chunking only
 * applies to a reply larger than one request may carry, and to the fallback
 * path used when the browser cannot stream encoded audio.
 */
/**
 * Split one text into sentence-sized spans.
 * @param text - projected spoken text.
 * @param limit - longest span to emit; a host that refuses a larger request reports its own bound.
 * @returns speakable spans, never empty strings.
 */
export declare function splitSentences(text: string, limit?: number): readonly string[];
/**
 * Pack one text into requests: a single span when it fits, otherwise several
 * spans cut on sentence ends.
 * @param text - projected spoken text.
 * @returns one or more speakable requests, never empty strings.
 */
export declare function splitRequests(text: string): readonly string[];
//# sourceMappingURL=sentences.d.ts.map