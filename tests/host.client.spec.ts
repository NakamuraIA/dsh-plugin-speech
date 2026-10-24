/** Host wiring: the entry config the settings form edits, and the two speech routes. */
import { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { describe, expect, it } from 'vitest'
import { Config, apply, inject, name } from '../src/index.ts'
import { SPEECH_SPEAK_ROUTE, SPEECH_VOICES_ROUTE } from '../src/routes.ts'
import { DEFAULT_SPEECH_SETTINGS, SpeechSettingsSchema } from '../src/settings.ts'

/** The slice of a schemastery node this spec reads. */
interface SchemaNode {
  meta: { volatile?: boolean | undefined }
  dict?: Record<string, SchemaNode> | undefined
}

/**
 * Boot the plugin over a web server that records what it claims.
 * @param withConfig - whether the entry declares config, as the Loader does.
 * @returns the context, the claimed routes, and the disposer.
 */
async function bench(withConfig = true): Promise<{ ctx: Context; routes: WebRoute[]; dispose: () => Promise<void> }> {
  const ctx = new Context()
  const routes: WebRoute[] = []
  ctx.provide('webServer', {
    register: (route: WebRoute) => {
      routes.push(route)
      return () => { routes.splice(routes.indexOf(route), 1) }
    },
  } as never)
  const fiber = withConfig
    ? ctx.plugin({ name, inject, Config, apply }, { edge: { voice: 'pt-BR-ThalitaMultilingualNeural' } })
    : ctx.plugin({ name, inject, apply })
  await fiber.await()
  return { ctx, routes, dispose: () => fiber.dispose() }
}

describe('ui-speech host', () => {
  it('publishes its editable preferences as the entry config', () => {
    // The schema is the plugin's Cordis Config, which is also the settings form:
    // the profile entry id (`ui-speech`) names the namespace the browser writes to.
    expect(Config).toBe(SpeechSettingsSchema)
    expect(name).toBe('ui-speech')
    const dict = (SpeechSettingsSchema as unknown as SchemaNode).dict ?? {}
    expect(Object.keys(dict)).toEqual(['provider', 'skipCode', 'edge'])
    for (const key of ['provider', 'skipCode']) expect(dict[key]?.meta.volatile).toBe(true)
    const edge = dict['edge']?.dict ?? {}
    for (const key of ['voice', 'rate', 'volume', 'pitch']) expect(edge[key]?.meta.volatile).toBe(true)
  })

  it('resolves the preferences the composition declares, over the schema defaults', () => {
    const parsed = SpeechSettingsSchema({ edge: { voice: 'voz', rate: 5 } }) as unknown as {
      provider: { get: () => string }
      edge: { voice: { get: () => string }; rate: { get: () => number }; pitch: { get: () => number } }
    }
    expect(parsed.provider.get()).toBe(DEFAULT_SPEECH_SETTINGS.provider)
    expect(parsed.edge.voice.get()).toBe('voz')
    expect(parsed.edge.rate.get()).toBe(5)
    expect(parsed.edge.pitch.get()).toBe(DEFAULT_SPEECH_SETTINGS.edge.pitch)
  })

  it('claims exactly the two exact routes and releases them with the plugin', async () => {
    const b = await bench()
    expect(b.routes.map(route => `${route.kind} ${route.path}`)).toEqual([
      `exact ${SPEECH_SPEAK_ROUTE}`,
      `exact ${SPEECH_VOICES_ROUTE}`,
    ])
    await b.dispose()
    expect(b.routes).toHaveLength(0)
  })

  it('still runs when the entry declares no config at all', async () => {
    const b = await bench(false)
    expect(b.routes).toHaveLength(2)
    await b.dispose()
  })

  it('answers the routes it claimed', async () => {
    const b = await bench()
    const state = { status: 0 }
    const res = {
      writeHead(status: number) { state.status = status; return res },
      end() {},
    }
    for (const route of b.routes) {
      // Each route refuses the other's verb: synthesis takes POST, the catalog
      // takes GET.
      const method = route.path.endsWith('/speak') ? 'GET' : 'POST'
      await route.handler({ method, url: route.path } as never, res as never)
      expect(state.status).toBe(405)
    }
    await b.dispose()
  })
})
