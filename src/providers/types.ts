/**
 * The speech-provider seam. One provider is one self-contained folder under
 * `providers/` that owns its protocol, its credentials, and its tuning; the
 * selector only decides which provider speaks, and the HTTP route only carries
 * the bytes. Nothing here knows about a specific vendor.
 */

import type { Readable } from 'node:stream'

/** Provider identifier, matching the provider folder name. */
export type SpeechProviderId = string

/** One synthesis request, already resolved from the durable settings. */
export interface SpeechRequest {
  /** Text to speak. */
  readonly text: string
  /** Provider voice id or short name. */
  readonly voice: string
  /** Provider-specific tuning; every provider reads only the keys it declares. */
  readonly tuning: Readonly<Record<string, unknown>>
}

/** Audio a provider returns for one request. */
export interface SpeechAudio {
  /** Audio bytes, streamed straight to the browser response. */
  readonly stream: Readable
  /** Response content type (`audio/mpeg`, `audio/wav`, ...). */
  readonly contentType: string
}

/**
 * A provider's credential slot: the settings field name and the value the host
 * resolved for it. A provider without credentials receives an empty map.
 */
export type ProviderCredentials = Readonly<Record<string, string | undefined>>

/** One voice a provider can speak with. */
export interface SpeechVoice {
  /** Value stored in settings and sent back to synthesize. */
  readonly id: string
  /** Display name. */
  readonly name: string
  /** BCP-47 language tag, used to group the list in settings. */
  readonly language: string
  /** Gender the provider reports, when it reports one. */
  readonly gender?: string
}

/** One callable text-to-speech provider. */
export interface SpeechProvider {
  /** Provider identity, equal to its folder name. */
  readonly id: SpeechProviderId
  /**
   * Voices this provider can enumerate without an account. Absent for a
   * provider whose voices come from the user's own account, which lists them
   * through its own API instead.
   */
  readonly voices?: () => Promise<readonly SpeechVoice[]>
  /**
   * Synthesize one request.
   * @param request - text, voice, and tuning resolved by the selector.
   * @param credentials - this provider's resolved credentials, empty when it needs none.
   * @returns the audio stream and the response content type.
   */
  synthesize(request: SpeechRequest, credentials: ProviderCredentials): Promise<SpeechAudio>
}
