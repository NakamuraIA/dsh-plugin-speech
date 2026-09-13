/** The Edge provider: catalog mapping, prosody formatting, and defaults. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const edge = vi.hoisted(() => ({
  getVoices: vi.fn(),
  setMetadata: vi.fn(),
  toStream: vi.fn(),
}))

vi.mock('msedge-tts', () => ({
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'mp3-format' },
  MsEdgeTTS: class {
    getVoices = edge.getVoices
    setMetadata = edge.setMetadata
    toStream = edge.toStream
  },
}))

const { DEFAULT_VOICE, edgeProvider } = await import('../src/providers/edge/server.ts')

beforeEach(() => {
  vi.clearAllMocks()
  edge.setMetadata.mockResolvedValue(undefined)
  edge.toStream.mockReturnValue({ audioStream: 'STREAM', metadataStream: null })
  edge.getVoices.mockResolvedValue([
    { ShortName: 'pt-BR-AntonioNeural', FriendlyName: 'Antonio', Locale: 'pt-BR', Gender: 'Male' },
  ])
})

describe('edge provider', () => {
  it('speaks with the requested voice and the requested prosody', async () => {
    const audio = await edgeProvider.synthesize(
      { text: 'Olá', voice: 'pt-BR-AntonioNeural', tuning: { rate: 10, volume: -20, pitch: 5 } },
      {},
    )
    expect(edge.setMetadata).toHaveBeenCalledWith('pt-BR-AntonioNeural', 'mp3-format')
    expect(edge.toStream).toHaveBeenCalledWith('Olá', { rate: '+10%', volume: '-20%', pitch: '+5Hz' })
    expect(audio).toEqual({ stream: 'STREAM', contentType: 'audio/mpeg' })
  })

  it('falls back to the default voice and clamps out-of-range tuning', async () => {
    await edgeProvider.synthesize({ text: 'Olá', voice: '', tuning: { rate: 999, volume: 'alto', pitch: -999 } }, {})
    expect(edge.setMetadata).toHaveBeenCalledWith(DEFAULT_VOICE, 'mp3-format')
    expect(edge.toStream).toHaveBeenCalledWith('Olá', { rate: '+100%', volume: '+0%', pitch: '-100Hz' })
  })

  it('publishes its voice catalog as the settings screen reads it', async () => {
    await expect(edgeProvider.voices?.()).resolves.toEqual([
      { id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR', gender: 'Male' },
    ])
  })
})
