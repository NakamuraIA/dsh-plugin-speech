/**
 * Microsoft Edge read-aloud provider. The free endpoint needs no account and no
 * key, so it is the provider a deployment can use out of the box; the protocol
 * itself (websocket handshake, request signing, audio framing) belongs to
 * `msedge-tts`, which is MIT-licensed and maintained.
 */
import type { SpeechProvider } from '../types.ts';
/** Provider folder name and settings key. */
export declare const ID = "edge";
/** Voice used when the settings name none; Edge ships voices for every language it serves. */
export declare const DEFAULT_VOICE = "pt-BR-AntonioNeural";
/** The Edge read-aloud provider. */
export declare const edgeProvider: SpeechProvider;
//# sourceMappingURL=server.d.ts.map