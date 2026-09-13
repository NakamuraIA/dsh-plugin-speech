/**
 * `GET /speech/voices?provider=…`: the catalog the settings row lists. A
 * provider that can enumerate its voices without an account answers here; one
 * whose voices belong to the user's account is not listed at all rather than
 * answering with an empty catalog.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { providerById } from './providers/registry.ts'
import { DEFAULT_PROVIDER } from './settings.ts'

/**
 * Answer one voice-catalog request.
 * @param req - the node:http request.
 * @param res - the node:http response.
 */
export async function serveVoiceCatalog(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.writeHead(405)
    res.end()
    return
  }
  /* v8 ignore next -- node:http always sets url on server requests */
  const url = new URL(req.url ?? '/', 'http://x')
  const id = url.searchParams.get('provider') ?? DEFAULT_PROVIDER
  const voices = providerById(id)?.voices
  if (voices === undefined) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: `provider "${id}" lists no voice catalog` }))
    return
  }
  try {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
    })
    res.end(JSON.stringify({ voices: await voices() }))
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
  }
}
