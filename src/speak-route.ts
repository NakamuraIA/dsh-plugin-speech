/**
 * `POST /speech/speak`: the browser posts text, the host selects the provider
 * from the durable settings and calls it with the deployment's credentials, and
 * the audio streams straight back. Synthesis belongs to the host because the
 * browser cannot hold an API key and cannot reach most providers across CORS.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { pipeline } from 'node:stream/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { selectSpeech, type SpeechOverrides } from './selector.ts'
import { MAX_TEXT_CHARS } from './speech-limits.ts'
import { DEFAULT_SPEECH_SETTINGS, SPEECH_SETTINGS_NAMESPACE, type SpeechSettings } from './settings.ts'

/** Largest request body accepted; one reply is far below this. */
const MAX_BODY_BYTES = 256 * 1024

/** Body shape the browser posts. */
interface SpeakBody {
  text?: unknown
  provider?: unknown
  voice?: unknown
  tuning?: unknown
}

/**
 * Read a bounded JSON request body.
 * @param req - the node:http request.
 * @returns the parsed body, or undefined when it is absent, oversized, or not JSON.
 */
async function readBody(req: IncomingMessage): Promise<SpeakBody | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  if (size === 0) return undefined
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed : undefined
  } catch (_invalidJson) {
    return undefined
  }
}

/**
 * Narrow one wire value to a tuning record.
 * @param value - the request body's tuning member.
 * @returns the record, or undefined when the body carried none.
 */
function tuningOf(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  return value as Readonly<Record<string, unknown>>
}

/**
 * Answer one synthesis request.
 * @param req - the node:http request.
 * @param res - the node:http response.
 * @param ctx - host context carrying the settings service.
 */
export async function serveSpeechRequest(req: IncomingMessage, res: ServerResponse, ctx: Context): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end()
    return
  }
  const body = await readBody(req)
  const text = typeof body?.text === 'string' ? body.text : ''
  if (text === '' || text.length > MAX_TEXT_CHARS) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: `text must be 1..${MAX_TEXT_CHARS} characters` }))
    return
  }
  const section = ctx.get('settings')?.get(SPEECH_SETTINGS_NAMESPACE) as SpeechSettings | undefined
  const tuning = tuningOf(body?.tuning)
  const overrides: SpeechOverrides = {
    ...(typeof body?.provider === 'string' ? { provider: body.provider } : {}),
    ...(typeof body?.voice === 'string' ? { voice: body.voice } : {}),
    ...(tuning === undefined ? {} : { tuning }),
  }
  const selected = selectSpeech(section ?? DEFAULT_SPEECH_SETTINGS, text, overrides)
  if (selected === undefined) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: `unknown speech provider "${String(overrides.provider ?? section?.provider)}"` }))
    return
  }
  try {
    const audio = await selected.provider.synthesize(selected.request, {})
    res.writeHead(200, {
      'content-type': audio.contentType,
      // Audio is already compressed and is consumed once: never deflate it, and
      // never let a proxy hold it for another request.
      'cache-control': 'no-store, no-transform',
    })
    await pipeline(audio.stream, res)
  } catch (error) {
    // The response is committed once streaming starts; a failure before that
    // point is reported as a provider fault the browser can show.
    if (res.headersSent) {
      res.destroy()
      return
    }
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
  }
}
