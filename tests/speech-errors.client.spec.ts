/** Failure classification shared by the route and the browser. */
import { describe, expect, it } from 'vitest'
import { errorCodeOf, SpeechError, tagError } from '../src/speech-errors.ts'

describe('errorCodeOf', () => {
  it('reads the status the handshake error carries', () => {
    expect(errorCodeOf(Object.assign(new Error('recusado'), { statusCode: 403 }))).toBe('endpoint')
  })

  it('reads a status nested in the cause', () => {
    expect(errorCodeOf({ cause: { statusCode: 403 } })).toBe('endpoint')
  })

  it('reads the message the websocket library builds', () => {
    expect(errorCodeOf(new Error('Unexpected server response: 403'))).toBe('endpoint')
  })

  it('leaves an ordinary failure unclassified', () => {
    expect(errorCodeOf(new Error('serviço fora do ar'))).toBeUndefined()
    expect(errorCodeOf('caiu feio')).toBeUndefined()
    expect(errorCodeOf(undefined)).toBeUndefined()
  })

  it('does not read 403 out of an unrelated status', () => {
    expect(errorCodeOf(Object.assign(new Error('not found'), { statusCode: 404 }))).toBeUndefined()
  })
})

describe('tagError', () => {
  it('keeps the message and adds the class', () => {
    const tagged = tagError(Object.assign(new Error('Unexpected server response: 403'), { statusCode: 403 }))
    expect(tagged).toBeInstanceOf(SpeechError)
    expect((tagged as SpeechError).code).toBe('endpoint')
    expect((tagged as SpeechError).message).toBe('Unexpected server response: 403')
  })

  it('hands an ordinary failure back untouched', () => {
    const plain = new Error('tchau')
    expect(tagError(plain)).toBe(plain)
  })
})
