// @vitest-environment jsdom
/** Browser playback: one buffer fed segment by segment, and the fallbacks. */
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
  mode = 'segments'
  readonly chunks: Uint8Array[] = []
  private seconds = 0
  private readonly listeners = new Set<() => void>()

  get buffered(): { length: number, end: (index: number) => number } {
    const seconds = this.seconds
    return { length: seconds > 0 ? 1 : 0, end: () => seconds }
  }

  appendBuffer(chunk: Uint8Array): void {
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
/** The buffer the stream appended into. */
const buffer = (): FakeSourceBuffer => FakeMediaSource.instances.at(-1)?.buffers[0] as FakeSourceBuffer

/** One streaming response the spec drives by hand. */
interface Stream {
  response: Response
  push: (bytes: string) => Promise<void>
  close: () => Promise<void>
  fail: (error: Error) => void
}

/** One streaming response the spec feeds chunk by chunk. */
function stream(): Stream {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(source) { controller = source } })
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
    push: async (bytes) => { controller.enqueue(encoder.encode(bytes)); await Promise.resolve() },
    close: async () => { controller.close(); await Promise.resolve() },
    fail: (error) => { controller.error(error) },
  }
}

const fetchMock = vi.fn<(_url: string, init: { body: string }) => Promise<Response>>()

/** The body one synthesis request carried. */
const requested = (index = 0): Record<string, unknown> =>
  JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body)) as Record<string, unknown>

/** A fetch mock handing one fresh stream to every request. */
function streamed(): { streams: Stream[]; at: (index: number) => Stream; count: () => number } {
  const streams: Stream[] = []
  fetchMock.mockImplementation(async () => {
    const next = stream()
    streams.push(next)
    return next.response
  })
  return { streams, at: (index) => streams[index] as Stream, count: () => streams.length }
}

/** A refusal carrying the route's JSON shape. */
const refusal = (error: string, status = 400): Response =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } })

/** Wait until a segment's request has opened its stream. */
const opened = async (feeds: { count: () => number }, count: number): Promise<void> => {
  await vi.waitFor(() => { expect(feeds.count()).toBeGreaterThanOrEqual(count) })
}

beforeEach(() => {
  FakeAudio.instances.length = 0
  FakeAudio.refusePlay = undefined
  FakeMediaSource.instances.length = 0
  FakeMediaSource.supported = true
  FakeMediaSource.addFailure = undefined
  FakeSourceBuffer.secondsPerAppend = 1
  fetchMock.mockReset()
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('MediaSource', FakeMediaSource)
  vi.stubGlobal('fetch', fetchMock)
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('SpeechAudio streaming path', () => {
  it('feeds every segment into one buffer and starts once enough is buffered', async () => {
    const feeds = streamed()
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Primeira frase. Segunda frase.', { voice: 'voz' }, ended)

    await opened(feeds, 1)
    expect(requested()).toEqual({ text: 'Primeira frase.', voice: 'voz' })
    expect(buffer().mode).toBe('sequence')

    // Three seconds buffered, playback held back on purpose.
    for (const chunk of ['A', 'B', 'C']) await feeds.at(0).push(chunk)
    await vi.waitFor(() => { expect(buffer().chunks.length).toBe(3) })
    expect(element().paused).toBe(true)

    // The fourth second reaches the pre-buffer: speech starts.
    await feeds.at(0).push('D')
    await vi.waitFor(() => { expect(element().paused).toBe(false) })

    // The second segment was requested behind the first and appends into the
    // same buffer, so the reading has no seam at the boundary.
    await opened(feeds, 2)
    expect(requested(1)).toEqual({ text: 'Segunda frase.', voice: 'voz' })
    await feeds.at(0).close()
    await feeds.at(1).push('E')
    await feeds.at(1).close()
    await vi.waitFor(() => { expect(FakeMediaSource.instances[0]?.ended).toHaveBeenCalled() })
    expect(buffer().chunks.length).toBe(5)
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('starts anyway when the whole reply is shorter than the pre-buffer', async () => {
    const feeds = streamed()
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Curta.', undefined, ended)
    await opened(feeds, 1)
    await feeds.at(0).push('AAA')
    await feeds.at(0).close()
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    expect(FakeMediaSource.instances[0]?.ended).toHaveBeenCalled()
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('retries a segment the service cut before it produced audio', async () => {
    let call = 0
    fetchMock.mockImplementation(async () => {
      call += 1
      const next = stream()
      // The first connection dies at once, with nothing on it.
      if (call === 1) {
        queueMicrotask(() => { next.fail(new Error('Stream closed before the synthesis completed')) })
      } else {
        queueMicrotask(() => { void next.push('AAA').then(() => next.close()) })
      }
      return next.response
    })
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma frase.', undefined, ended)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('keeps the reading when a segment dies half way', async () => {
    const feeds = streamed()
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Primeira frase. Segunda frase.', undefined, ended)
    await opened(feeds, 1)
    for (const chunk of ['A', 'B', 'C', 'D', 'E']) await feeds.at(0).push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    // The connection drops mid-segment: what arrived keeps playing and the next
    // segment still goes out.
    feeds.at(0).fail(new Error('conexão caiu'))
    await opened(feeds, 2)
    await feeds.at(1).push('F')
    await feeds.at(1).close()
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('stops the element and reports nothing when playback is stopped', async () => {
    const feeds = streamed()
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Primeira frase. Segunda frase.', undefined, ended)
    await opened(feeds, 1)
    for (const chunk of ['A', 'B', 'C', 'D']) await feeds.at(0).push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    audio.stop()
    await feeds.at(0).close()
    await playing
    expect(element().paused).toBe(true)
    expect(ended).not.toHaveBeenCalled()
  })

  it('takes the abort a pause causes to a pending play as a cancellation', async () => {
    FakeAudio.refusePlay = Object.assign(
      new Error('The play() request was interrupted by a call to pause().'),
      { name: 'AbortError' },
    )
    const feeds = streamed()
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Uma frase.', undefined, ended)
    await opened(feeds, 1)
    for (const chunk of ['A', 'B', 'C', 'D']) await feeds.at(0).push(chunk)
    await feeds.at(0).close()
    await expect(playing).resolves.toBeUndefined()
    expect(ended).not.toHaveBeenCalled()
  })

  it('reports a play the autoplay policy refused', async () => {
    FakeAudio.refusePlay = Object.assign(new Error('autoplay bloqueado'), { name: 'NotAllowedError' })
    const feeds = streamed()
    const playing = new SpeechAudio().speak('Uma frase.', undefined, () => {})
    await opened(feeds, 1)
    for (const chunk of ['A', 'B', 'C', 'D']) await feeds.at(0).push(chunk)
    await feeds.at(0).close()
    await expect(playing).rejects.toThrow('autoplay bloqueado')
  })

  it('drops the element on dispose', async () => {
    const feeds = streamed()
    const audio = new SpeechAudio()
    const playing = audio.speak('Uma frase.', undefined, () => {})
    await opened(feeds, 1)
    for (const chunk of ['A', 'B', 'C', 'D']) await feeds.at(0).push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    audio.dispose()
    await feeds.at(0).close()
    await playing
    expect(element().paused).toBe(true)
  })
})

describe('SpeechAudio fallbacks', () => {
  it('speaks one blob per segment when the engine has no MediaSource', async () => {
    FakeMediaSource.supported = false
    fetchMock.mockImplementation(async () => new Response('AUDIO', { status: 200 }))
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma. Duas.', undefined, ended)
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    expect(FakeMediaSource.instances).toHaveLength(0)
    expect(element().paused).toBe(false)
    element().fire('ended')
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(2) })
    FakeAudio.instances[1]?.fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('speaks one blob per segment when the buffer refuses to open', async () => {
    FakeMediaSource.addFailure = 'codec recusado'
    fetchMock.mockImplementation(async () => new Response('AUDIO', { status: 200 }))
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma.', undefined, ended)
    // The streaming attempt still creates its element before the buffer refuses.
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
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

  it('speaks nothing at all for blank text', async () => {
    const ended = vi.fn()
    await new SpeechAudio().speak('   \n  ', undefined, ended)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
  })

  it('cuts each request to a segment, whatever the reply size', async () => {
    fetchMock.mockImplementation(async () => new Response('AUDIO', { status: 200 }))
    const audio = new SpeechAudio()
    const playing = audio.speak('Frase. '.repeat(4000), undefined, () => {})
    await vi.waitFor(() => { expect(fetchMock.mock.calls.length).toBeGreaterThan(2) })
    for (let index = 0; index < fetchMock.mock.calls.length; index += 1) {
      expect(String(requested(index).text).length).toBeLessThanOrEqual(400)
    }
    audio.stop()
    await playing
  })
})
