/** The speech settings row store: mirror, catalog, and write settlement. */
import { describe, expect, it } from 'vitest'
import { createSpeechRowStore, type SpeechRowSection } from '../src/client/settings-store.ts'

const SECTION: SpeechRowSection = {
  provider: 'edge',
  voice: 'pt-BR-AntonioNeural',
  rate: 1,
  volume: 2,
  pitch: 3,
  skipCode: false,
}

const VOICES = [
  { id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR' },
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', language: 'pt-BR' },
  { id: 'en-US-AriaNeural', name: 'Aria', language: 'en-US' },
]

describe('createSpeechRowStore', () => {
  it('starts from the schema defaults with no catalog', () => {
    expect(createSpeechRowStore().create().getSnapshot()).toEqual({
      provider: 'edge',
      voice: 'pt-BR-AntonioNeural',
      rate: 0,
      volume: 0,
      pitch: 0,
      skipCode: true,
      voices: [],
      language: '',
      revision: -1,
      writeFailed: false,
    })
  })

  it('mirrors the durable section and drops stale revisions', () => {
    const store = createSpeechRowStore().create()
    store.actions.sync(SECTION, 3)
    expect(store.getSnapshot()).toMatchObject({ ...SECTION, revision: 3 })
    store.actions.sync({ ...SECTION, voice: 'outra' }, 2)
    store.actions.sync({ ...SECTION, voice: 'outra' }, 3)
    expect(store.getSnapshot().voice).toBe('pt-BR-AntonioNeural')
    expect(store.getSnapshot().revision).toBe(3)
  })

  it('follows the selected voice when the catalog arrives', () => {
    const store = createSpeechRowStore().create()
    store.actions.sync({ ...SECTION, voice: 'en-US-AriaNeural' }, 1)
    store.actions.setVoices(VOICES)
    expect(store.getSnapshot().language).toBe('en-US')
    expect(store.getSnapshot().voices).toBe(VOICES)
  })

  it('keeps a language the catalog still offers, and falls back to the first', () => {
    const store = createSpeechRowStore().create()
    store.actions.sync({ ...SECTION, voice: 'sumiu' }, 1)
    store.actions.setLanguage('en-US')
    store.actions.setVoices(VOICES)
    expect(store.getSnapshot().language).toBe('en-US')
    store.actions.setVoices([VOICES[2]!])
    expect(store.getSnapshot().language).toBe('en-US')
    store.actions.setVoices([])
    expect(store.getSnapshot().language).toBe('')
  })

  it('records a refused write outside the revision guard', () => {
    const store = createSpeechRowStore().create()
    store.actions.markWriteFailed(true)
    store.actions.sync(SECTION, 1)
    expect(store.getSnapshot().writeFailed).toBe(true)
    store.actions.markWriteFailed(false)
    expect(store.getSnapshot().writeFailed).toBe(false)
  })
})
