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
  skipCode: boolean
}

/**
 * Emoji and the code points that only exist to compose them: variation
 * selectors, joiners, skin-tone modifiers, and keycap marks.
 */
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu

/** Flag emoji are regional-indicator pairs with no pictographic property of their own. */
const REGIONAL_INDICATORS = /[\u{1F1E6}-\u{1F1FF}]/gu

/** Fenced code blocks, with or without an info string. */
const FENCE = /^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm

/** Inline code spans. */
const INLINE_CODE = /`[^`\n]*`/g

/** HTML tags, including autolinks: both are markup, never speech. */
const TAG = /<[^>\n]*>/g

/** Markdown images: neither the file target nor its alt text is speech. */
const IMAGE = /!\[[^\]]*\]\([^)\s]*(?:\s+"[^"]*")?\)/g

/** Markdown and reference links: the label is speech, the target is not. */
const LINK = /\[([^\]]*)\]\((?:[^)\s]*)(?:\s+"[^"]*")?\)/g
const REFERENCE_LINK = /\[([^\]]*)\]\[[^\]]*\]/g

/** Footnote and citation markers (`[1]`, `[^1]`). */
const FOOTNOTE = /\[\^?\d+\]/g

/** Bare URLs the prose carries without link syntax. */
const BARE_URL = /\b(?:https?:\/\/|www\.)\S+/gi

/** Line-leading Markdown markers: headings, quotes, and list bullets. */
const LINE_MARKER = /^[ \t]*(?:#{1,6}|>|[-*+]|\d+[.)])[ \t]+/gm

/** Table rows and their separator lines. */
const TABLE_ROW = /^[ \t]*\|.*\|[ \t]*$/gm
const TABLE_SEPARATOR = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm

/**
 * Pasted spreadsheet rows. A line carrying three or more tab stops is a range
 * copy, not prose, and reading it aloud is noise.
 */
const SHEET_ROW = /^.*\t.*\t.*\t.*$/gm

/**
 * Quotation marks of both families. A voice never speaks them, and the
 * phonemizer turns some of them into stray phonemes.
 */
const QUOTES = /["'«»“”‘’]/g

/**
 * Emphasis markers that wrap a word. The lookarounds leave an operator between
 * two characters alone, so `2*3` still reaches the normalizer's math rule, and
 * a closing run may be followed by the sentence's punctuation.
 */
const EMPHASIS = /(?<=^|\s)[*_~]{1,3}(?=\S)|(?<=\S)[*_~]{1,3}(?=$|\s|[.,;:!?)\]])/gm

/** Whether one token carries a letter or a digit, and so has something to say. */
const SPEAKABLE = /[\p{L}\p{N}]/u

/** Leftover bracket pairs whose content was dropped. */
const EMPTY_PAIR = /\(\s*\)|\[\s*\]|\{\s*\}/g

/**
 * Project Markdown onto the text a voice reads.
 * @param markdown - assistant message source.
 * @param options - whether code is dropped instead of read.
 * @returns whitespace-normalized spoken text, empty when nothing is speakable.
 */
export function speechText(markdown: string, options: SpeechTextOptions): string {
  let text = markdown.replace(/\r\n?/g, '\n')
  if (options.skipCode) {
    text = text.replace(FENCE, '\n').replace(INLINE_CODE, ' ')
  } else {
    // The fences and spans go, their contents stay: the reader asked for code.
    text = text.replace(FENCE, block => block.replace(/^```[^\n]*\n?|^```[^\n]*$/gm, '\n'))
      .replace(INLINE_CODE, span => span.slice(1, -1))
  }
  text = text
    // Tables and pasted sheets are never spoken, whatever the code setting says:
    // a voice reading cells is noise in every reading mode.
    .replace(TABLE_ROW, '\n')
    .replace(TABLE_SEPARATOR, '\n')
    .replace(SHEET_ROW, '\n')
    .replace(TAG, ' ')
    .replace(IMAGE, ' ')
    .replace(LINK, '$1')
    .replace(REFERENCE_LINK, '$1')
    .replace(FOOTNOTE, ' ')
    .replace(BARE_URL, ' ')
    .replace(LINE_MARKER, '')
    .replace(EMPHASIS, '')
    .replace(EMOJI, '')
    .replace(REGIONAL_INDICATORS, '')
    .replace(QUOTES, '')
  return text
    .split('\n')
    .map(line => line.split(/\s+/).filter(word => SPEAKABLE.test(word)).join(' '))
    .filter(line => line !== '')
    .join('\n')
    .replace(EMPTY_PAIR, ' ')
    .trim()
}
