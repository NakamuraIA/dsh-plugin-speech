/**
 * The SSML one synthesis request carries.
 *
 * It is built here, in one line, instead of through the client library's
 * template: that template indents every element and pads the text with
 * whitespace, and since late October 2026 the service drops the socket without
 * a word — no error frame, no audio, just a close — on some of those payloads.
 * The same request written compactly is answered normally, so the shape of the
 * markup is worth owning.
 */
/** Prosody that rides the request, in the units the service documents. */
export interface Prosody {
    /** Speaking rate as a percentage delta. */
    readonly rate: number;
    /** Volume as a percentage delta. */
    readonly volume: number;
    /** Pitch as a hertz delta. */
    readonly pitch: number;
}
/**
 * Escape one text node.
 * @param text - the words to speak.
 * @returns the text safe to place between tags.
 */
export declare function escapeSpeech(text: string): string;
/**
 * Read the locale a voice name announces.
 * @param voice - voice short name, for example `pt-BR-AntonioNeural`.
 * @returns the locale tag, or `en-US` when the name carries none.
 */
export declare function localeOf(voice: string): string;
/**
 * Render the SSML for one request. One line on purpose: see the module comment.
 * @param text - the words to speak, unescaped.
 * @param voice - voice short name.
 * @param prosody - rate, volume, and pitch deltas.
 * @returns the complete SSML document.
 */
export declare function speechSsml(text: string, voice: string, prosody: Prosody): string;
//# sourceMappingURL=ssml.d.ts.map