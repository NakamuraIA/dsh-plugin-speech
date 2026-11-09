// @vitest-environment jsdom
/** Browser playback: one request per reply, played while it arrives. */
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
  /** Playhead position the buffer guard measures its lead against. */
  currentTime = 0
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
  /**
   * Audio seconds one append is worth. Chosen so three appends clear the
   * playhead's head (6 s) while two stay below it, which is the boundary every
   * streaming spec is written around.
   */
  static secondsPerAppend = 2.4
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
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:test')

/** The body one synthesis request carried. */
const requested = (): Record<string, unknown> =>
  JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>

/** The blob the most recent playback was handed. */
const lastBlob = (): Blob => createObjectURL.mock.calls.at(-1)?.[0] as Blob

/** A refusal carrying the route's JSON shape. */
const refusal = (error: string, status = 400): Response =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  FakeAudio.instances.length = 0
  FakeAudio.refusePlay = undefined
  FakeMediaSource.instances.length = 0
  FakeMediaSource.supported = true
  FakeMediaSource.addFailure = undefined
  FakeSourceBuffer.secondsPerAppend = 2.4
  fetchMock.mockReset()
  createObjectURL.mockClear()
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('MediaSource', FakeMediaSource)
  vi.stubGlobal('fetch', fetchMock)
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('SpeechAudio streaming path', () => {
  it('sends the whole reply in one request and starts as the head arrives', async () => {
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Primeira frase. Segunda frase.', { voice: 'voz' }, ended)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(requested()).toEqual({ text: 'Primeira frase. Segunda frase.', voice: 'voz' })
    await vi.waitFor(() => { expect(buffer().mode).toBe('sequence') })

    // One chunk is 2.4 s, below the 6 s head: playback waits.
    await source.push('A')
    await source.push('B')
    await vi.waitFor(() => { expect(buffer().chunks.length).toBe(2) })
    expect(element().paused).toBe(true)

    // The third chunk reaches 7.2 s and speech begins, body still open.
    await source.push('C')
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    expect(fetchMock).toHaveBeenCalledOnce()

    await source.push('D')
    await source.close()
    await vi.waitFor(() => { expect(FakeMediaSource.instances[0]?.ended).toHaveBeenCalled() })
    expect(buffer().chunks.length).toBe(4)
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('keeps the audio already buffered when the body dies mid-reply', async () => {
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma frase.', undefined, ended)
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    // The service cut the connection: what is buffered still plays out.
    source.fail(new Error('Stream closed before the synthesis completed'))
    await vi.waitFor(() => { expect(FakeMediaSource.instances[0]?.ended).toHaveBeenCalled() })
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('plays the whole reply as one file when the buffer refuses to open', async () => {
    FakeMediaSource.addFailure = 'codec recusado'
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma frase.', undefined, ended)
    // Drain the body so the fallback has every byte to work with.
    await source.push('AAA')
    await source.push('BBB')
    await source.close()
    await vi.waitFor(() => { expect(lastBlob().size).toBe(6) })
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('stops the element and reports nothing when playback is stopped', async () => {
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma frase.', undefined, ended)
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    audio.stop()
    // A real stop also aborts the body; the fake one has to be closed by hand.
    await source.close()
    await playing
    expect(element().paused).toBe(true)
    expect(ended).not.toHaveBeenCalled()
  })

  it('takes the abort a pause causes to a pending play as a cancellation', async () => {
    FakeAudio.refusePlay = Object.assign(
      new Error('The play() request was interrupted by a call to pause().'),
      { name: 'AbortError' },
    )
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const ended = vi.fn()
    const playing = new SpeechAudio().speak('Uma frase.', undefined, ended)
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await expect(playing).resolves.toBeUndefined()
    expect(ended).not.toHaveBeenCalled()
  })

  it('reports a play the autoplay policy refused', async () => {
    FakeAudio.refusePlay = Object.assign(new Error('autoplay bloqueado'), { name: 'NotAllowedError' })
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const playing = new SpeechAudio().speak('Uma frase.', undefined, () => {})
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    // The refusal sends the reply down the whole-file path, which drains it.
    await source.close()
    await expect(playing).rejects.toThrow('autoplay bloqueado')
  })

  it('drops the element on dispose', async () => {
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const playing = audio.speak('Uma frase.', undefined, () => {})
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    audio.dispose()
    // A real stop also aborts the body; the fake one has to be closed by hand.
    await source.close()
    await playing
    expect(element().paused).toBe(true)
  })

  it('keeps the reply arriving while the reader holds the voice', async () => {
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const playing = audio.speak('Uma frase.', undefined, () => {})
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })

    audio.pause()
    expect(element().paused).toBe(true)
    const held = buffer().chunks.length
    // Holding the voice must not stop the synthesis behind it: the buffer keeps
    // growing so the reader comes back to a reply further along, not a silent
    // request that has to start over.
    await source.push('D')
    await source.push('E')
    await vi.waitFor(() => { expect(buffer().chunks.length).toBe(held + 2) })
    expect(element().paused).toBe(true)

    audio.resume()
    await vi.waitFor(() => { expect(element().paused).toBe(false) })

    await source.close()
    element().fire('ended')
    await playing
  })

  it('holds the voice when the buffer falls behind the playhead', async () => {
    FakeSourceBuffer.secondsPerAppend = 2
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const playing = audio.speak('Uma frase.', undefined, () => {})
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })

    // The playhead reaches the end of what arrived: the guard stops the voice
    // instead of letting it run dry and gap.
    element().currentTime = 5.5
    await vi.waitFor(() => { expect(element().paused).toBe(true) })

    // More audio lands: the lead is back above the high-water mark, so the guard
    // lets the voice continue from where it stopped.
    for (const chunk of ['D', 'E', 'F']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })

    await source.close()
    element().fire('ended')
    await playing
  })

  it('does not lift a hold the reader asked for', async () => {
    FakeSourceBuffer.secondsPerAppend = 2
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const playing = audio.speak('Uma frase.', undefined, () => {})
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })

    audio.pause()
    for (const chunk of ['D', 'E', 'F', 'G']) await source.push(chunk)
    // Plenty buffered, but the reader owns this pause.
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(element().paused).toBe(true)

    audio.resume()
    await vi.waitFor(() => { expect(element().paused).toBe(false) })

    await source.close()
    element().fire('ended')
    await playing
  })

  it('never holds the voice once the body is drained', async () => {
    FakeSourceBuffer.secondsPerAppend = 2
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma frase.', undefined, ended)
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })

    await source.close()
    // At the end of a reply the lead is zero by definition. The guard must not
    // read that as a stall: holding there clips the last words and leaves the
    // element paused short of 'ended', which is what a stuck button looked like.
    element().currentTime = 5.9
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(element().paused).toBe(false)

    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('replays a finished reply without asking the service again', async () => {
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const first = audio.speak('Uma frase.', undefined, () => {}, 'msg-1')
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    await source.close()
    element().fire('ended')
    await first
    expect(fetchMock).toHaveBeenCalledOnce()

    const ended = vi.fn()
    const replay = audio.speak('Uma frase.', undefined, ended, 'msg-1')
    expect(fetchMock).toHaveBeenCalledOnce()
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(2) })
    // The replay is one finished file: no MediaSource, no second request.
    expect(FakeMediaSource.instances).toHaveLength(1)
    expect(lastBlob().size).toBe(3)
    element().fire('ended')
    await replay
    expect(ended).toHaveBeenCalledOnce()
  })

  it('does not cache a reply the body cut short', async () => {
    const source = stream()
    fetchMock.mockResolvedValue(source.response)
    const audio = new SpeechAudio()
    const first = audio.speak('Uma frase.', undefined, () => {}, 'msg-1')
    for (const chunk of ['A', 'B', 'C']) await source.push(chunk)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    source.fail(new Error('conexão caiu'))
    await vi.waitFor(() => { expect(FakeMediaSource.instances[0]?.ended).toHaveBeenCalled() })
    element().fire('ended')
    await first

    // A truncated reply must not replay as the same truncation, so the next
    // attempt goes back to the service.
    FakeMediaSource.supported = false
    fetchMock.mockResolvedValue(new Response('AUDIO', { status: 200 }))
    const second = audio.speak('Uma frase.', undefined, () => {}, 'msg-1')
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(2) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    element().fire('ended')
    await second
  })
})

describe('SpeechAudio fallbacks', () => {
  it('plays one whole file when the engine has no MediaSource', async () => {
    FakeMediaSource.supported = false
    fetchMock.mockImplementation(async () => new Response('AUDIO', { status: 200 }))
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma frase.', undefined, ended)
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

  it('speaks nothing at all for blank text', async () => {
    const ended = vi.fn()
    await new SpeechAudio().speak('   \n  ', undefined, ended)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
  })
})
