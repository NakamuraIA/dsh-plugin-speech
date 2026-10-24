// @vitest-environment jsdom
/** Browser playback: one request per reply, a buffered head, and the fallbacks. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpeechAudio } from '../src/client/speech-audio.ts'

/** A media element the spec drives by hand. */
class FakeAudio {
  static readonly instances: FakeAudio[] = []
  /** When set, `play()` refuses the way an autoplay policy does. */
  static refusePlay: Error | undefined
  src: string
  ended = false
  paused = true
  private readonly listeners = new Map<string, Set<() => void>>()

  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }

  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  async play(): Promise<void> {
    if (FakeAudio.refusePlay !== undefined) throw FakeAudio.refusePlay
    this.paused = false
  }

  pause(): void {
    this.paused = true
    for (const listener of [...(this.listeners.get('pause') ?? [])]) listener()
  }

  /** Fire one event at this element. */
  fire(type: string): void {
    if (type === 'ended') this.ended = true
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }
}

/** A source buffer that grows by a fixed number of seconds per append. */
class FakeSourceBuffer {
  /** Audio seconds one append is worth. */
  static secondsPerAppend = 1
  /** When set, `appendBuffer` refuses the way an undecodable container does. */
  static appendFailure: unknown
  mode = 'segments'
  readonly chunks: Uint8Array[] = []
  private seconds = 0
  private readonly listeners = new Set<() => void>()

  get buffered(): { length: number, end: (index: number) => number } {
    const seconds = this.seconds
    return { length: seconds > 0 ? 1 : 0, end: () => seconds }
  }

  appendBuffer(chunk: Uint8Array): void {
    if (FakeSourceBuffer.appendFailure !== undefined) throw FakeSourceBuffer.appendFailure
    this.chunks.push(chunk)
    this.seconds += FakeSourceBuffer.secondsPerAppend
    queueMicrotask(() => { for (const listener of [...this.listeners]) listener() })
  }

  addEventListener(_type: string, listener: () => void): void { this.listeners.add(listener) }
  removeEventListener(_type: string, listener: () => void): void { this.listeners.delete(listener) }
}

/** A MediaSource that opens on the next microtask. */
class FakeMediaSource {
  static supported = true
  /** When set, `addSourceBuffer` refuses the way an unsupported container does. */
  static addFailure: unknown
  static readonly instances: FakeMediaSource[] = []
  readyState = 'open'
  readonly buffers: FakeSourceBuffer[] = []
  readonly ended = vi.fn()
  private onOpen: (() => void) | undefined

  constructor() {
    FakeMediaSource.instances.push(this)
    queueMicrotask(() => { this.onOpen?.() })
  }

  static isTypeSupported(): boolean { return FakeMediaSource.supported }

  addSourceBuffer(): FakeSourceBuffer {
    if (FakeMediaSource.addFailure !== undefined) throw FakeMediaSource.addFailure
    const buffer = new FakeSourceBuffer()
    this.buffers.push(buffer)
    return buffer
  }

  addEventListener(_type: string, listener: () => void): void { this.onOpen = listener }
  endOfStream(): void { this.ended() }
}

/** The audio element the most recent play created. */
const element = (): FakeAudio => FakeAudio.instances.at(-1) as FakeAudio
/** The buffer the most recent stream appended into. */
const buffer = (): FakeSourceBuffer => FakeMediaSource.instances.at(-1)?.buffers[0] as FakeSourceBuffer

/** One streaming response the spec feeds chunk by chunk. */
function streamed(): { response: Response; push: (bytes: string) => Promise<void>; close: () => Promise<void> } {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(source) { controller = source } })
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
    push: async (bytes) => { controller.enqueue(encoder.encode(bytes)); await Promise.resolve() },
    close: async () => { controller.close(); await Promise.resolve() },
  }
}

/** A refusal carrying the route's JSON shape. */
const refusal = (error: string, status = 400): Response =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } })

const fetchMock = vi.fn<(_url: string, init: { body: string }) => Promise<Response>>()
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:test')

/** The body one synthesis request carried. */
const requested = (index = 0): Record<string, unknown> =>
  JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body)) as Record<string, unknown>

/** The blob the most recent playback was handed. */
const lastBlob = (): Blob => createObjectURL.mock.calls.at(-1)?.[0] as Blob

beforeEach(() => {
  FakeAudio.instances.length = 0
  FakeAudio.refusePlay = undefined
  FakeMediaSource.instances.length = 0
  FakeMediaSource.supported = true
  FakeMediaSource.addFailure = undefined
  FakeSourceBuffer.secondsPerAppend = 1
  FakeSourceBuffer.appendFailure = undefined
  fetchMock.mockReset()
  createObjectURL.mockClear()
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('MediaSource', FakeMediaSource)
  vi.stubGlobal('fetch', fetchMock)
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('SpeechAudio streaming path', () => {
  it('asks for the whole reply once and starts once enough is buffered', async () => {
    const stream = streamed()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Primeira frase. Segunda frase.', { voice: 'voz' }, ended)

    expect(requested()).toEqual({ text: 'Primeira frase. Segunda frase.', voice: 'voz' })
    await stream.push('A')
    await vi.waitFor(() => { expect(buffer().chunks.length).toBe(1) })
    expect(buffer().mode).toBe('sequence')
    // Three seconds in, playback is deliberately still held back.
    await stream.push('B')
    await stream.push('C')
    await vi.waitFor(() => { expect(buffer().chunks.length).toBe(3) })
    expect(element().paused).toBe(true)

    // The fourth second reaches the pre-buffer; now speech begins.
    await stream.push('D')
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    await stream.push('E')
    await stream.close()
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('plays a reply that ends before the pre-buffer as one file', async () => {
    const stream = streamed()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Curta.', undefined, ended)
    await stream.push('AAA')
    await stream.close()
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(2) })
    expect(element().paused).toBe(false)
    expect(lastBlob().size).toBe(3)
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('stops the element and reports nothing when playback is stopped', async () => {
    const stream = streamed()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Texto', undefined, ended)
    for (const chunk of ['A', 'B', 'C', 'D']) await stream.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    audio.stop()
    // A real stop also aborts the body; the fake one has to be closed by hand.
    await stream.close()
    await playing
    expect(element().paused).toBe(true)
    expect(ended).not.toHaveBeenCalled()
  })

  it('takes the abort a pause causes to a pending play as a cancellation', async () => {
    // A second press of the play button pauses the element while play() is
    // still settling, and the platform rejects that play() with an abort.
    FakeAudio.refusePlay = Object.assign(
      new Error('The play() request was interrupted by a call to pause().'),
      { name: 'AbortError' },
    )
    const stream = streamed()
    fetchMock.mockResolvedValue(stream.response)
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Texto', undefined, ended)
    for (const chunk of ['A', 'B', 'C', 'D']) await stream.push(chunk)
    await expect(playing).resolves.toBeUndefined()
    expect(ended).not.toHaveBeenCalled()
  })

  it('reports a play the autoplay policy refused', async () => {
    FakeAudio.refusePlay = Object.assign(new Error('autoplay bloqueado'), { name: 'NotAllowedError' })
    const stream = streamed()
    fetchMock.mockResolvedValue(stream.response)
    const playing = new SpeechAudio().speak('Texto', undefined, () => {})
    for (const chunk of ['A', 'B', 'C', 'D']) await stream.push(chunk)
    await expect(playing).rejects.toThrow('autoplay bloqueado')
  })

  it('plays the bytes in hand when the buffer refuses them', async () => {
    FakeMediaSource.addFailure = 'codec recusado'
    const stream = streamed()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Texto', undefined, ended)
    await stream.push('AAA')
    await stream.push('BBB')
    await stream.close()
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(2) })
    expect(lastBlob().size).toBe(6)
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('abandons a reply whose request was still in flight when it was stopped', async () => {
    const stream = streamed()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Texto', undefined, ended)
    await vi.waitFor(() => { expect(FakeMediaSource.instances.length).toBe(1) })
    audio.stop()
    await stream.push('A')
    await playing
    expect(ended).not.toHaveBeenCalled()
  })

  it('drops the element on dispose', async () => {
    const stream = streamed()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const playing = audio.speak('Texto', undefined, () => {})
    for (const chunk of ['A', 'B', 'C', 'D']) await stream.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    audio.dispose()
    await stream.close()
    await playing
    expect(element().paused).toBe(true)
  })
})

describe('SpeechAudio without a buffer', () => {
  it('plays one whole file when the engine has no MediaSource', async () => {
    FakeMediaSource.supported = false
    fetchMock.mockResolvedValue(new Response('AUDIO', { status: 200 }))
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Texto', undefined, ended)
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    expect(FakeMediaSource.instances).toHaveLength(0)
    expect(element().paused).toBe(false)
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })
})

describe('SpeechAudio refusals', () => {
  it('reports a provider failure with the message the host sent', async () => {
    fetchMock.mockResolvedValue(refusal('serviço fora do ar', 502))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('serviço fora do ar')
  })

  it('falls back to the status line when the refusal is not the route JSON', async () => {
    fetchMock.mockResolvedValue(new Response('gateway', { status: 502, statusText: 'Bad Gateway' }))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('502 Bad Gateway')
  })

  it('falls back to the status line when the refusal carries no message', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 503, statusText: 'Busy' }))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('503 Busy')
  })

  it('re-splits into sentences when the host refuses a larger request', async () => {
    // Only the oversized request is refused; the sentence-sized retries succeed.
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      const { text } = JSON.parse(init.body) as { text: string }
      return text.length > 5 ? refusal('text must be 1..5 characters') : new Response('AUDIO', { status: 200 })
    })
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma. Duas.', undefined, ended)
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    FakeAudio.instances[0]?.fire('ended')
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(2) })
    FakeAudio.instances[1]?.fire('ended')
    await playing
    // The first call is the refused whole reply; the retries are the sentences.
    expect([requested(1).text, requested(2).text]).toEqual(['Uma.', 'Duas.'])
    expect(ended).toHaveBeenCalledOnce()
  })

  it('ignores a refusal whose declared limit cannot be used', async () => {
    fetchMock.mockResolvedValue(refusal('text must be 1..0 characters'))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('1..0 characters')
  })

  it('speaks nothing at all for blank text', async () => {
    const ended = vi.fn()
    await new SpeechAudio().speak('   \n  ', undefined, ended)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
  })

  it('speaks a reply larger than one request sentence by sentence', async () => {
    fetchMock.mockResolvedValue(new Response('AUDIO', { status: 200 }))
    const audio = new SpeechAudio()
    const playing = audio.speak('Frase. '.repeat(4000), undefined, () => {})
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    // No single request could carry this reply, so the first one is a sentence.
    expect(requested().text).toBe('Frase.')
    await vi.waitFor(() => { expect(fetchMock.mock.calls.length).toBeGreaterThan(1) })
    audio.stop()
    await playing
  })
})
