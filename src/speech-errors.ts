/**
 * Failure vocabulary shared by the synthesis route and the browser.
 *
 * Most provider failures are transient and the generic "the speech service call
 * failed" is honest about them. A refused handshake is not: the Edge endpoint is
 * undocumented, and Microsoft rotates what it accepts without notice. When that
 * happens nothing the reader does will help — the plugin itself has to change —
 * and a message that says so is worth more than one that says nothing.
 */

/** Why a synthesis failed, in the reader's terms. */
export type SpeechErrorCode =
  /** The service refused the handshake; the plugin is what needs updating. */
  | 'endpoint'

/** Error carrying a {@link SpeechErrorCode} across the route boundary. */
export class SpeechError extends Error {
  /**
   * @param message - what the provider or the transport reported.
   * @param code - the class of failure, when one is known.
   */
  constructor(message: string, readonly code: SpeechErrorCode | undefined) {
    super(message)
    this.name = 'SpeechError'
  }
}

/**
 * Classify a caught provider failure.
 *
 * The refusal arrives as a WebSocket handshake error carrying the HTTP status:
 * `msedge-tts` retries once by re-anchoring its clock to the server's `Date`,
 * and rethrows what is left. Both shapes are inspected here — the status on the
 * error (or its cause) and the message the `ws` library builds — because which
 * one survives depends on where in the handshake it failed.
 *
 * @param error - the caught value.
 * @returns the code, or undefined when the failure is an ordinary one.
 */
export function errorCodeOf(error: unknown): SpeechErrorCode | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const candidate = error as { statusCode?: unknown; cause?: { statusCode?: unknown }; message?: unknown }
  const status = candidate.statusCode ?? candidate.cause?.statusCode
  if (status === 403) return 'endpoint'
  if (typeof candidate.message === 'string' && candidate.message.includes('Unexpected server response: 403')) {
    return 'endpoint'
  }
  return undefined
}

/**
 * Wrap one failure so its class survives the trip to the browser.
 * @param error - the caught value.
 * @returns an error carrying the code, or the original when it has none.
 */
export function tagError(error: unknown): unknown {
  const code = errorCodeOf(error)
  if (code === undefined) return error
  const message = error instanceof Error ? error.message : String(error)
  return new SpeechError(message, code)
}
