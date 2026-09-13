/**
 * Read-aloud text projection: what the voice says, which is not what the reader
 * reads. Kitsune phonemizes by rule, and its normalizer expands the symbols it
 * knows (currency, percent, degrees, math) while its tokenizer silently drops
 * the ones it does not — so an emoji, a link target, or a lone symbol reaches
 * the voice either as its spoken name or as a stray phoneme. This projection
 * keeps prose and sentence punctuation (the phonemizer uses it for pauses) and
 * removes the rest.
 *
 * The projection is pure: the same Markdown always yields the same spoken text,
 * so a message replayed from the log speaks identically.
 */
/** Options for the read-aloud projection. */
export interface SpeechTextOptions {
    /** Whether fenced code, inline code, and tables are dropped instead of read. */
    skipCode: boolean;
}
/**
 * Project Markdown onto the text a voice reads.
 * @param markdown - assistant message source.
 * @param options - whether code is dropped instead of read.
 * @returns whitespace-normalized spoken text, empty when nothing is speakable.
 */
export declare function speechText(markdown: string, options: SpeechTextOptions): string;
//# sourceMappingURL=speech-text.d.ts.map