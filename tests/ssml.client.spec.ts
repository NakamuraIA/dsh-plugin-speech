/** The Edge SSML: one line, escaped, with the locale read from the voice. */
import { describe, expect, it } from 'vitest'
import { escapeSpeech, localeOf, speechSsml } from '../src/providers/edge/ssml.ts'

describe('speech SSML', () => {
  it('renders one line with the voice, the locale, and the tuned prosody', () => {
    const ssml = speechSsml('Olá', 'pt-BR-ThalitaMultilingualNeural', { rate: 4, volume: -10, pitch: 12 })
    expect(ssml).toBe(
      "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'>"
      + "<voice name='pt-BR-ThalitaMultilingualNeural'>"
      + "<prosody rate='+4%' volume='-10%' pitch='+12Hz'>Olá</prosody></voice></speak>",
    )
    // The service drops a connection on the library's indented template; the
    // whole document therefore has to stay on one line.
    expect(ssml).not.toContain('\n')
  })

  it('escapes the three characters XML cannot carry literally', () => {
    expect(escapeSpeech('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
    expect(speechSsml('1 < 2 & 3 > 2', 'en-US-EmmaNeural', { rate: 0, volume: 0, pitch: 0 })).toContain(
      '1 &lt; 2 &amp; 3 &gt; 2',
    )
  })

  it('reads the locale from the voice name', () => {
    expect(localeOf('pt-BR-AntonioNeural')).toBe('pt-BR')
    expect(localeOf('en-GB-SoniaNeural')).toBe('en-GB')
    expect(localeOf('zh-CN-XiaoxiaoNeural')).toBe('zh-CN')
  })

  it('falls back to en-US for a voice name with no locale', () => {
    expect(localeOf('AntonioNeural')).toBe('en-US')
  })
})
