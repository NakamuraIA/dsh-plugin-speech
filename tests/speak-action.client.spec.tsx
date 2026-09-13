// @vitest-environment jsdom
/** The read-aloud action: states, labels, the failure notice, and the click. */
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSpeechState } from '../src/client/speech-state.ts'
import { SpeakAction } from '../src/client/SpeakAction.tsx'
import type { SpeechActionProps } from '../src/client/SpeakAction.tsx'

const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined, reload: () => {} })) as GlobalStandardProps['useResource']
const usePanelInfo: GlobalStandardProps['usePanelInfo'] = selector => selector({ activePanelId: null })

afterEach(cleanup)

const COPY: Record<string, string> = {
  'speak.read': 'Read this reply aloud',
  'speak.stop': 'Stop reading aloud',
  'speak.failed.unavailable': 'This reply has no spoken text',
  'speak.failed.provider': 'The speech service call failed',
}

function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceSnapshot>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  })
  return bindSnapshotSelector(store)
}

type AttentionSnapshot = Parameters<Parameters<SpeechActionProps['useSessionPendingInteraction']>[0]>[0]
const noAttention: AttentionSnapshot = new Map()
const useSessionPendingInteraction: SpeechActionProps['useSessionPendingInteraction'] = selector => selector(noAttention)

const MESSAGE = 'msg-1'

function mount(source: string | undefined) {
  const state = createSpeechState()
  if (source !== undefined) {
    state.set({ ...state.getSnapshot(), sources: new Map([[MESSAGE, source]]) })
  }
  const toggle = vi.fn()
  const props = {
    useSessions: emptySessions(),
    useSessionPendingInteraction,
    usePanelInfo, useResource,
    useWorkspaces: emptyWorkspaces(),
    messageId: MESSAGE as never,
    useSpeech: bindSnapshotSelector(state),
    toggle,
    t: (key: string) => COPY[key] ?? key,
  } as unknown as SpeechActionProps
  render(<SpeakAction {...props} />)
  return { state, toggle }
}

const button = (name: string): HTMLButtonElement => screen.getByRole('button', { name }) as HTMLButtonElement

describe('SpeakAction', () => {
  it('offers to read a message whose prose is folded', () => {
    const b = mount('Olá mundo')
    expect(button('Read this reply aloud').disabled).toBe(false)
    fireEvent.click(button('Read this reply aloud'))
    expect(b.toggle).toHaveBeenCalledWith(MESSAGE)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays disabled until the message reaches the fold', () => {
    mount(undefined)
    expect(button('Read this reply aloud').disabled).toBe(true)
  })

  it('turns into a stop control while the message is speaking', () => {
    const b = mount('Olá')
    act(() => { b.state.set({ ...b.state.getSnapshot(), active: MESSAGE }) })
    expect(button('Stop reading aloud')).toBeDefined()
    fireEvent.click(button('Stop reading aloud'))
    expect(b.toggle).toHaveBeenCalledWith(MESSAGE)
  })

  it('shows the provider failure with its detail as the tooltip', () => {
    const b = mount('Olá')
    act(() => {
      b.state.set({
        ...b.state.getSnapshot(),
        active: MESSAGE,
        failure: 'provider',
        detail: 'serviço fora do ar',
      })
    })
    const notice = screen.getByRole('status')
    expect(notice.textContent).toBe('The speech service call failed')
    expect(notice.getAttribute('title')).toBe('serviço fora do ar')
    // A failed message retries instead of offering to stop.
    expect(button('Read this reply aloud')).toBeDefined()
  })

  it('shows the unavailable notice without a tooltip', () => {
    const b = mount('')
    act(() => {
      b.state.set({ ...b.state.getSnapshot(), active: MESSAGE, failure: 'unavailable', detail: null })
    })
    const notice = screen.getByRole('status')
    expect(notice.textContent).toBe('This reply has no spoken text')
    expect(notice.hasAttribute('title')).toBe(false)
  })
})
