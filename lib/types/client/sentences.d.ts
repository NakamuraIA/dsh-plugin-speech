/**
 * Text chunking for read-aloud: every synthesis request carries one span, so a
 * dropped connection can only cost the segment it was carrying.
 */
/**
 * Split one text into sentence-sized spans.
 * @param text - projected spoken text.
 * @param limit - longest span to emit; a host that refuses a larger request reports its own bound.
 * @returns speakable spans, never empty strings.
 */
export declare function splitSentences(text: string, limit?: number): readonly string[];
//# sourceMappingURL=sentences.d.ts.map