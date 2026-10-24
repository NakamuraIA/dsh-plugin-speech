/**
 * `POST /speech/speak`: the browser posts text, the host selects the provider
 * from its entry config and calls it with the deployment's credentials, and the
 * audio streams straight back. Synthesis belongs to the host because the browser
 * cannot hold an API key and cannot reach most providers across CORS.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SpeechSettings } from './settings.ts';
/**
 * Answer one synthesis request.
 * @param req - the node:http request.
 * @param res - the node:http response.
 * @param section - reads the live preferences of this plugin's entry.
 */
export declare function serveSpeechRequest(req: IncomingMessage, res: ServerResponse, section: () => SpeechSettings): Promise<void>;
//# sourceMappingURL=speak-route.d.ts.map