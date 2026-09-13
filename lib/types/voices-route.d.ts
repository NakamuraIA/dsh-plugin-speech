/**
 * `GET /speech/voices?provider=…`: the catalog the settings row lists. A
 * provider that can enumerate its voices without an account answers here; one
 * whose voices belong to the user's account is not listed at all rather than
 * answering with an empty catalog.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
/**
 * Answer one voice-catalog request.
 * @param req - the node:http request.
 * @param res - the node:http response.
 */
export declare function serveVoiceCatalog(req: IncomingMessage, res: ServerResponse): Promise<void>;
//# sourceMappingURL=voices-route.d.ts.map