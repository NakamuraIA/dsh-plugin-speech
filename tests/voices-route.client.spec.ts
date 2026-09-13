/** The voice catalog route: method, catalog availability, and provider faults. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const edge = vi.hoisted(() => ({ getVoices: vi.fn(), setMetadata: vi.fn(), toStream: vi.fn() }))

vi.mock('msedge-tts', () => ({
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'mp3-format' },
  MsEdgeTTS: class {
    getVoices = edge.getVoices
    setMetadata = edge.setMetadata
    toStream = edge.toStream
  },
}))

const { serveVoiceCatalog } = await import('../src/voices-route.ts')

/** A request for one catalog URL. */
function request(method: string, url: string): IncomingMessage {
  return { method, url } as unknown as IncomingMessage
}

/** A response recording what the route wrote. */
function response(): { res: ServerResponse; status: number; headers: Record<string, string>; body: string } {
  const state = { status: 0, headers: {} as Record<string, string>, body: '' }
  const res = {
    writeHead(status: number, headers?: Record<string, string>) {
      state.status = status
      Object.assign(state.headers, headers ?? {})
      return res
    },
    end(chunk?: string) { state.body = chunk ?? '' },
  } as unknown as ServerResponse
  return {
    res,
    get status() { return state.status },
    get headers() { return state.headers },
    get body() { return state.body },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  edge.getVoices.mockResolvedValue([
    { ShortName: 'pt-BR-AntonioNeural', FriendlyName: 'Antonio', Locale: 'pt-BR', Gender: 'Male' },
  ])
})

describe('GET /speech/voices', () => {
  it('answers 405 for any other method', async () => {
    const out = response()
    await serveVoiceCatalog(request('POST', '/speech/voices'), out.res)
    expect(out.status).toBe(405)
  })

  it('lists the selected provider catalog', async () => {
    const out = response()
    await serveVoiceCatalog(request('GET', '/speech/voices?provider=edge'), out.res)
    expect(out.status).toBe(200)
    expect(out.headers['cache-control']).toBe('no-cache, no-transform')
    expect(JSON.parse(out.body)).toEqual({
      voices: [{ id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR', gender: 'Male' }],
    })
  })

  it('defaults to the default provider when the query names none', async () => {
    const out = response()
    await serveVoiceCatalog(request('GET', '/speech/voices'), out.res)
    expect(out.status).toBe(200)
    expect(edge.getVoices).toHaveBeenCalledOnce()
  })

  it('answers 404 for a provider with no catalog', async () => {
    const out = response()
    await serveVoiceCatalog(request('GET', '/speech/voices?provider=elevenlabs'), out.res)
    expect(out.status).toBe(404)
    expect(out.body).toContain('lists no voice catalog')
  })

  it('answers 502 when the provider cannot list its voices', async () => {
    edge.getVoices.mockRejectedValue(new Error('catalog unavailable'))
    const out = response()
    await serveVoiceCatalog(request('GET', '/speech/voices?provider=edge'), out.res)
    expect(out.status).toBe(502)
    expect(out.body).toContain('catalog unavailable')
  })

  it('answers 502 with the string form of a rejection that is not an Error', async () => {
    edge.getVoices.mockRejectedValue('catalog offline')
    const out = response()
    await serveVoiceCatalog(request('GET', '/speech/voices?provider=edge'), out.res)
    expect(out.status).toBe(502)
    expect(out.body).toContain('catalog offline')
  })
})
