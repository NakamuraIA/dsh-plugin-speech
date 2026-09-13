/**
 * The speech selector: turns the durable settings section plus one request's
 * overrides into the exact call a provider receives. This is the only place
 * that knows how a settings block maps onto a provider, so a provider folder
 * never reads settings and the HTTP route never names a vendor.
 */

import { providerById } from './providers/registry.ts'
import type { SpeechProvider, SpeechRequest } from './providers/types.ts'
import type { SpeechProviderId, SpeechSettings } from './settings.ts'

/** Per-request overrides the settings screen sends while previewing a voice. */
export interface SpeechOverrides {
  /** Provider to call instead of the durable selection. */
  provider?: string
  /** Voice to speak with instead of the durable one. */
  voice?: string
  /** Tuning values that override the durable block for this call only. */
  tuning?: Readonly<Record<string, unknown>>
}

/** One resolved call: the provider to drive and the request it receives. */
export interface SelectedSpeech {
  /** Provider that will synthesize. */
  provider: SpeechProvider
  /** Request built from the durable block and any overrides. */
  request: SpeechRequest
}

/**
 * Read the voice and tuning the durable block contributes.
 * @param section - durable speech settings.
 * @returns the block's voice and the tuning keys its provider declares.
 */
function blockOf(section: SpeechSettings): { voice: string; tuning: Record<string, unknown> } {
  // One provider today, so the block is read directly; the next provider turns
  // this into a switch over the provider id.
  return {
    voice: section.edge.voice,
    tuning: { rate: section.edge.rate, volume: section.edge.volume, pitch: section.edge.pitch },
  }
}

/**
 * Resolve one synthesis call.
 * @param section - durable speech settings.
 * @param text - text to speak.
 * @param overrides - optional preview overrides from the settings screen.
 * @returns the provider and its request, or undefined when no folder claims the id.
 */
export function selectSpeech(
  section: SpeechSettings,
  text: string,
  overrides: SpeechOverrides = {},
): SelectedSpeech | undefined {
  const id = (overrides.provider ?? section.provider) as SpeechProviderId
  const provider = providerById(id)
  if (provider === undefined) return undefined
  const block = blockOf(section)
  return {
    provider,
    request: {
      text,
      voice: overrides.voice ?? block.voice,
      tuning: { ...block.tuning, ...overrides.tuning },
    },
  }
}
