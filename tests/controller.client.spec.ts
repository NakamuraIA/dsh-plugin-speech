/** Read-aloud orchestration: the prose fold, the state machine, and playback. */
import { describe, expect, it, vi } from 'vitest'
import { SpeechController } from '../src/client/controller.ts'
import { createSpeechState } from '../src/client/speech-state.ts'
import type { SpeechAudio, SpeechOverrides } from '../src/client/speech-audio.ts'

/** One recorded speak call. */
interface Call {
  readonly text: string
  readonly overrides: SpeechOverrides | undefined
  readonly cacheKey: string | undefined
  readonly finish: () => void
}

/** A playback double the spec drives by hand. */
function fakeAudio(): {
  audio: SpeechAudio
  calls: Call[]
  stopped: number
  disposed: number
  paused: number
  resumed: number
  fail: (error: Error) => void
} {
  const calls: Call[] = []
  let failure: Error | undefined
  const double = {
    stopped: 0,
    disposed: 0,
    paused: 0,
    resumed: 0,
    async speak(
      text: string,
      overrides: SpeechOverrides | undefined,
      onEnded: () => void,
      cacheKey?: string,
    ): Promise<void> {
      if (failure !== undefined) throw failure
      await new Promise<void>((resolve) => {
        calls.push({ text, overrides, cacheKey, finish: () => { onEnded(); resolve() } })
      })
    },
    pause(): void { double.paused += 1 },
    resume(): void { double.resumed += 1 },
    stop(): void { double.stopped += 1 },
    dispose(): void { double.disposed += 1 },
  }
  return {
    audio: double as unknown as SpeechAudio,
    calls,
    get stopped() { return double.stopped },
    get disposed() { return double.disposed },
    get paused() { return double.paused },
    get resumed() { return double.resumed },
    fail: (error: Error) => { failure = error },
  }
}

const MESSAGE = 'msg-1'

describe('SpeechController', () => {
  it('folds message prose once and ignores a repeat fold', () => {
    const state = createSpeechState()
    const controller = new SpeechController(state, fakeAudio().audio, () => {})
    controller.record(MESSAGE, 'Primeira versão')
    expect(state.getSnapshot().sources.get(MESSAGE)).toBe('Primeira versão')
    controller.record(MESSAGE, 'Primeira versão')
    controller.record('msg-2', 'Outra')
    expect(state.getSnapshot().sources.size).toBe(2)
  })

  it('speaks a folded message and clears the active mark when playback ends', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, '**Olá** mundo.')
    const spoken = controller.speak(MESSAGE, { skipCode: true })
    expect(state.getSnapshot().active).toBe(MESSAGE)
    expect(state.getSnapshot().failure).toBeNull()
    expect(audio.calls[0]?.text).toBe('Olá mundo.')
    audio.calls[0]?.finish()
    await spoken
    expect(state.getSnapshot().active).toBeNull()
  })

  it('passes preview overrides straight through', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, 'Texto')
    const overrides: SpeechOverrides = { voice: 'voz', tuning: { rate: 5 } }
    const spoken = controller.speak(MESSAGE, { skipCode: true }, overrides)
    expect(audio.calls[0]?.overrides).toBe(overrides)
    audio.calls[0]?.finish()
    await spoken
  })

  it('marks a message whose prose projected away, without calling playback', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, '```js\nconst x = 1\n```')
    await controller.speak(MESSAGE, { skipCode: true })
    expect(state.getSnapshot().failure).toBe('unavailable')
    expect(state.getSnapshot().detail).toBeNull()
    expect(audio.calls).toHaveLength(0)
  })

  it('marks a message the log never delivered', async () => {
    const state = createSpeechState()
    const controller = new SpeechController(state, fakeAudio().audio, () => {})
    await controller.speak('desconhecida', { skipCode: true })
    expect(state.getSnapshot().failure).toBe('unavailable')
  })

  it('reports a provider failure with its detail and keeps the message marked', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const reported: string[] = []
    const controller = new SpeechController(state, audio.audio, (message) => { reported.push(message) })
    controller.record(MESSAGE, 'Texto')
    audio.fail(new Error('serviço fora do ar'))
    await controller.speak(MESSAGE, { skipCode: true })
    expect(state.getSnapshot()).toMatchObject({
      active: MESSAGE,
      failure: 'provider',
      detail: 'serviço fora do ar',
    })
    expect(reported).toEqual(['serviço fora do ar'])
  })

  it('reports a non-Error rejection as its string form', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, 'Texto')
    audio.fail('caiu' as unknown as Error)
    await controller.speak(MESSAGE, { skipCode: true })
    expect(state.getSnapshot().detail).toBe('caiu')
  })

  it('does not report a failure from a run a newer request replaced', async () => {
    const state = createSpeechState()
    let rejectFirst!: (error: Error) => void
    const audio = {
      speak: vi.fn()
        .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectFirst = reject }))
        .mockImplementationOnce(() => new Promise<void>(() => {})),
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as SpeechAudio
    const reported = vi.fn()
    const controller = new SpeechController(state, audio, reported)
    controller.record(MESSAGE, 'Olá.')
    controller.record('msg-2', 'Outra.')
    const first = controller.speak(MESSAGE, { skipCode: true })
    const second = controller.speak('msg-2', { skipCode: true })
    rejectFirst(new Error('serviço fora do ar'))
    await first
    // The newer run owns the row now; the old failure must not paint over it.
    expect(state.getSnapshot()).toMatchObject({ active: 'msg-2', failure: null })
    expect(reported).not.toHaveBeenCalled()
    void second
  })

  it('speaks a sample through the settings on screen', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    const spoken = controller.speakSample('Amostra', { rate: 1 } as unknown as SpeechOverrides)
    expect(audio.calls[0]?.text).toBe('Amostra')
    expect(audio.calls[0]?.overrides).toEqual({ rate: 1 })
    expect(state.getSnapshot().active).toBeNull()
    audio.calls[0]?.finish()
    await spoken
  })

  it('does not clear a message a newer request already took over', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, 'Texto')
    const spoken = controller.speak(MESSAGE, { skipCode: true })
    // Another message became active while the first was still speaking.
    state.set({ ...state.getSnapshot(), active: 'msg-2' })
    audio.calls[0]?.finish()
    await spoken
    expect(state.getSnapshot().active).toBe('msg-2')
  })

  it('clears the active mark when the reader stops mid-speech', () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, 'Texto')
    void controller.speak(MESSAGE, { skipCode: true })
    expect(state.getSnapshot().active).toBe(MESSAGE)
    controller.stop()
    expect(audio.stopped).toBe(1)
    expect(state.getSnapshot().active).toBeNull()
  })

  it('ignores a blank sample and reports a sample failure', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const reported: string[] = []
    const controller = new SpeechController(state, audio.audio, (message) => { reported.push(message) })
    await controller.speakSample('   ', {})
    expect(audio.calls).toHaveLength(0)
    audio.fail(new Error('amostra falhou'))
    await controller.speakSample('Amostra', {})
    expect(reported).toEqual(['amostra falhou'])
  })

  it('stops playback and clears the active mark', () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.stop()
    expect(audio.stopped).toBe(1)
    expect(state.getSnapshot().active).toBeNull()
  })

  it('releases playback on dispose', () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.dispose()
    expect(audio.disposed).toBe(1)
    expect(state.getSnapshot().active).toBeNull()
  })

  it('starts a fresh state source', () => {
    const state = createSpeechState()
    expect(state.getSnapshot()).toEqual({
      active: null, paused: false, failure: null, detail: null, sources: new Map(),
    })
    const listener = vi.fn()
    state.subscribe(listener)
    expect(listener).not.toHaveBeenCalled()
    expect(state.getSnapshot().sources.size).toBe(0)
  })

  it('holds the active reading instead of restarting it', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, 'Uma frase longa.')
    const spoken = controller.speak(MESSAGE, { skipCode: true })

    await controller.toggle(MESSAGE, { skipCode: true })
    expect(audio.paused).toBe(1)
    expect(audio.stopped).toBe(0)
    expect(state.getSnapshot().paused).toBe(true)
    // The reading was held, not restarted: still one synthesis in flight.
    expect(audio.calls).toHaveLength(1)

    await controller.toggle(MESSAGE, { skipCode: true })
    expect(audio.resumed).toBe(1)
    expect(state.getSnapshot().paused).toBe(false)
    expect(audio.calls).toHaveLength(1)

    audio.calls[0]?.finish()
    await spoken
    expect(state.getSnapshot().active).toBeNull()
  })

  it('speaks a different message instead of holding the active one', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, 'Primeira.')
    controller.record('msg-2', 'Segunda.')
    const first = controller.speak(MESSAGE, { skipCode: true })
    void controller.toggle('msg-2', { skipCode: true })
    expect(state.getSnapshot().active).toBe('msg-2')
    expect(audio.paused).toBe(0)
    expect(audio.calls).toHaveLength(2)
    audio.calls[0]?.finish()
    audio.calls[1]?.finish()
    await first
  })

  it('caches a reading under the message id, but never a preview', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, 'Texto.')

    const spoken = controller.speak(MESSAGE, { skipCode: true })
    expect(audio.calls[0]?.cacheKey).toBe(MESSAGE)
    audio.calls[0]?.finish()
    await spoken

    const preview = controller.speak(MESSAGE, { skipCode: true }, { voice: 'outra' })
    expect(audio.calls[1]?.cacheKey).toBe('')
    audio.calls[1]?.finish()
    await preview
  })

  it('clears a pause with the active mark when stopped', async () => {
    const state = createSpeechState()
    const audio = fakeAudio()
    const controller = new SpeechController(state, audio.audio, () => {})
    controller.record(MESSAGE, 'Texto.')
    const spoken = controller.speak(MESSAGE, { skipCode: true })
    await controller.toggle(MESSAGE, { skipCode: true })
    controller.stop()
    expect(state.getSnapshot().paused).toBe(false)
    expect(state.getSnapshot().active).toBeNull()
    audio.calls[0]?.finish()
    await spoken
  })
})
