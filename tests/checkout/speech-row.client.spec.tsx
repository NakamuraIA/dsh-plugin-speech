// @vitest-environment jsdom
/** The read-aloud settings row: pickers, sliders, switch, and the test button. */
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSpeechRowStore, type SpeechRowSection } from '../src/client/settings-store.ts'
import { SpeechRow } from '../src/client/SpeechRow.tsx'
import type { SpeechRowComponentProps } from '../src/client/SpeechRow.tsx'
import type { SpeechVoice } from '../src/providers/types.ts'

const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined, reload: () => {} })) as GlobalStandardProps['useResource']
const usePanelInfo: GlobalStandardProps['usePanelInfo'] = selector => selector({ activePanelId: null })

afterEach(cleanup)

const COPY: Record<string, string> = {
  'row.title': 'Read aloud',
  'row.description': 'The voice used to read assistant replies',
  'row.provider': 'Service',
  'row.language': 'Language',
  'row.voice': 'Voice',
  'row.rate': 'Speed',
  'row.volume': 'Volume',
  'row.pitch': 'Pitch',
  'row.skipCode': 'Skip code',
  'row.skipCode.description': 'Leave code blocks and tables out of the reading',
  'row.test': 'Test voice',
  'row.testSample': 'This is how I read your replies.',
  'row.writeFailed': 'Not saved — the previous value is still in effect.',
  'row.percentUnit': '%',
  'row.pitchUnit': 'Hz',
  'provider.edge': 'Microsoft Edge',
}

const SECTION: SpeechRowSection = {
  provider: 'edge',
  voice: 'pt-BR-AntonioNeural',
  rate: 5,
  volume: -5,
  pitch: 2,
  skipCode: true,
}

const VOICES: readonly SpeechVoice[] = [
  { id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR' },
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', language: 'pt-BR' },
  { id: 'en-US-AriaNeural', name: 'Aria', language: 'en-US' },
]

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

function mount(section: SpeechRowSection = SECTION, voices: readonly SpeechVoice[] = VOICES) {
  const instance = createSpeechRowStore().create()
  instance.actions.sync(section, 0)
  instance.actions.setVoices(voices)
  const faces = {
    setProvider: vi.fn(),
    setVoice: vi.fn(),
    setTuning: vi.fn(),
    setSkipCode: vi.fn(),
    test: vi.fn(),
  }
  const props: SpeechRowComponentProps = {
    useSessions: emptySessions(),
    useSessionPendingInteraction: (selector => selector(new Map())),
    usePanelInfo, useResource,
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(instance),
    actions: instance.actions,
    t: (key: string) => COPY[key] ?? key,
    ...faces,
  }
  render(<SpeechRow {...props} />)
  return { instance, ...faces }
}

const anchor = (name: string): HTMLButtonElement => screen.getByRole('button', { name }) as HTMLButtonElement
const slider = (name: string): HTMLInputElement => screen.getByLabelText(name) as HTMLInputElement

describe('SpeechRow', () => {
  it('shows the row, the current selections, the tuning, and the sample', () => {
    mount()
    expect(screen.getByText('Read aloud')).toBeDefined()
    expect(screen.getByText('The voice used to read assistant replies')).toBeDefined()
    expect(anchor('Microsoft Edge')).toBeDefined()
    expect(anchor('pt-BR')).toBeDefined()
    expect(anchor('Antonio')).toBeDefined()
    expect(screen.getByText('Speed')).toBeDefined()
    expect(screen.getByText('+5%')).toBeDefined()
    expect(screen.getByText('-5%')).toBeDefined()
    expect(screen.getByText('+2Hz')).toBeDefined()
    expect(screen.getByRole('switch', { name: 'Skip code' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('This is how I read your replies.')).toBeDefined()
  })

  it('selects the service from the provider list', () => {
    const b = mount()
    fireEvent.click(anchor('Microsoft Edge'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Microsoft Edge' }))
    expect(b.setProvider).toHaveBeenCalledWith('edge')
    expect(screen.queryByRole('menuitem', { name: 'Microsoft Edge' })).toBeNull()
  })

  it('selects a language by moving to its first voice', () => {
    const b = mount()
    fireEvent.click(anchor('pt-BR'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'en-US' }))
    expect(b.setVoice).toHaveBeenCalledWith('en-US-AriaNeural')
  })

  it('selects a voice from the language it belongs to', () => {
    const b = mount()
    fireEvent.click(anchor('Antonio'))
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Antonio', 'Francisca'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Francisca' }))
    expect(b.setVoice).toHaveBeenCalledWith('pt-BR-FranciscaNeural')
  })

  it('closes a picker without choosing anything', () => {
    const b = mount()
    fireEvent.click(anchor('pt-BR'))
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    expect(b.setVoice).not.toHaveBeenCalled()
  })

  it('offers no voice while the catalog is empty', () => {
    mount(SECTION, [])
    expect(anchor('pt-BR-AntonioNeural')).toBeDefined()
    fireEvent.click(anchor('pt-BR-AntonioNeural'))
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
  })

  it('reports every slider the reader drags', () => {
    const b = mount()
    fireEvent.change(slider('Speed'), { target: { value: '30' } })
    fireEvent.change(slider('Volume'), { target: { value: '-30' } })
    fireEvent.change(slider('Pitch'), { target: { value: '40' } })
    expect(b.setTuning.mock.calls).toEqual([['rate', 30], ['volume', -30], ['pitch', 40]])
  })

  it('toggles the code preference', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('switch', { name: 'Skip code' }))
    expect(b.setSkipCode).toHaveBeenCalledWith(false)
  })

  it('tests the settings currently on screen', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Test voice' }))
    expect(b.test).toHaveBeenCalledWith('This is how I read your replies.', {
      provider: 'edge',
      voice: 'pt-BR-AntonioNeural',
      tuning: { rate: 5, volume: -5, pitch: 2 },
    })
  })

  it('shows the refused-write notice from the store mirror', () => {
    const b = mount()
    expect(screen.queryByRole('status')).toBeNull()
    act(() => { b.instance.actions.markWriteFailed(true) })
    expect(screen.getByRole('status').textContent).toBe('Not saved — the previous value is still in effect.')
    act(() => { b.instance.actions.markWriteFailed(false) })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
