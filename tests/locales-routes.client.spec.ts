/** Speech copy: both dictionaries own the same keys, and the routes are fixed. */
import { describe, expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.ts'
import { SPEECH_ROUTE, SPEECH_SPEAK_ROUTE, SPEECH_VOICES_ROUTE } from '../src/routes.ts'

describe('speech dictionaries', () => {
  it('carries the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(Object.keys(en).length).toBeGreaterThan(0)
  })

  it('keeps every entry a non-empty string', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(zh)]) {
      expect(value.length, key).toBeGreaterThan(0)
    }
  })

  it('localizes the row and the action, and keeps provider names', () => {
    expect(zh['row.title']).not.toBe(en['row.title'])
    expect(zh['speak.read']).not.toBe(en['speak.read'])
    expect(en['provider.edge']).toBe(zh['provider.edge'])
    expect(en['row.percentUnit']).toBe('%')
  })
})

describe('speech routes', () => {
  it('derives both exact routes from the owned prefix', () => {
    expect(SPEECH_ROUTE).toBe('/speech')
    expect(SPEECH_SPEAK_ROUTE).toBe('/speech/speak')
    expect(SPEECH_VOICES_ROUTE).toBe('/speech/voices')
  })
})
