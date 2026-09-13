/**
 * Microsoft Edge read-aloud provider. The free endpoint needs no account and no
 * key, so it is the provider a deployment can use out of the box; the protocol
 * itself (websocket handshake, request signing, audio framing) belongs to
 * `msedge-tts`, which is MIT-licensed and maintained.
 */

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import type { ProviderCredentials, SpeechAudio, SpeechProvider, SpeechRequest, SpeechVoice } from '../types.ts'

/** Provider folder name and settings key. */
export const ID = 'edge'

/** Voice used when the settings name none; Edge ships voices for every language it serves. */
export const DEFAULT_VOICE = 'pt-BR-AntonioNeural'

/** Audio format requested from the service: 24 kHz mono MP3, the smallest stream it offers. */
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3

/** Response content type matching {@link FORMAT}. */
const CONTENT_TYPE = 'audio/mpeg'

/**
 * Read one numeric tuning value, clamped to a range the service accepts.
 * @param value - raw tuning value from settings.
 * @param fallback - value used when the setting is absent or not a number.
 * @param min - lowest accepted value.
 * @param max - highest accepted value.
 * @returns the clamped number.
 */
function number(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, parsed))
}

/**
 * Format one percentage delta the way Edge's SSML expects it.
 * @param value - percentage from settings.
 * @returns a signed percentage literal.
 */
function percent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`
}

/** The Edge read-aloud provider. */
export const edgeProvider: SpeechProvider = {
  id: ID,

  /**
   * The service publishes its full voice list, so the settings row can offer
   * every language without the user typing a voice name.
   * @returns one entry per available voice.
   */
  async voices(): Promise<readonly SpeechVoice[]> {
    const voices = await new MsEdgeTTS().getVoices()
    return voices.map(voice => ({
      id: voice.ShortName,
      name: voice.FriendlyName,
      language: voice.Locale,
      gender: voice.Gender,
    }))
  },

  async synthesize(request: SpeechRequest, _credentials: ProviderCredentials): Promise<SpeechAudio> {
    const voice = request.voice === '' ? DEFAULT_VOICE : request.voice
    const rate = number(request.tuning['rate'], 0, -100, 100)
    const volume = number(request.tuning['volume'], 0, -100, 100)
    const pitch = number(request.tuning['pitch'], 0, -100, 100)
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voice, FORMAT)
    // Prosody rides the request, so one client instance serves every tuning.
    const { audioStream } = tts.toStream(request.text, {
      rate: percent(rate),
      volume: percent(volume),
      pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz`,
    })
    return { stream: audioStream, contentType: CONTENT_TYPE }
  },
}
