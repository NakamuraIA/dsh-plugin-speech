/** The speech plugin's URL surface, owned in one place so routes cannot drift. */
/** Prefix serving the local engine, the ONNX runtime, and the voice model. */
export const SPEECH_ROUTE = '/speech';
/** Exact route the browser posts synthesis requests to. */
export const SPEECH_SPEAK_ROUTE = `${SPEECH_ROUTE}/speak`;
/** Exact route listing the selected provider's voices. */
export const SPEECH_VOICES_ROUTE = `${SPEECH_ROUTE}/voices`;
//# sourceMappingURL=routes.js.map