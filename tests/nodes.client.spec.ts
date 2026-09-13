/** The state-only Conversation Definition that feeds read-aloud its text. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { describe, expect, it, vi } from 'vitest'
import { registerSpeechText } from '../src/client/nodes.ts'
import type { SpeechController } from '../src/client/controller.ts'

/** One assistant message event carrying the given content blocks. */
function assistantEvent(id: string, content: readonly unknown[]): unknown {
  return { type: 'assistant/message', data: { message: { id, content } } }
}

/** A context that captures the registered definition and its disposer. */
function bench(): {
  ctx: ClientContext
  definition: () => ConversationNodeDefinition<{ readonly messageId: string }> | undefined
  dispose: () => void
} {
  let captured: ConversationNodeDefinition<{ readonly messageId: string }> | undefined
  const disposers: (() => void)[] = []
  const ctx = {
    effect: (install: () => () => void) => { disposers.push(install()) },
    uiConversation: {
      events: {
        register: (definition: ConversationNodeDefinition<{ readonly messageId: string }>) => {
          captured = definition
          return () => { captured = undefined }
        },
      },
    },
  } as unknown as ClientContext
  return {
    ctx,
    definition: () => captured,
    dispose: () => { for (const disposer of disposers) disposer() },
  }
}

/** A controller double recording what the fold hands it. */
function controllerSpy(): { controller: SpeechController; recorded: [string, string][] } {
  const recorded: [string, string][] = []
  const controller = {
    record: (messageId: string, source: string) => { recorded.push([messageId, source]) },
  } as unknown as SpeechController
  return { controller, recorded }
}

describe('registerSpeechText', () => {
  it('matches only a finalized assistant message and keys it by message id', () => {
    const b = bench()
    const { controller } = controllerSpy()
    registerSpeechText(b.ctx, controller)
    const definition = b.definition()
    expect(definition).toBeDefined()
    expect(definition?.kind).toBe('speech-text')
    expect(definition?.match({ type: 'turn/start' } as never)).toBeNull()
    expect(definition?.match(assistantEvent('m1', []) as never)).toEqual({ id: 'm1', role: 'start' })
  })

  it('joins the text blocks and ignores every other block kind', () => {
    const b = bench()
    const { controller, recorded } = controllerSpy()
    registerSpeechText(b.ctx, controller)
    const definition = b.definition()
    const event = assistantEvent('m1', [
      { type: 'reasoning', text: 'pensando' },
      { type: 'text', text: 'Primeiro' },
      { type: 'tool-call', callId: 'c1', name: 'read', argsRaw: '{}' },
      { type: 'text', text: 'Segundo' },
    ])
    definition?.start({} as never, { event } as never, {} as never)
    expect(recorded).toEqual([['m1', 'Primeiro\n\nSegundo']])
  })

  it('refuses to start on an event it did not match', () => {
    const b = bench()
    registerSpeechText(b.ctx, controllerSpy().controller)
    const definition = b.definition()
    expect(() => definition?.start({} as never, { event: { type: 'turn/start' } } as never, {} as never))
      .toThrow('assistant/message')
  })

  it('folds a replayed finalized message again and passes other updates through', () => {
    const b = bench()
    const { controller, recorded } = controllerSpy()
    registerSpeechText(b.ctx, controller)
    const definition = b.definition()
    const state = { messageId: 'm1' }
    const event = assistantEvent('m1', [{ type: 'text', text: 'De novo' }])
    const returned = definition?.update({ state } as never, { event } as never)
    expect(recorded).toEqual([['m1', 'De novo']])
    expect(returned).toBe(state)
    const untouched = definition?.update({ state } as never, { event: { type: 'turn/end' } } as never)
    expect(untouched).toBe(state)
    expect(recorded).toHaveLength(1)
  })

  it('leaves the registry with the owning plugin', () => {
    const b = bench()
    registerSpeechText(b.ctx, controllerSpy().controller)
    expect(b.definition()).toBeDefined()
    b.dispose()
    expect(b.definition()).toBeUndefined()
  })

  it('releases the registration through the plugin effect', () => {
    let released = 0
    const ctx = {
      effect: (install: () => () => void) => { released += 1; install() },
      uiConversation: { events: { register: () => () => {} } },
    } as unknown as ClientContext
    registerSpeechText(ctx, controllerSpy().controller)
    expect(released).toBe(1)
    expect(vi.isMockFunction(ctx.effect)).toBe(false)
  })
})
