/**
 * Durable speech preferences shared by the Host schema and the browser form.
 *
 * The schema is the plugin's Cordis `Config`, so it is also the settings form:
 * the profile entry id (`ui-speech`) is the namespace, and every field the
 * settings screen may edit is marked `.volatile()`. A field without that mark
 * would still validate the composition, but the Host refuses to edit it.
 */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the speech plugin: its profile entry id. */
export const SPEECH_SETTINGS_NAMESPACE = 'ui-speech'

/** Field carrying the selected provider. */
export const PROVIDER_FIELD = 'provider'

/** Field carrying whether read-aloud skips code and tables. */
export const SKIP_CODE_FIELD = 'skipCode'

/** Field carrying the Microsoft Edge block. */
export const EDGE_FIELD = 'edge'

/**
 * Providers this build can speak through. The union grows with each provider
 * folder; a value outside it is refused by the schema rather than silently
 * falling back to another voice.
 */
export const SPEECH_PROVIDERS = ['edge'] as const

/** One selectable speech provider. */
export type SpeechProviderId = typeof SPEECH_PROVIDERS[number]

/** Provider used when the user-settings document has no override. */
export const DEFAULT_PROVIDER: SpeechProviderId = 'edge'

/** Whether read-aloud skips code when the user-settings document has no override. */
export const DEFAULT_SKIP_CODE = true

/** Microsoft Edge read-aloud preferences. */
export interface EdgeSettings {
  /** Edge voice short name, for example `pt-BR-AntonioNeural`. */
  voice: string
  /** Speaking rate as a percentage delta (-50..50). */
  rate: number
  /** Volume as a percentage delta (-50..50). */
  volume: number
  /** Pitch as a Hz delta (-50..50). */
  pitch: number
}

/** Edge defaults: the service always serves voices, so this block is never empty. */
export const DEFAULT_EDGE_SETTINGS: EdgeSettings = Object.freeze({
  voice: 'pt-BR-AntonioNeural',
  rate: 0,
  volume: 0,
  pitch: 0,
})

/** Durable speech section shared by the Host schema and the browser scope. */
export interface SpeechSettings {
  /** Selected provider. */
  provider: SpeechProviderId
  /** Whether read-aloud drops fenced code, inline code, and tables. */
  skipCode: boolean
  /** Edge preferences. */
  edge: EdgeSettings
}

/**
 * Durable speech schema and the plugin's Cordis `Config`. Every leaf is volatile,
 * so the settings screen edits values in place instead of remounting the plugin.
 */
export const SpeechSettingsSchema = z.object({
  [PROVIDER_FIELD]: z.union([...SPEECH_PROVIDERS]).default(DEFAULT_PROVIDER).volatile(),
  [SKIP_CODE_FIELD]: z.boolean().default(DEFAULT_SKIP_CODE).volatile(),
  [EDGE_FIELD]: z.object({
    voice: z.string().default(DEFAULT_EDGE_SETTINGS.voice).volatile(),
    rate: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.rate).volatile(),
    volume: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.volume).volatile(),
    pitch: z.number().step(1).min(-50).max(50).default(DEFAULT_EDGE_SETTINGS.pitch).volatile(),
  }).default(DEFAULT_EDGE_SETTINGS),
})

/** The resolved Host config: every editable leaf is a live reference. */
export interface SpeechConfig {
  /** Selected provider. */
  provider: LiveRef<SpeechProviderId>
  /** Whether read-aloud drops fenced code, inline code, and tables. */
  skipCode: LiveRef<boolean>
  /** Edge preferences. */
  edge: {
    /** Edge voice short name. */
    voice: LiveRef<string>
    /** Speaking rate delta. */
    rate: LiveRef<number>
    /** Volume delta. */
    volume: LiveRef<number>
    /** Pitch delta. */
    pitch: LiveRef<number>
  }
}

/** What `.volatile()` parses a field into: one stable reference over the live value. */
export interface LiveRef<T> {
  /**
   * Read the value the Host currently holds.
   * @returns the live value.
   */
  get(): T
}

/**
 * Read one field of the resolved config. A volatile leaf is a live reference; a
 * plain one is the value itself, which is what a field the profile layer left at
 * its schema default may still be.
 * @param field - one resolved config field.
 * @returns the value the Host currently holds.
 */
export function liveValue<T>(field: LiveRef<T> | T): T {
  if (typeof field === 'object' && field !== null && !Array.isArray(field)) {
    const getter = (field as Partial<LiveRef<T>>).get
    if (typeof getter === 'function') return getter.call(field)
  }
  return field as T
}

/**
 * Read the whole config as the plain section the selector consumes, with every
 * default filled in for a field the Host left unset.
 * @param config - resolved Host config, absent when the entry declares none.
 * @returns the durable speech settings.
 */
export function speechSection(config: Partial<SpeechConfig> | undefined): SpeechSettings {
  const edge = config?.edge
  return {
    provider: liveValue(config?.provider) ?? DEFAULT_PROVIDER,
    skipCode: liveValue(config?.skipCode) ?? DEFAULT_SKIP_CODE,
    edge: {
      voice: liveValue(edge?.voice) ?? DEFAULT_EDGE_SETTINGS.voice,
      rate: liveValue(edge?.rate) ?? DEFAULT_EDGE_SETTINGS.rate,
      volume: liveValue(edge?.volume) ?? DEFAULT_EDGE_SETTINGS.volume,
      pitch: liveValue(edge?.pitch) ?? DEFAULT_EDGE_SETTINGS.pitch,
    },
  }
}

/** The complete section with every default filled in. */
export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = Object.freeze({
  provider: DEFAULT_PROVIDER,
  skipCode: DEFAULT_SKIP_CODE,
  edge: DEFAULT_EDGE_SETTINGS,
})

/**
 * Narrow one wire or registry value to a selectable provider.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value names a provider this build can call.
 */
export function isSpeechProvider(value: unknown): value is SpeechProviderId {
  return SPEECH_PROVIDERS.some(provider => provider === value)
}

/**
 * Read the voice and tuning the active provider's block holds.
 * @param section - durable speech settings.
 * @returns the editable values of the selected provider.
 */
export function activeVoiceSettings(section: SpeechSettings): EdgeSettings {
  // One provider today, so the block is read directly; the next provider turns
  // this into a switch over the id.
  return section.edge
}

/**
 * Name the settings field holding the active provider's block.
 * @returns the namespace field the selected provider's values live under.
 */
export function activeBlockField(): string {
  // One block today; the next provider returns its own field here.
  return EDGE_FIELD
}
