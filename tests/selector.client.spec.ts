/** The speech selector: settings plus overrides become one provider call. */
import { describe, expect, it } from 'vitest'
import { edgeProvider } from '../src/providers/edge/server.ts'
import { PROVIDERS, providerById } from '../src/providers/registry.ts'
import { selectSpeech } from '../src/selector.ts'
import { DEFAULT_SPEECH_SETTINGS, type SpeechSettings } from '../src/settings.ts'

const section: SpeechSettings = {
  ...DEFAULT_SPEECH_SETTINGS,
  edge: { voice: 'pt-BR-AntonioNeural', rate: 3, volume: 4, pitch: 5 },
}

describe('speech provider registry', () => {
  it('lists every compiled-in provider and resolves them by id', () => {
    expect(PROVIDERS).toEqual([edgeProvider])
    expect(providerById('edge')).toBe(edgeProvider)
    expect(providerById('elevenlabs')).toBeUndefined()
  })
})

describe('selectSpeech', () => {
  it('builds the request from the durable block', () => {
    const selected = selectSpeech(section, 'Olá')
    expect(selected?.provider).toBe(edgeProvider)
    expect(selected?.request).toEqual({
      text: 'Olá',
      voice: 'pt-BR-AntonioNeural',
      tuning: { rate: 3, volume: 4, pitch: 5 },
    })
  })

  it('lets an override replace the voice and part of the tuning', () => {
    const selected = selectSpeech(section, 'Olá', {
      voice: 'pt-BR-FranciscaNeural',
      tuning: { rate: 40 },
    })
    expect(selected?.request.voice).toBe('pt-BR-FranciscaNeural')
    expect(selected?.request.tuning).toEqual({ rate: 40, volume: 4, pitch: 5 })
  })

  it('resolves the provider an override names', () => {
    const selected = selectSpeech(section, 'Olá', { provider: 'edge' })
    expect(selected?.provider).toBe(edgeProvider)
  })

  it('answers undefined for a provider no folder claims', () => {
    expect(selectSpeech(section, 'Olá', { provider: 'elevenlabs' })).toBeUndefined()
  })
})
