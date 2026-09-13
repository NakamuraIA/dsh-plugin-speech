// @vitest-environment jsdom
/** Browser playback: one streamed request, MediaSource append, and the fallbacks. */
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

  pause(): void { this.paused = true }

  /** Fire one event at this element. */
  fire(type: string): void {
    if (type === 'ended') this.ended = true
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }
}

/** A source buffer that accepts appends and reports them back. */
class FakeSourceBuffer {
  mode = 'segments'
  readonly chunks: Uint8Array[] = []
  appendFailure: Error | undefined
  private readonly listeners = new Set<() => void>()

  appendBuffer(chunk: Uint8Array): void {
    if (this.appendFailure !== undefined) throw this.appendFailure
    this.chunks.push(chunk)
    queueMicrotask(() => { for (const listener of [...this.listeners]) listener() })
  }

  addEventListener(_type: string, listener: () => void): void { this.listeners.add(listener) }
  removeEventListener(_type: string, listener: () => void): void { this.listeners.delete(listener) }
}

/** A MediaSource that opens on the next microtask and records its end. */
class FakeMediaSource {
  static supported = true
  /** When set, `addSourceBuffer` refuses the way an unsupported codec does. */
  static addFailure: unknown
  /** What `readyState` reports; a closed source refuses another end-of-stream. */
  static readyStateValue = 'open'
  static readonly instances: FakeMediaSource[] = []
  static isTypeSupported(): boolean { return FakeMediaSource.supported }
  readyState = FakeMediaSource.readyStateValue
  readonly buffers: FakeSourceBuffer[] = []
  readonly ended = vi.fn()
  private onOpen: (() => void) | undefined

  constructor() {
    FakeMediaSource.instances.push(this)
    queueMicrotask(() => { this.onOpen?.() })
  }

  addSourceBuffer(): FakeSourceBuffer {
    if (FakeMediaSource.addFailure !== undefined) throw FakeMediaSource.addFailure
    const buffer = new FakeSourceBuffer()
    this.buffers.push(buffer)
    return buffer
  }

  addEventListener(_type: string, listener: () => void): void { this.onOpen = listener }

  endOfStream(): void { this.ended() }
}

/** The audio element the most recent speak created. */
const element = (): FakeAudio => FakeAudio.instances.at(-1) as FakeAudio
/** The buffer the most recent stream appended into. */
const buffer = (): FakeSourceBuffer => FakeMediaSource.instances.at(-1)?.buffers[0] as FakeSourceBuffer
/** Wait until the reader drained every chunk and closed its source. */
const drained = async (): Promise<void> => {
  await vi.waitFor(() => { expect(FakeMediaSource.instances.at(-1)?.ended).toHaveBeenCalled() })
}

/** One streaming response the spec feeds chunk by chunk. */
function streamedResponse(): { response: Response; push: (text: string) => Promise<void>; close: () => Promise<void> } {
  const encoder = new TextEncoder()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(source) { controller = source } })
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'audio/mpeg' } }),
    push: async (text) => { controller.enqueue(encoder.encode(text)); await Promise.resolve() },
    close: async () => { controller.close(); await Promise.resolve() },
  }
}

const fetchMock = vi.fn<(_url: string, init: { body: string }) => Promise<Response>>()

/** The text one synthesis request carried. */
const requestedText = (init: { body: string }): string => (JSON.parse(init.body) as { text: string }).text

beforeEach(() => {
  FakeAudio.instances.length = 0
  FakeAudio.refusePlay = undefined
  FakeMediaSource.instances.length = 0
  FakeMediaSource.supported = true
  FakeMediaSource.addFailure = undefined
  FakeMediaSource.readyStateValue = 'open'
  fetchMock.mockReset()
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('MediaSource', FakeMediaSource)
  vi.stubGlobal('fetch', fetchMock)
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('SpeechAudio streaming path', () => {
  it('sends the whole reply in one request and plays as the audio arrives', async () => {
    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Primeira frase. Segunda frase.', { voice: 'voz' }, ended)

    await stream.push('AAA')
    await vi.waitFor(() => { expect(buffer().chunks.length).toBe(1) })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      text: 'Primeira frase. Segunda frase.',
      voice: 'voz',
    })
    expect(buffer().mode).toBe('sequence')

    await stream.push('BBB')
    await vi.waitFor(() => {
      expect(buffer().chunks.map(chunk => new TextDecoder().decode(chunk))).toEqual(['AAA', 'BBB'])
    })
    expect(element().paused).toBe(false)
    expect(ended).not.toHaveBeenCalled()

    await stream.close()
    await drained()
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
    expect(FakeMediaSource.instances[0]?.ended).toHaveBeenCalledOnce()
  })

  it('starts the element on the first frames only', async () => {
    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    const playing = new SpeechAudio().speak('Texto', undefined, () => {})
    // The element exists only once the response headers are in; the reader is
    // still silent until the first audio frames land.
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    expect(element().paused).toBe(true)
    await stream.push('A')
    await stream.push('B')
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    await stream.close()
    await drained()
    element().fire('ended')
    await playing
  })

  it('never starts audio when the provider streamed nothing', async () => {
    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Texto', undefined, ended)
    await stream.close()
    await playing
    expect(ended).not.toHaveBeenCalled()
  })

  it('refuses a response that carries no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('carried no body')
  })

  it('treats an element that already ended as finished', async () => {
    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Texto', undefined, ended)
    await stream.push('A')
    // The element reports its end while the reader is still receiving the rest.
    element().fire('ended')
    await stream.close()
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('stops mid-stream without reporting an end', async () => {
    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Texto', undefined, ended)
    await stream.push('A')
    audio.stop()
    await stream.close()
    await playing
    expect(ended).not.toHaveBeenCalled()
    expect(element().paused).toBe(true)
  })

  it('does not close a source the browser already closed', async () => {
    FakeMediaSource.readyStateValue = 'closed'
    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Texto', undefined, ended)
    await stream.push('A')
    await vi.waitFor(() => { expect(buffer().chunks.length).toBe(1) })
    await stream.close()
    // A closed source takes no end-of-stream call, so wait for the reader itself.
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    element().fire('ended')
    await playing
    expect(FakeMediaSource.instances[0]?.ended).not.toHaveBeenCalled()
    expect(ended).toHaveBeenCalledOnce()
  })

  it('finishes when the element reports an error instead of an end', async () => {
    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Texto', undefined, ended)
    await stream.push('A')
    await stream.close()
    await drained()
    // A decoder fault ends the run as surely as a natural end does.
    element().fire('error')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('ignores a prefetched sentence whose request fails', async () => {
    FakeMediaSource.supported = false
    let call = 0
    fetchMock.mockImplementation(async () => {
      call += 1
      if (call === 1) return new Response('AUDIO', { status: 200 })
      throw new Error('conexão caiu')
    })
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma. Duas.', undefined, ended)
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    // The lookahead for the second sentence is already in flight when the
    // reader stops, so its rejection must not surface as unhandled.
    audio.stop()
    FakeAudio.instances[0]?.fire('ended')
    await playing
    expect(ended).not.toHaveBeenCalled()
  })

  it('abandons a sentence whose request was still in flight when the reader stopped', async () => {
    FakeMediaSource.supported = false
    let release!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { release = resolve }))
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma.', undefined, ended)
    await vi.waitFor(() => { expect(fetchMock).toHaveBeenCalled() })
    // The stop lands while the sentence's request is still open.
    audio.stop()
    release(new Response('AUDIO', { status: 200 }))
    await playing
    expect(ended).not.toHaveBeenCalled()
    expect(FakeAudio.instances).toHaveLength(0)
  })

  it('reports a refused play', async () => {    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    FakeAudio.refusePlay = new Error('autoplay bloqueado')
    const playing = new SpeechAudio().speak('Texto', undefined, () => {})
    await stream.push('A')
    await expect(playing).rejects.toThrow('autoplay bloqueado')
  })

  it('reports a buffer the browser refuses to create', async () => {
    // The browser may refuse with an Error or with anything else it likes.
    for (const refusal of ['codec recusado', new Error('codec recusado')]) {
      const stream = streamedResponse()
      fetchMock.mockResolvedValue(stream.response)
      FakeMediaSource.addFailure = refusal
      await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('codec recusado')
      await stream.close()
    }
  })
})

describe('SpeechAudio fallbacks', () => {
  it('speaks sentence by sentence when the browser cannot stream MP3', async () => {    FakeMediaSource.supported = false
    fetchMock.mockImplementation(async () => new Response('AUDIO', { status: 200 }))
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Uma. Duas.', undefined, ended)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    element().fire('ended')
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(2) })
    FakeAudio.instances[1]?.fire('ended')
    await playing
    expect(fetchMock.mock.calls.map(call => requestedText(call[1]))).toEqual(['Uma.', 'Duas.'])
    expect(ended).toHaveBeenCalledOnce()
  })

  it('re-splits into sentences when the host refuses a larger request', async () => {
    // Only the oversized request is refused; the sentence-sized retries succeed.
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      const { text } = JSON.parse(init.body) as { text: string }
      return text.length > 5
        ? new Response(JSON.stringify({ error: 'text must be 1..5 characters' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
        : new Response('AUDIO', { status: 200 })
    })
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Uma. Duas.', undefined, ended)
    // One element per sentence: finish each as it appears, then the reply ends.
    for (const index of [0, 1]) {
      await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(index + 1) })
      FakeAudio.instances[index]?.fire('ended')
    }
    await playing
    const bodies = fetchMock.mock.calls.map(call => requestedText(call[1]))
    // The whole reply went first, then one request per sentence under the bound.
    expect(bodies[0]).toBe('Uma. Duas.')
    expect(bodies.slice(1)).toEqual(['Uma.', 'Duas.'])
    expect(ended).toHaveBeenCalledOnce()
  })

  it('surfaces a refusal that names no limit', async () => {
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({ error: 'serviço fora do ar' }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    ))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('serviço fora do ar')
  })

  it('falls back to the status line when the refusal is not the route JSON', async () => {
    fetchMock.mockResolvedValue(new Response('gateway timeout', { status: 504, statusText: 'Gateway Timeout' }))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('504 Gateway Timeout')
  })

  it('falls back to the status line when the refusal carries no message', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 42 }), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/json' },
    }))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('500 Internal Server Error')
  })

  it('ignores a refusal whose declared limit cannot be used', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'text must be 1..0 characters' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }))
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('1..0 characters')
  })

  it('splits a reply larger than one request and speaks it sentence by sentence', async () => {
    const sizes: number[] = []
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      sizes.push(requestedText(init).length)
      return new Response(JSON.stringify({ error: 'serviço fora do ar' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      })
    })
    // Past the per-request bound the streamed path is unavailable, so the reply
    // goes out one sentence at a time; the first refusal ends the run.
    await expect(new SpeechAudio().speak('Frase de teste. '.repeat(2000), undefined, vi.fn()))
      .rejects.toThrow('serviço fora do ar')
    expect(sizes).toHaveLength(1)
    expect(sizes[0]).toBeLessThanOrEqual(400)
  })

  it('speaks nothing at all for blank text', async () => {
    const ended = vi.fn()
    await new SpeechAudio().speak('   ', undefined, ended)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
  })

  it('releases playback on dispose', async () => {
    const stream = streamedResponse()
    fetchMock.mockResolvedValue(stream.response)
    const audio = new SpeechAudio()
    const playing = audio.speak('Texto', undefined, () => {})
    await stream.push('A')
    audio.dispose()
    await stream.close()
    await playing
    expect(element().paused).toBe(true)
  })

  it('reports a sentence the fallback path cannot play', async () => {
    FakeMediaSource.supported = false
    fetchMock.mockResolvedValue(new Response('AUDIO', { status: 200 }))
    FakeAudio.refusePlay = new Error('autoplay bloqueado')
    await expect(new SpeechAudio().speak('Uma.', undefined, () => {})).rejects.toThrow('autoplay bloqueado')
  })

  it('stops between fallback sentences without reporting an end', async () => {
    FakeMediaSource.supported = false
    fetchMock.mockImplementation(async () => new Response('AUDIO', { status: 200 }))
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma. Duas.', undefined, ended)
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    audio.stop()
    FakeAudio.instances[0]?.fire('ended')
    await playing
    // The second sentence never starts, and a stopped run reports no end.
    expect(FakeAudio.instances).toHaveLength(1)
    expect(ended).not.toHaveBeenCalled()
  })
})
