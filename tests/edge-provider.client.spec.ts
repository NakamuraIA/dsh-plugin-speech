/** The Edge provider: catalog mapping, the SSML it sends, and defaults. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const edge = vi.hoisted(() => ({
  getVoices: vi.fn(),
  setMetadata: vi.fn(),
  rawToStream: vi.fn(),
}))

vi.mock('msedge-tts', () => ({
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'mp3-format' },
  MsEdgeTTS: class {
    getVoices = edge.getVoices
    setMetadata = edge.setMetadata
    rawToStream = edge.rawToStream
  },
}))

const { DEFAULT_VOICE, edgeProvider } = await import('../src/providers/edge/server.ts')

beforeEach(() => {
  vi.clearAllMocks()
  edge.setMetadata.mockResolvedValue(undefined)
  edge.rawToStream.mockReturnValue({ audioStream: 'STREAM', metadataStream: null })
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
    const ssml = String(edge.rawToStream.mock.calls[0]?.[0])
    expect(ssml).toContain("name='pt-BR-AntonioNeural'")
    expect(ssml).toContain("rate='+10%' volume='-20%' pitch='+5Hz'")
    expect(ssml).toContain('Olá')
    expect(audio).toEqual({ stream: 'STREAM', contentType: 'audio/mpeg' })
  })

  it('falls back to the default voice and clamps out-of-range tuning', async () => {
    await edgeProvider.synthesize({ text: 'Olá', voice: '', tuning: { rate: 999, volume: 'alto', pitch: -999 } }, {})
    expect(edge.setMetadata).toHaveBeenCalledWith(DEFAULT_VOICE, 'mp3-format')
    const ssml = String(edge.rawToStream.mock.calls[0]?.[0])
    expect(ssml).toContain("name='pt-BR-AntonioNeural'")
    expect(ssml).toContain("rate='+100%' volume='+0%' pitch='-100Hz'")
  })

  it('publishes its voice catalog as the settings screen reads it', async () => {
    await expect(edgeProvider.voices?.()).resolves.toEqual([
      { id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR', gender: 'Male' },
    ])
  })

  it('points the library at a socket URL signed with the accepted token', async () => {
    const { MsEdgeTTS } = await import('msedge-tts')
    const signed = await (MsEdgeTTS as unknown as { getSynthUrl: () => Promise<string> }).getSynthUrl()
    const url = new URL(signed)
    expect(url.searchParams.get('Sec-MS-GEC-Version')).toBe('2-143.0.3650.75')
    expect(url.searchParams.get('Sec-MS-GEC')).toMatch(/^[0-9A-F]{16}-[0-9A-F]{64}$/)
  })
})
