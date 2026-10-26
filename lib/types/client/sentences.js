/**
 * Text chunking for read-aloud: every synthesis request carries one span, so a
 * dropped connection can only cost the segment it was carrying.
 */
/** Longest span one request carries. */
const SENTENCE_CHARS = 400;
/** Break points preferred inside an over-long span, longest pause first. */
const SOFT_BREAKS = ['. ', '! ', '? ', '; ', ': ', ', ', ' '];
/**
 * Split one text into sentence-sized spans.
 * @param text - projected spoken text.
 * @param limit - longest span to emit; a host that refuses a larger request reports its own bound.
 * @returns speakable spans, never empty strings.
 */
export function splitSentences(text, limit = SENTENCE_CHARS) {
    const spans = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '')
            continue;
        // The split consumes the whitespace it cuts on, and the line is already
        // trimmed, so every piece carries text and needs no further filtering.
        for (const sentence of trimmed.split(/(?<=[.!?…])\s+/)) {
            spans.push(...bounded(sentence, limit));
        }
    }
    return spans;
}
/**
 * Cut one span down to a bound, preferring a soft break so the voice pauses
 * where the prose does.
 * @param text - one span, possibly longer than the bound.
 * @param limit - longest span to emit.
 * @returns one or more spans within the bound.
 */
function bounded(text, limit) {
    if (text.length <= limit)
        return [text];
    const pieces = [];
    let rest = text;
    while (rest.length > limit) {
        const window = rest.slice(0, limit);
        let cut = -1;
        for (const breakPoint of SOFT_BREAKS) {
            const at = window.lastIndexOf(breakPoint);
            if (at > cut)
                cut = at + breakPoint.length - 1;
        }
        const end = cut > 0 ? cut : limit;
        pieces.push(rest.slice(0, end).trim());
        rest = rest.slice(end).trim();
    }
    // A cut always leaves the text that followed the break, and callers hand in
    // trimmed spans, so `rest` is never blank here.
    pieces.push(rest);
    return pieces;
}
//# sourceMappingURL=sentences.js.map