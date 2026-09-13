/**
 * Speech settings row store: a mirror of the durable section plus the voice
 * catalog and the settlement of the last write this row asked for. The plugin's
 * apply-world listener is the only writer; the row reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SpeechVoice } from '../providers/types.ts'
import {
  DEFAULT_EDGE_SETTINGS, DEFAULT_PROVIDER, DEFAULT_SKIP_CODE, type SpeechProviderId,
} from '../settings.ts'

/** The durable preferences this row mirrors, flattened for display. */
export interface SpeechRowSection {
  /** Selected provider. */
  provider: SpeechProviderId
  /** Selected voice id for that provider. */
  voice: string
  /** Speaking rate delta. */
  rate: number
  /** Volume delta. */
  volume: number
  /** Pitch delta. */
  pitch: number
  /** Whether read-aloud drops code and tables. */
  skipCode: boolean
}

/** Store state mirrored from the speech settings snapshot and the voice catalog. */
export interface SpeechRowState extends SpeechRowSection {
  /** Voices the selected provider published; empty until it answers or when it has none. */
  voices: readonly SpeechVoice[]
  /** Language currently filtered in the voice picker. */
  language: string
  /** Service revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
  /** Whether the last write this row asked for was refused or lost. */
  writeFailed: boolean
}

/** Declared action shape giving the exported factory a stable return type. */
type SpeechRowActions = {
  sync: (draft: SpeechRowState, section: SpeechRowSection, revision: number) => void
  setVoices: (draft: SpeechRowState, voices: readonly SpeechVoice[]) => void
  setLanguage: (draft: SpeechRowState, language: string) => void
  markWriteFailed: (draft: SpeechRowState, failed: boolean) => void
}

/**
 * Declares the speech row state and write surface.
 * @returns the store handle.
 */
export function createSpeechRowStore(): EngineStoreHandle<SpeechRowState, SpeechRowActions> {
  return defineStore({
    init: (): SpeechRowState => ({
      provider: DEFAULT_PROVIDER,
      voice: DEFAULT_EDGE_SETTINGS.voice,
      rate: DEFAULT_EDGE_SETTINGS.rate,
      volume: DEFAULT_EDGE_SETTINGS.volume,
      pitch: DEFAULT_EDGE_SETTINGS.pitch,
      skipCode: DEFAULT_SKIP_CODE,
      voices: [],
      language: '',
      revision: -1,
      writeFailed: false,
    }),
    actions: {
      sync: (d, section: SpeechRowSection, revision: number) => {
        if (revision <= d.revision) return
        d.provider = section.provider
        d.voice = section.voice
        d.rate = section.rate
        d.volume = section.volume
        d.pitch = section.pitch
        d.skipCode = section.skipCode
        d.revision = revision
      },
      setVoices: (d, voices: readonly SpeechVoice[]) => {
        d.voices = voices
        // Keep the language filter on something the catalog still offers: the
        // selected voice's language first, then the first language listed.
        const selected = voices.find(voice => voice.id === d.voice)
        if (selected !== undefined) {
          d.language = selected.language
          return
        }
        if (!voices.some(voice => voice.language === d.language)) {
          d.language = voices[0]?.language ?? ''
        }
      },
      setLanguage: (d, language: string) => { d.language = language },
      // Deliberately outside the revision guard: a refused write publishes no
      // snapshot, so its settlement is the only fact that can carry it.
      markWriteFailed: (d, failed: boolean) => { d.writeFailed = failed },
    },
  })
}
