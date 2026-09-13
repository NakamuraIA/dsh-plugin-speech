/** Host wiring: the durable namespace and the two speech routes. */
import { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { describe, expect, it } from 'vitest'
import { apply, inject, name } from '../src/index.ts'
import { SPEECH_SPEAK_ROUTE, SPEECH_VOICES_ROUTE } from '../src/routes.ts'
import { DEFAULT_SPEECH_SETTINGS, SPEECH_SETTINGS_NAMESPACE } from '../src/settings.ts'

/** A settings provider that keeps the document in memory. */
class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

/** Boot the plugin over a web server that records what it claims. */
async function bench(): Promise<{ ctx: Context; routes: WebRoute[]; dispose: () => Promise<void> }> {
  const ctx = new Context()
  await ctx.plugin(MemorySettings).await()
  const routes: WebRoute[] = []
  ctx.provide('webServer', {
    register: (route: WebRoute) => {
      routes.push(route)
      return () => { routes.splice(routes.indexOf(route), 1) }
    },
  } as never)
  const fiber = ctx.plugin({ name, inject, apply })
  await fiber.await()
  return { ctx, routes, dispose: () => fiber.dispose() }
}

describe('ui-speech host', () => {
  it('registers the durable namespace with its schema defaults', async () => {
    const b = await bench()
    expect(b.ctx.settings.get(SPEECH_SETTINGS_NAMESPACE)).toEqual(DEFAULT_SPEECH_SETTINGS)
    await b.ctx.settings.update(SPEECH_SETTINGS_NAMESPACE, { skipCode: false, edge: { voice: 'voz' } })
    expect(b.ctx.settings.get(SPEECH_SETTINGS_NAMESPACE)).toMatchObject({
      skipCode: false,
      edge: { voice: 'voz' },
    })
    await expect(b.ctx.settings.update(SPEECH_SETTINGS_NAMESPACE, { provider: 'elevenlabs' })).rejects.toThrow()
    await b.dispose()
    expect(b.ctx.settings.describe().map(row => row.ns)).not.toContain(SPEECH_SETTINGS_NAMESPACE)
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
