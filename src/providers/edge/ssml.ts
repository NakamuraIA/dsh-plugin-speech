/**
 * The SSML one synthesis request carries.
 *
 * It is built here, in one line, instead of through the client library's
 * template: that template indents every element and pads the text with
 * whitespace, and since late October 2026 the service drops the socket without
 * a word — no error frame, no audio, just a close — on some of those payloads.
 * The same request written compactly is answered normally, so the shape of the
 * markup is worth owning.
 */

/** Locale a voice name starts with, as the SSML root needs it. */
const VOICE_LOCALE = /^[a-z]{2,}-[A-Z]{2}/

/** Characters XML cannot carry literally inside a text node. */
const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}

/** Prosody that rides the request, in the units the service documents. */
export interface Prosody {
  /** Speaking rate as a percentage delta. */
  readonly rate: number
  /** Volume as a percentage delta. */
  readonly volume: number
  /** Pitch as a hertz delta. */
  readonly pitch: number
}

/**
 * Escape one text node.
 * @param text - the words to speak.
 * @returns the text safe to place between tags.
 */
export function escapeSpeech(text: string): string {
  return text.replace(/[&<>]/g, character => XML_ESCAPES[character] as string)
}

/**
 * Read the locale a voice name announces.
 * @param voice - voice short name, for example `pt-BR-AntonioNeural`.
 * @returns the locale tag, or `en-US` when the name carries none.
 */
export function localeOf(voice: string): string {
  return VOICE_LOCALE.exec(voice)?.[0] ?? 'en-US'
}

/**
 * Render the SSML for one request. One line on purpose: see the module comment.
 * @param text - the words to speak, unescaped.
 * @param voice - voice short name.
 * @param prosody - rate, volume, and pitch deltas.
 * @returns the complete SSML document.
 */
export function speechSsml(text: string, voice: string, prosody: Prosody): string {
  const signed = (value: number, unit: string): string => `${value >= 0 ? '+' : ''}${value}${unit}`
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${localeOf(voice)}'>`
    + `<voice name='${voice}'>`
    + `<prosody rate='${signed(prosody.rate, '%')}' volume='${signed(prosody.volume, '%')}' pitch='${signed(prosody.pitch, 'Hz')}'>`
    + escapeSpeech(text)
    + '</prosody></voice></speak>'
}
