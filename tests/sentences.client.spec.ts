/** Read-aloud chunking: one request for a reply, many only when forced. */
import { describe, expect, it } from 'vitest'
import { splitRequests, splitSentences } from '../src/client/sentences.ts'
import { MAX_TEXT_CHARS } from '../src/speech-limits.ts'

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

describe('splitRequests', () => {
  it('packs a whole reply into one request', () => {
    expect(splitRequests('Uma resposta curta.')).toEqual(['Uma resposta curta.'])
  })

  it('returns nothing for blank text', () => {
    expect(splitRequests('   ')).toEqual([])
  })

  it('packs several sentences into requests that stay under the bound', () => {
    const sentences = 'Frase de teste. '.repeat(3000)
    const requests = splitRequests(sentences)
    expect(requests.length).toBeGreaterThan(1)
    for (const request of requests) expect(request.length).toBeLessThanOrEqual(MAX_TEXT_CHARS)
    expect(requests.join(' ').replace(/\s+/g, ' ')).toBe(sentences.trim().replace(/\s+/g, ' '))
  })
})
