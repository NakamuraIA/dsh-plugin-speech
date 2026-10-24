// @vitest-environment jsdom
/** Browser playback: one request per reply, one file played, and the fallbacks. */
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

/** The audio element the most recent play created. */
const element = (): FakeAudio => FakeAudio.instances.at(-1) as FakeAudio

/** An audio body the spec can hand back as a whole response. */
const audioResponse = (): Response => new Response('AUDIO', { status: 200 })

/** A refusal carrying the route's JSON shape. */
const refusal = (error: string, status = 400): Response =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const fetchMock = vi.fn<(_url: string, init: { body: string }) => Promise<Response>>()

/** The body one synthesis request carried. */
const requested = (index = 0): Record<string, unknown> =>
  JSON.parse(String(fetchMock.mock.calls[index]?.[1]?.body)) as Record<string, unknown>

beforeEach(() => {
  FakeAudio.instances.length = 0
  FakeAudio.refusePlay = undefined
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(audioResponse())
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('fetch', fetchMock)
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
})

afterEach(() => { vi.unstubAllGlobals() })

describe('SpeechAudio', () => {
  it('asks for the whole reply in one request and plays it as one file', async () => {
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Primeira frase. Segunda frase.', { voice: 'voz' }, ended)

    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(requested()).toEqual({ text: 'Primeira frase. Segunda frase.', voice: 'voz' })
    expect(element().paused).toBe(false)
    expect(ended).not.toHaveBeenCalled()

    element().fire('ended')
    await playing
    expect(ended).toHaveBeenCalledOnce()
  })

  it('waits for the whole body before touching the element', async () => {
    let release!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { release = resolve }))
    const playing = new SpeechAudio().speak('Texto', undefined, () => {})
    await vi.waitFor(() => { expect(fetchMock).toHaveBeenCalledOnce() })
    // Nothing is playing until the audio is in hand; a blob needs its bytes.
    expect(FakeAudio.instances).toHaveLength(0)
    release(audioResponse())
    await vi.waitFor(() => { expect(FakeAudio.instances).toHaveLength(1) })
    element().fire('ended')
    await playing
  })

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
      return text.length > 5 ? refusal('text must be 1..5 characters') : audioResponse()
    })
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Uma. Duas.', undefined, ended)
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    element().fire('ended')
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(2) })
    expect(FakeAudio.instances[1]?.paused).toBe(false)
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

  it('speaks a reply larger than one request sentence by sentence', async () => {
    const audio = new SpeechAudio()
    const playing = audio.speak('Frase. '.repeat(4000), undefined, () => {})
    await vi.waitFor(() => { expect(FakeAudio.instances.length).toBe(1) })
    // No single request could carry this reply, so the first one is a sentence.
    expect(requested().text).toBe('Frase.')
    await vi.waitFor(() => { expect(fetchMock.mock.calls.length).toBeGreaterThan(1) })
    audio.stop()
    await playing
    expect(FakeAudio.instances[0]?.paused).toBe(true)
  })

  it('speaks nothing at all for blank text', async () => {
    const ended = vi.fn()
    await new SpeechAudio().speak('   \n  ', undefined, ended)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
  })

  it('takes the abort a pause causes to a pending play as a cancellation', async () => {
    // This is what a second click on the play button produces: the element is
    // paused while play() is still settling, and the platform rejects it.
    FakeAudio.refusePlay = Object.assign(
      new Error('The play() request was interrupted by a call to pause().'),
      { name: 'AbortError' },
    )
    const ended = vi.fn()
    await expect(new SpeechAudio().speak('Texto', undefined, ended)).resolves.toBeUndefined()
    expect(ended).not.toHaveBeenCalled()
  })

  it('reports a play the autoplay policy refused', async () => {
    FakeAudio.refusePlay = Object.assign(new Error('autoplay bloqueado'), { name: 'NotAllowedError' })
    await expect(new SpeechAudio().speak('Texto', undefined, () => {})).rejects.toThrow('autoplay bloqueado')
  })

  it('stops the element and reports nothing when playback is stopped', async () => {
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Texto', undefined, ended)
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    audio.stop()
    await playing
    expect(element().paused).toBe(true)
    expect(ended).not.toHaveBeenCalled()
  })

  it('abandons a reply whose request was still in flight when it was stopped', async () => {
    let release!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { release = resolve }))
    const audio = new SpeechAudio()
    const ended = vi.fn()
    const playing = audio.speak('Texto', undefined, ended)
    await vi.waitFor(() => { expect(fetchMock).toHaveBeenCalledOnce() })
    audio.stop()
    release(audioResponse())
    await playing
    // A run superseded while its bytes were in flight never reaches an element.
    expect(FakeAudio.instances).toHaveLength(0)
    expect(ended).not.toHaveBeenCalled()
  })

  it('drops the element on dispose', async () => {
    const audio = new SpeechAudio()
    const playing = audio.speak('Texto', undefined, () => {})
    await vi.waitFor(() => { expect(element().paused).toBe(false) })
    audio.dispose()
    await playing
    expect(element().paused).toBe(true)
  })
})
