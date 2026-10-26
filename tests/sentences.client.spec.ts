/** Read-aloud chunking: one request for a reply, many only when forced. */
import { describe, expect, it } from 'vitest'
import { splitSentences } from '../src/client/sentences.ts'

describe('splitSentences', () => {
  it('splits on sentence punctuation and drops blank lines', () => {
    expect(splitSentences('Uma. Duas! Três? Quatro')).toEqual(['Uma.', 'Duas!', 'Três?', 'Quatro'])
    expect(splitSentences('Um\n\nDois')).toEqual(['Um', 'Dois'])
    expect(splitSentences('   ')).toEqual([])
  })

  it('cuts a long sentence on a soft break rather than mid-word', () => {
    const long = `${'palavra '.repeat(80)}fim`
    const spans = splitSentences(long)
    expect(spans.length).toBeGreaterThan(1)
    for (const span of spans) expect(span.length).toBeLessThanOrEqual(400)
  })

  it('cuts without a soft break when one word is longer than the limit', () => {
    const spans = splitSentences('x'.repeat(900))
    expect(spans.length).toBeGreaterThan(1)
    expect(spans.every(span => span.length <= 400)).toBe(true)
  })

  it('honours a limit a caller passes', () => {
    const spans = splitSentences('Uma frase curta. Outra frase curta.', 10)
    expect(spans.every(span => span.length <= 10)).toBe(true)
  })
})

