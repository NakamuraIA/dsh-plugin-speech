/** Durable speech settings: defaults, bounds, and the active-block readers. */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDGE_SETTINGS, DEFAULT_SPEECH_SETTINGS, EDGE_FIELD, PROVIDER_FIELD, SKIP_CODE_FIELD,
  SPEECH_PROVIDERS, SpeechSettingsSchema, activeBlockField, activeVoiceSettings, isSpeechProvider,
  type SpeechSettings,
} from '../src/settings.ts'

describe('speech settings schema', () => {
  it('fills every default when the document omits the section', () => {
    expect(SpeechSettingsSchema({} as never)).toEqual(DEFAULT_SPEECH_SETTINGS)
    expect(DEFAULT_SPEECH_SETTINGS.provider).toBe('edge')
    expect(DEFAULT_SPEECH_SETTINGS.skipCode).toBe(true)
    expect(DEFAULT_SPEECH_SETTINGS.edge).toEqual(DEFAULT_EDGE_SETTINGS)
  })

  it('keeps a complete section as written', () => {
    const section = {
      provider: 'edge',
      skipCode: false,
      edge: { voice: 'pt-BR-ThalitaMultilingualNeural', rate: 10, volume: -10, pitch: 5 },
    }
    expect(SpeechSettingsSchema(section as never)).toEqual(section)
  })

  it('refuses a provider, a bound, or a voice type it does not declare', () => {
    expect(() => SpeechSettingsSchema({ provider: 'elevenlabs' } as never)).toThrow()
    expect(() => SpeechSettingsSchema({ edge: { rate: 51 } } as never)).toThrow()
    expect(() => SpeechSettingsSchema({ edge: { rate: -51 } } as never)).toThrow()
    expect(() => SpeechSettingsSchema({ edge: { volume: 51 } } as never)).toThrow()
    expect(() => SpeechSettingsSchema({ edge: { pitch: 51 } } as never)).toThrow()
    expect(() => SpeechSettingsSchema({ edge: { voice: 5 } } as never)).toThrow()
    expect(() => SpeechSettingsSchema({ skipCode: 'yes' } as never)).toThrow()
  })

  it('names one field per settings key', () => {
    expect(SPEECH_PROVIDERS).toEqual(['edge'])
    expect([PROVIDER_FIELD, SKIP_CODE_FIELD, EDGE_FIELD]).toEqual(['provider', 'skipCode', 'edge'])
  })

  it('narrows a wire value to a known provider', () => {
    expect(isSpeechProvider('edge')).toBe(true)
    expect(isSpeechProvider('elevenlabs')).toBe(false)
    expect(isSpeechProvider(undefined)).toBe(false)
  })

  it('reads the active block for the selected provider', () => {
    const section: SpeechSettings = {
      ...DEFAULT_SPEECH_SETTINGS,
      edge: { voice: 'voz', rate: 7, volume: 8, pitch: 9 },
    }
    expect(activeVoiceSettings(section)).toEqual({ voice: 'voz', rate: 7, volume: 8, pitch: 9 })
    expect(activeBlockField()).toBe(EDGE_FIELD)
  })
})
