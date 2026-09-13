/**
 * Text chunking for read-aloud. A reply is normally sent as one request, so the
 * provider can stream audio while it works through the text; chunking only
 * applies to a reply larger than one request may carry, and to the fallback
 * path used when the browser cannot stream encoded audio.
 */

import { MAX_TEXT_CHARS } from '../speech-limits.ts'

/** Chunk size used when streaming is unavailable: one sentence per request. */
const SENTENCE_CHARS = 400

/** Break points preferred inside an over-long span, longest pause first. */
const SOFT_BREAKS: readonly string[] = ['. ', '! ', '? ', '; ', ': ', ', ', ' ']

/**
 * Split one text into sentence-sized spans.
 * @param text - projected spoken text.
 * @param limit - longest span to emit; a host that refuses a larger request reports its own bound.
 * @returns speakable spans, never empty strings.
 */
export function splitSentences(text: string, limit: number = SENTENCE_CHARS): readonly string[] {
  const spans: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    for (const sentence of trimmed.split(/(?<=[.!?…])\s+/)) {
      const piece = sentence.trim()
      if (piece === '') continue
      spans.push(...bounded(piece, limit))
    }
  }
  return spans
}

/**
 * Pack one text into requests: a single span when it fits, otherwise several
 * spans cut on sentence ends.
 * @param text - projected spoken text.
 * @returns one or more speakable requests, never empty strings.
 */
export function splitRequests(text: string): readonly string[] {
  const trimmed = text.trim()
  if (trimmed === '') return []
  if (trimmed.length <= MAX_TEXT_CHARS) return [trimmed]
  const packed: string[] = []
  let current = ''
  for (const sentence of splitSentences(trimmed)) {
    if (current !== '' && current.length + sentence.length + 1 > MAX_TEXT_CHARS) {
      packed.push(current)
      current = ''
    }
    current = current === '' ? sentence : `${current} ${sentence}`
  }
  if (current !== '') packed.push(current)
  return packed
}

/**
 * Cut one span down to a bound, preferring a soft break so the voice pauses
 * where the prose does.
 * @param text - one span, possibly longer than the bound.
 * @param limit - longest span to emit.
 * @returns one or more spans within the bound.
 */
function bounded(text: string, limit: number): readonly string[] {
  if (text.length <= limit) return [text]
  const pieces: string[] = []
  let rest = text
  while (rest.length > limit) {
    const window = rest.slice(0, limit)
    let cut = -1
    for (const breakPoint of SOFT_BREAKS) {
      const at = window.lastIndexOf(breakPoint)
      if (at > cut) cut = at + breakPoint.length - 1
    }
    const end = cut > 0 ? cut : limit
    pieces.push(rest.slice(0, end).trim())
    rest = rest.slice(end).trim()
  }
  if (rest !== '') pieces.push(rest)
  return pieces
}
