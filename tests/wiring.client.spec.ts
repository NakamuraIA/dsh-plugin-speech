/**
 * Client wiring over doubles: the two slot registrations, the settings write
 * path, catalog loading, and teardown. This lane runs from the published
 * `@deepseek-ai/*` packages, so it stands in for the services the browser shell
 * provides instead of composing the real registries.
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject, SETTINGS_NS } from '../src/client/index.ts'
import { DEFAULT_SPEECH_SETTINGS, SPEECH_SETTINGS_NAMESPACE } from '../src/settings.ts'

// The action and row render atoms from the primitives package, whose published
// browser library imports its own build-time dependencies (clsx, diff, shiki…)
// at module scope. This lane tests wiring, not rendering, so the atoms are stubs
// and the components themselves are only handed to the slot registry.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const atom = (): null => null
  return {
    Button: atom,
    Menu: atom,
    Switch: atom,
    IconPlayOutlineRegular: atom,
    IconStopFillRegular: atom,
    IconChevronDownOutlineRegular: atom,
  }
})

/** One settings write as the transport receives it. */
interface SettingsOp {
  op: string
  path: readonly string[]
  value?: unknown
}

/** The row store as this spec drives it. */
type RowStore = { create: () => { getSnapshot: () => Record<string, unknown>; actions: unknown } }

/** The row's inject face as this spec drives it. */
interface RowFace {
  setProvider: (provider: string) => void
  setVoice: (voice: string) => void
  setTuning: (key: string, value: number) => void
  setSkipCode: (skip: boolean) => void
  test: (text: string, overrides: unknown) => void
}

/** One registration the slot registry double recorded. */
interface Registration {
  name: string
  spec: Record<string, unknown>
}

const SETTINGS_SLOT = 'settings.general.item'
const ACTION_SLOT = 'conversation.chat.assistant-actions'
const VOICES = [{ id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR' }]

/**
 * The slot registry double. It is a cordis Service for the same reason the real
 * one is: `this.ctx` inside a service call is the CALLER's fiber, so a
 * registration is bound to the caller's effect and goes away with it.
 */
class SlotDouble extends Service {
  private readonly records: Registration[] = []

  constructor(ctx: Context) {
    super(ctx, 'slots')
  }

  inject(_name: string, register: () => () => void): () => void {
    return this.ctx.effect(() => register())
  }

  register(spec: Record<string, unknown>, _component: unknown): () => void {
    const entry: Registration = { name: String(spec['name']), spec }
    this.records.push(entry)
    return () => { this.records.splice(this.records.indexOf(entry), 1) }
  }

  entries(name: string): Record<string, unknown>[] {
    return this.records.filter(entry => entry.name === name).map(entry => entry.spec)
  }

  get registrations(): readonly Registration[] { return this.records }
}

/**
 * Boot the plugin over the four services it injects.
 * @param mode - the settings persistence the form reports.
 * @param accepted - what the form answers for each write.
 * @returns the context, the recorded state, and the disposer.
 */
async function bench(mode: 'host' | 'memory' = 'host', accepted = true) {
  const ctx = new Context()
  const slots = new SlotDouble(ctx)
  const definitions: unknown[] = []
  const writes: SettingsOp[][] = []
  const localized: string[] = []

  const locale = {
    register(ns: string) { localized.push(ns); return () => {} },
  }
  ctx.provide('locale', locale as never)
  ctx.provide('uiConversation', {
    events: {
      register: (definition: unknown) => {
        definitions.push(definition)
        return () => { definitions.splice(definitions.indexOf(definition), 1) }
      },
    },
  } as never)
  const form = {
    getSnapshot: () => ({
      status: 'ready',
      value: DEFAULT_SPEECH_SETTINGS,
      base: undefined,
      user: undefined,
      revision: 0,
      writable: mode === 'host',
      mode,
    }),
    subscribe: () => () => {},
    set(field: string, value: unknown) { writes.push([{ op: 'set', path: [field], value }]); return Promise.resolve(accepted) },
    unset(field: string) { writes.push([{ op: 'unset', path: [field] }]); return Promise.resolve(accepted) },
    mutate(ops: readonly SettingsOp[]) { writes.push([...ops]); return Promise.resolve(accepted) },
  }
  ctx.provide('configForms', { get: (entryId: string) => {
    expect(entryId).toBe(SPEECH_SETTINGS_NAMESPACE)
    return form
  } } as never)

  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, slots, definitions, writes, localized, dispose: () => fiber.dispose() }
}

/** Read the settings row's injected write face. */
function rowFace(slots: SlotDouble): { face: RowFace; snapshot: () => Record<string, unknown> } {
  const entry = slots.entries(SETTINGS_SLOT)[0]
  const instance = (entry?.['store'] as RowStore).create()
  const factory = entry?.['inject'] as (actions: unknown) => RowFace
  return { face: factory(instance.actions), snapshot: instance.getSnapshot }
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ui-speech client wiring', () => {
  it('registers the read-aloud action and the settings row, with localized copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: VOICES }), { status: 200 })))
    const b = await bench()

    expect(b.slots.registrations.map(entry => `${entry.name} ${String(entry.spec['id'])} ${String(entry.spec['order'])}`)).toEqual([
      `${ACTION_SLOT} speech 20`,
      `${SETTINGS_SLOT} speech 13`,
    ])
    for (const entry of b.slots.registrations) expect(entry.spec['locale']).toBe(SETTINGS_NS)
    expect(b.localized).toEqual([SETTINGS_NS])
    expect(b.definitions).toHaveLength(1)
  })

  it('loads the catalog of the provider the section selects', async () => {
    const fetchLocal = vi.fn(async (_url: string) => new Response(JSON.stringify({ voices: VOICES }), { status: 200 }))
    vi.stubGlobal('fetch', fetchLocal)
    const b = await bench()
    rowFace(b.slots)
    expect(fetchLocal.mock.calls[0]?.[0]).toContain('/speech/voices?provider=edge')
  })

  it('writes a voice through one atomic nested mutation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: VOICES }), { status: 200 })))
    const b = await bench()
    const { face } = rowFace(b.slots)
    face.setVoice('pt-BR-ThalitaMultilingualNeural')
    await vi.waitFor(() => { expect(b.writes).toHaveLength(1) })
    expect(b.writes[0]).toEqual([
      { op: 'set', path: ['edge', 'voice'], value: 'pt-BR-ThalitaMultilingualNeural' },
    ])
  })

  it('writes a scalar preference through the field path', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: VOICES }), { status: 200 })))
    const b = await bench()
    const { face } = rowFace(b.slots)
    face.setSkipCode(false)
    face.setProvider('edge')
    face.setTuning('rate', 12)
    await vi.waitFor(() => { expect(b.writes).toHaveLength(3) })
    expect(b.writes[0]).toEqual([{ op: 'set', path: ['skipCode'], value: false }])
    expect(b.writes[1]).toEqual([{ op: 'set', path: ['provider'], value: 'edge' }])
    expect(b.writes[2]).toEqual([{ op: 'set', path: ['edge', 'rate'], value: 12 }])
  })

  it('labels a write the Host refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: VOICES }), { status: 200 })))
    const b = await bench('host', false)
    const { face, snapshot } = rowFace(b.slots)
    face.setSkipCode(false)
    await vi.waitFor(() => { expect(snapshot()['writeFailed']).toBe(true) })
  })

  it('keeps a memory-mode page process-local without claiming a failed write', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: [] }), { status: 200 })))
    const b = await bench('memory', false)
    const { face, snapshot } = rowFace(b.slots)
    face.setSkipCode(false)
    await vi.waitFor(() => { expect(b.writes).toHaveLength(1) })
    expect(snapshot()['writeFailed']).toBe(false)
  })

  it('takes both entries and the definition away with the plugin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ voices: VOICES }), { status: 200 })))
    const b = await bench()
    expect(b.slots.registrations).toHaveLength(2)
    await b.dispose()
    expect(b.slots.registrations).toHaveLength(0)
    expect(b.definitions).toHaveLength(0)
  })
})
