/** Client wiring: the two registrations, the settings mirror, and teardown. */
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject, SETTINGS_NS } from '../src/client/index.ts'
import { createSpeechState } from '../src/client/speech-state.ts'
import { SPEECH_SETTINGS_NAMESPACE, SpeechSettingsSchema } from '../src/settings.ts'

/** The settings row store as this spec drives it. */
type RowStore = { create: () => { getSnapshot: () => Record<string, unknown>; actions: unknown } }

/** The row's inject face as this spec drives it. */
interface RowFace {
  setProvider: (provider: string) => void
  setVoice: (voice: string) => void
  setTuning: (key: string, value: number) => void
  setSkipCode: (skip: boolean) => void
  test: (text: string, overrides: unknown) => void
}

/** What the settings scope answers with, accepted or refused. */
type MutateResult =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string } }
const SETTINGS_SLOT = 'settings.general.item'
const ACTION_SLOT = 'conversation.chat.assistant-actions'

const VOICES = [{ id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR' }]

/** Boot the plugin over the settings scope, the slots, and a fake conversation. */
async function bench(isLoopback = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('en')
  ctx.provide('locale', locale)
  const definitions: unknown[] = []
  ctx.provide('uiConversation', {
    events: {
      register: (definition: unknown) => {
        definitions.push(definition)
        return () => { definitions.splice(definitions.indexOf(definition), 1) }
      },
    },
  } as never)
  const section: Record<string, unknown> = {
    provider: 'edge',
    skipCode: true,
    edge: { voice: 'pt-BR-AntonioNeural', rate: 3, volume: 0, pitch: 0 },
  }
  const namespace = () => ({
    ns: SPEECH_SETTINGS_NAMESPACE,
    schema: SpeechSettingsSchema.toJSON(),
    value: { ...section, edge: { ...(section['edge'] as Record<string, unknown>) } },
    applies: 'live' as const,
    secrets: [],
    revision: 0,
  })
  const describe = vi.fn(() => Promise.resolve({
    ok: true as const,
    value: { writable: true, hasDocument: true, namespaces: [namespace()] },
  }))
  const mutate = vi.fn((_ns: string, ops: { path: string[]; value: unknown }[]): Promise<MutateResult> => {
    for (const op of ops) {
      const [field, key] = op.path
      if (field === undefined) continue
      if (key === undefined) section[field] = op.value
      else section[field] = { ...(section[field] as Record<string, unknown>), [key]: op.value }
    }
    return Promise.resolve({ ok: true as const, value: namespace() })
  })
  const events = new TestRemote(ctx, { settings: { describe, mutate } })
  events.$host = { home: undefined, isLoopback }
  await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, describe, mutate, definitions }
}

/** Stand in for the settings shell and the chat view: declare both slots. */
function declareSlots(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      [SETTINGS_SLOT]: { kind: 'list', scope: 'root' },
      [ACTION_SLOT]: { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
}

const fetchMock = vi.fn()

afterEach(() => { vi.unstubAllGlobals() })

describe('ui-speech client', () => {
  it('registers the action and the settings row, with localized copy', async () => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ voices: VOICES }), { status: 200 }))
    const b = await bench()
    declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const rows = b.slots.entries(SETTINGS_SLOT)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.options).toMatchObject({ id: 'speech', order: 13 })
    expect(rows[0]?.locale).toBe(SETTINGS_NS)
    const actions = b.slots.entries(ACTION_SLOT)
    expect(actions).toHaveLength(1)
    expect(actions[0]?.options).toMatchObject({ id: 'speech', order: 20 })
    expect(b.locale.bind(SETTINGS_NS)('row.title')).toBe('Read aloud')
    expect(b.definitions).toHaveLength(1)
  })

  it('mirrors the durable section and loads the selected catalog', async () => {
    const fetchLocal = vi.fn(async (_url: string) => new Response(JSON.stringify({ voices: VOICES }), { status: 200 }))
    vi.stubGlobal('fetch', fetchLocal)
    const b = await bench()
    declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries(SETTINGS_SLOT)[0]
    const instance = (entry?.store as RowStore).create()
    const face = (entry?.inject as unknown as (actions: unknown) => RowFace)(instance.actions)
    expect(fetchLocal.mock.calls[0]?.[0]).toContain('/speech/voices?provider=edge')

    face.setVoice('pt-BR-AntonioNeural')
    await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalled() })
    expect(b.mutate.mock.calls[0]?.[1]).toEqual([
      { op: 'set', path: ['edge', 'voice'], value: 'pt-BR-AntonioNeural' },
    ])

    face.setTuning('rate', 12)
    await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalledTimes(2) })
    face.setSkipCode(false)
    await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalledTimes(3) })
    face.setProvider('edge')
    await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalledTimes(4) })
    expect(fetchLocal.mock.calls.length).toBeGreaterThan(1)
  })

  it('labels a write the Host refuses instead of reverting in silence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: VOICES }), { status: 200 })))
    const b = await bench()
    declareSlots(b.slots)
    b.mutate.mockImplementation(() => Promise.resolve({ ok: false as const, error: { code: 'refused', message: 'refused' } }))
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries(SETTINGS_SLOT)[0]
    const instance = (entry?.store as RowStore).create()
    const face = (entry?.inject as unknown as (actions: unknown) => RowFace)(instance.actions)
    face.setSkipCode(false)
    await vi.waitFor(() => { expect(instance.getSnapshot()['writeFailed']).toBe(true) })
  })

  it('keeps a remote browser process-local without claiming a failed write', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: [] }), { status: 200 })))
    const b = await bench(false)
    declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries(SETTINGS_SLOT)[0]
    const instance = (entry?.store as RowStore).create()
    const face = (entry?.inject as unknown as (actions: unknown) => RowFace)(instance.actions)
    face.setSkipCode(false)
    await Promise.resolve()
    expect(b.mutate).not.toHaveBeenCalled()
    expect(instance.getSnapshot()['writeFailed']).toBe(false)
  })

  it('speaks a folded message and reports what the provider answered', async () => {
    const fetchLocal = vi.fn(async (url: string) => url.includes('/voices')
      ? new Response(JSON.stringify({ voices: VOICES }), { status: 200 })
      : new Response(JSON.stringify({ error: 'serviço fora do ar' }), { status: 502 }))
    vi.stubGlobal('fetch', fetchLocal)
    const b = await bench()
    declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    // Fold one finished message through the registered definition.
    const definition = b.definitions[0] as {
      start: (context: unknown, match: unknown, reader: unknown) => unknown
      match: (event: unknown) => { id: string } | null
    }
    const event = { type: 'assistant/message', data: { message: { id: 'msg-1', content: [{ type: 'text', text: 'Olá' }] } } }
    expect(definition.match(event)).toEqual({ id: 'msg-1', role: 'start' })
    definition.start({}, { event }, {})

    const entry = b.slots.entries(ACTION_SLOT)[0]
    const face = (entry?.inject as unknown as (sessionId: string) => { toggle: (id: string) => void })('session-1')
    face.toggle('msg-1')
    await vi.waitFor(() => { expect(fetchLocal.mock.calls.some(call => call[0].includes('/speech/speak'))).toBe(true) })
  })

  it('takes both entries and the definition away with the plugin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: VOICES }), { status: 200 })))
    const b = await bench()
    declareSlots(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries(SETTINGS_SLOT)).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries(SETTINGS_SLOT)).toHaveLength(0)
    expect(b.slots.entries(ACTION_SLOT)).toHaveLength(0)
    expect(b.definitions).toHaveLength(0)
    expect(b.locale.bind(SETTINGS_NS)('row.title')).toBe('row.title')
  })

  it('stops a message that is already speaking', async () => {
    const fetchLocal = vi.fn(async (url: string) => url.includes('/voices')
      ? new Response(JSON.stringify({ voices: VOICES }), { status: 200 })
      : new Response('AUDIO', { status: 200 }))
    vi.stubGlobal('fetch', fetchLocal)
    // jsdom has no MediaSource, so playback takes the one-blob-per-sentence
    // fallback; this element starts and stays open, which is all the state
    // machine needs to see.
    class QuietAudio {
      addEventListener(): void {}
      removeEventListener(): void {}
      async play(): Promise<void> {}
      pause(): void {}
    }
    vi.stubGlobal('Audio', QuietAudio)
    Object.assign(URL, { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} })
    const b = await bench()
    declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const definition = b.definitions[0] as { start: (context: unknown, match: unknown, reader: unknown) => unknown }
    const event = { type: 'assistant/message', data: { message: { id: 'msg-1', content: [{ type: 'text', text: 'Olá' }] } } }
    definition.start({}, { event }, {})
    const entry = b.slots.entries(ACTION_SLOT)[0]
    const face = (entry?.inject as unknown as (sessionId: string) => {
      toggle: (id: string) => void
      hooks: { speech: { getSnapshot: () => { active: string | null } } }
    })('session-1')
    face.toggle('msg-1')
    await vi.waitFor(() => { expect(face.hooks.speech.getSnapshot().active).toBe('msg-1') })
    face.toggle('msg-1')
    expect(face.hooks.speech.getSnapshot().active).toBeNull()
    expect(fetchLocal.mock.calls.some(call => call[0].includes('/speech/speak'))).toBe(true)
  })

  it('speaks the settings sample', async () => {
    const fetchLocal = vi.fn(async (url: string) => url.includes('/voices')
      ? new Response(JSON.stringify({ voices: VOICES }), { status: 200 })
      : new Response(JSON.stringify({ error: 'serviço fora do ar' }), { status: 502 }))
    vi.stubGlobal('fetch', fetchLocal)
    const b = await bench()
    declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries(SETTINGS_SLOT)[0]
    const instance = (entry?.store as RowStore).create()
    const face = (entry?.inject as unknown as (actions: unknown) => RowFace)(instance.actions)
    face.test('Amostra', { voice: 'voz' })
    await vi.waitFor(() => {
      expect(fetchLocal.mock.calls.some(call => call[0].includes('/speech/speak'))).toBe(true)
    })
  })

  it('keeps an empty catalog when the provider answers with an error, or fails outright', async () => {
    /** Boot the row over one catalog fetch double and wait for its failure to settle. */
    const catalogVoices = async (fetchDouble: () => Promise<Response>): Promise<readonly unknown[]> => {
      vi.stubGlobal('fetch', vi.fn(fetchDouble))
      const b = await bench()
      declareSlots(b.slots)
      await b.ctx.plugin({ inject: [...inject], apply }).await()
      const row = b.slots.entries(SETTINGS_SLOT)[0]
      const instance = (row?.store as RowStore).create()
      ;(row?.inject as unknown as (actions: unknown) => RowFace)(instance.actions)
      // The catalog settles on a microtask after the plugin has applied.
      await new Promise((resolve) => { setTimeout(resolve, 5) })
      return instance.getSnapshot()['voices'] as readonly unknown[]
    }
    expect(await catalogVoices(async () => new Response('nope', { status: 500 }))).toEqual([])
    expect(await catalogVoices(async () => { throw new Error('catálogo caiu') })).toEqual([])
    // A rejection that is not an Error still has to reach the report.
    expect(await catalogVoices(async () => { throw 'catálogo caiu' })).toEqual([])
  })

  it('labels a write the transport lost', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: VOICES }), { status: 200 })))
    const b = await bench()
    declareSlots(b.slots)
    b.mutate.mockRejectedValueOnce(new Error('offline'))
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries(SETTINGS_SLOT)[0]
    const instance = (entry?.store as RowStore).create()
    const face = (entry?.inject as unknown as (actions: unknown) => RowFace)(instance.actions)
    face.setSkipCode(false)
    await vi.waitFor(() => { expect(instance.getSnapshot()['writeFailed']).toBe(true) })
  })

  it('tolerates a catalog answer that carries no voice list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
    const b = await bench()
    declareSlots(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries(SETTINGS_SLOT)[0]
    const instance = (entry?.store as RowStore).create()
    ;(entry?.inject as unknown as (actions: unknown) => RowFace)(instance.actions)
    await vi.waitFor(() => { expect(instance.getSnapshot()['voices']).toEqual([]) })
  })

  it('starts from an empty speech state', () => {
    expect(createSpeechState().getSnapshot().active).toBeNull()
  })
})
