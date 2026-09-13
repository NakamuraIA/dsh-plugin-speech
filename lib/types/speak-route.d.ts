/**
 * `POST /speech/speak`: the browser posts text, the host selects the provider
 * from the durable settings and calls it with the deployment's credentials, and
 * the audio streams straight back. Synthesis belongs to the host because the
 * browser cannot hold an API key and cannot reach most providers across CORS.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
/**
 * Answer one synthesis request.
 * @param req - the node:http request.
 * @param res - the node:http response.
 * @param ctx - host context carrying the settings service.
 */
export declare function serveSpeechRequest(req: IncomingMessage, res: ServerResponse, ctx: Context): Promise<void>;
//# sourceMappingURL=speak-route.d.ts.map