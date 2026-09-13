/** The synthesis route: method, bounds, provider selection, and streaming. */
import { PassThrough } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const edge = vi.hoisted(() => ({ toStream: vi.fn(), setMetadata: vi.fn(), getVoices: vi.fn() }))

vi.mock('msedge-tts', () => ({
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'mp3-format' },
  MsEdgeTTS: class {
    getVoices = edge.getVoices
    setMetadata = edge.setMetadata
    toStream = edge.toStream
  },
}))

const { serveSpeechRequest } = await import('../src/speak-route.ts')
const { DEFAULT_SPEECH_SETTINGS, SPEECH_SETTINGS_NAMESPACE } = await import('../src/settings.ts')
const { MAX_TEXT_CHARS } = await import('../src/speech-limits.ts')

/** A request carrying one JSON body. */
function request(method: string, body?: unknown): IncomingMessage {
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body))]
  return {
    method,
    url: '/speech/speak',
    async *[Symbol.asyncIterator]() { for (const chunk of payload) yield chunk },
  } as unknown as IncomingMessage
}

/** A response recording what the route wrote, backed by a real writable. */
function response(): { res: ServerResponse; status: number; headers: Record<string, string>; body: Buffer; sent: () => boolean } {
  const sink = new PassThrough()
  const chunks: Buffer[] = []
  sink.on('data', (chunk: Buffer) => { chunks.push(chunk) })
  const state = { status: 0, headers: {} as Record<string, string> }
  const res = sink as unknown as ServerResponse & PassThrough
  Object.defineProperty(res, 'headersSent', { get: () => state.status !== 0 })
  res.writeHead = ((status: number, headers?: Record<string, string>) => {
    state.status = status
    Object.assign(state.headers, headers ?? {})
    return res
  }) as unknown as (ServerResponse & PassThrough)['writeHead']
  return {
    res,
    get status() { return state.status },
    get headers() { return state.headers },
    get body() { return Buffer.concat(chunks) },
    sent: () => state.status !== 0,
  }
}

/** A host context whose settings service answers one durable section. */
const context = (section: unknown = DEFAULT_SPEECH_SETTINGS): never => ({
  get: (name: string) => name === 'settings' ? { get: (ns: string) => ns === SPEECH_SETTINGS_NAMESPACE ? section : undefined } : undefined,
} as never)

/** One provider stream carrying fixed audio bytes. */
function audioStream(bytes = 'AUDIOBYTES'): PassThrough {
  const stream = new PassThrough()
  stream.end(bytes)
  return stream
}

beforeEach(() => {
  vi.clearAllMocks()
  edge.setMetadata.mockResolvedValue(undefined)
  edge.toStream.mockReturnValue({ audioStream: audioStream(), metadataStream: null })
})

describe('POST /speech/speak', () => {
  it('answers 405 for any other method', async () => {
    const out = response()
    await serveSpeechRequest(request('GET'), out.res, context())
    expect(out.status).toBe(405)
  })

  it('answers 400 for a missing, malformed, or oversized body', async () => {
    for (const body of [undefined, { text: '' }, { text: 'x'.repeat(MAX_TEXT_CHARS + 1) }, { text: 42 }]) {
      const out = response()
      await serveSpeechRequest(request('POST', body), out.res, context())
      expect(out.status).toBe(400)
      expect(out.body.toString()).toContain('text must be')
    }
  })

  it('answers 400 when the body is not JSON at all', async () => {
    const out = response()
    const broken = {
      method: 'POST',
      url: '/speech/speak',
      async *[Symbol.asyncIterator]() { yield Buffer.from('not json') },
    } as unknown as IncomingMessage
    await serveSpeechRequest(broken, out.res, context())
    expect(out.status).toBe(400)
  })

  it('answers 400 when the body parses to something other than an object', async () => {
    const out = response()
    const scalar = {
      method: 'POST',
      url: '/speech/speak',
      async *[Symbol.asyncIterator]() { yield Buffer.from('42') },
    } as unknown as IncomingMessage
    await serveSpeechRequest(scalar, out.res, context())
    expect(out.status).toBe(400)
  })

  it('answers 400 for a body beyond the accepted size without buffering it', async () => {
    const out = response()
    const oversized = {
      method: 'POST',
      url: '/speech/speak',
      async *[Symbol.asyncIterator]() {
        for (let index = 0; index < 6; index += 1) yield Buffer.alloc(64 * 1024, 0x61)
      },
    } as unknown as IncomingMessage
    await serveSpeechRequest(oversized, out.res, context())
    expect(out.status).toBe(400)
  })

  it('answers 404 for a provider no folder claims', async () => {
    const out = response()
    await serveSpeechRequest(request('POST', { text: 'Olá', provider: 'elevenlabs' }), out.res, context())
    expect(out.status).toBe(404)
    expect(out.body.toString()).toContain('unknown speech provider')
  })

  it('streams the provider audio with the durable settings and no transformation', async () => {
    const out = response()
    const finished = new Promise<void>((resolve) => { out.res.on('finish', () => { resolve() }) })
    await serveSpeechRequest(request('POST', { text: 'Olá', voice: 'voz', tuning: { rate: 5 } }), out.res, context())
    await finished
    expect(out.status).toBe(200)
    expect(out.headers['content-type']).toBe('audio/mpeg')
    expect(out.headers['cache-control']).toBe('no-store, no-transform')
    expect(edge.toStream).toHaveBeenCalledWith('Olá', { rate: '+5%', volume: '+0%', pitch: '+0Hz' })
    expect(out.body.toString()).toBe('AUDIOBYTES')
  })

  it('falls back to the schema defaults without a settings service', async () => {
    const out = response()
    await serveSpeechRequest(request('POST', { text: 'Olá' }), out.res, { get: () => undefined } as never)
    expect(out.status).toBe(200)
    expect(edge.setMetadata).toHaveBeenCalledWith('pt-BR-AntonioNeural', 'mp3-format')
  })

  it('answers 502 when the provider refuses before streaming starts', async () => {
    edge.setMetadata.mockRejectedValue(new Error('serviço fora do ar'))
    const out = response()
    await serveSpeechRequest(request('POST', { text: 'Olá' }), out.res, context())
    expect(out.status).toBe(502)
    expect(out.body.toString()).toContain('serviço fora do ar')
  })

  it('answers 502 with the string form of a provider rejection that is not an Error', async () => {
    edge.setMetadata.mockRejectedValue('caiu feio')
    const out = response()
    await serveSpeechRequest(request('POST', { text: 'Olá' }), out.res, context())
    expect(out.status).toBe(502)
    expect(out.body.toString()).toContain('caiu feio')
  })

  it('tears the response down when the stream fails after the headers went out', async () => {
    const failing = new PassThrough()
    edge.toStream.mockReturnValue({ audioStream: failing, metadataStream: null })
    const out = response()
    const destroyed = new Promise<void>((resolve) => { out.res.on('close', () => { resolve() }) })
    const served = serveSpeechRequest(request('POST', { text: 'Olá' }), out.res, context())
    failing.destroy(new Error('conexão caiu'))
    await served
    await destroyed
    expect(out.status).toBe(200)
    expect(out.res.destroyed).toBe(true)
  })
})
