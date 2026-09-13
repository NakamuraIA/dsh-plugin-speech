/**
 * Browser playback over the host's synthesis route.
 *
 * The whole reply goes out in one request and the audio is played as it
 * arrives: the response body is read chunk by chunk and appended to a
 * MediaSource buffer the audio element already plays from, so speech starts on
 * the first frames and never waits for the rest — the audio equivalent of
 * watching an answer stream in.
 *
 * A browser whose MediaSource cannot take MP3 falls back to one request per
 * sentence and blob playback, which still works but waits for each sentence.
 */
/** Per-request overrides the settings screen uses to preview an unsaved voice. */
export interface SpeechOverrides {
    /** Provider to call instead of the durable selection. */
    provider?: string;
    /** Voice to speak with instead of the durable one. */
    voice?: string;
    /** Tuning values that override the durable block for this call only. */
    tuning?: Readonly<Record<string, unknown>>;
}
/** Owns the audio currently playing and the requests behind it. */
export declare class SpeechAudio {
    /** Cancellation token: every stop or new request invalidates what is running. */
    private generation;
    private playing;
    private objectUrl;
    /**
     * Speak one text. The whole reply travels in one request whenever it fits, and
     * playback starts on the first audio frames that arrive.
     * @param text - projected spoken text.
     * @param overrides - preview overrides, or undefined to use the durable settings.
     * @param onEnded - called once the last audio has played out.
     */
    speak(text: string, overrides: SpeechOverrides | undefined, onEnded: () => void): Promise<void>;
    /**
     * Report an end for a run that played out, and stay silent for one that a
     * later stop or speak superseded.
     * @param played - whether the run reached its last audio frame.
     * @param onEnded - the caller's end callback.
     */
    private report;
    /** Stop playback and abandon whatever is still arriving. */
    stop(): void;
    /** Stop playback and release the last object URL. */
    dispose(): void;
    /**
     * Stream one request's audio into a MediaSource-backed element.
     * @param text - the whole projected text.
     * @param overrides - preview overrides, when any.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    private streamRequest;
    /**
     * Fallback path for a reply the browser cannot stream: one request per
     * sentence, each played as a blob.
     * @param sentences - sentence-sized spans.
     * @param overrides - preview overrides, when any.
     * @param generation - token this run belongs to.
     * @returns whether every span played out under the same generation.
     */
    private playSentenceBySentence;
    /**
     * Fetch the audio of one span.
     * @param text - span to speak.
     * @param overrides - preview overrides, when any.
     * @returns the encoded audio the host answered with.
     */
    private fetchAudio;
    /**
     * Play one buffered span and wait for it to finish.
     * @param audio - encoded audio bytes.
     * @param generation - token this span belongs to.
     * @returns whether the span played out under the same generation.
     */
    private playBlob;
    private dropPlayback;
    private releaseChunk;
}
//# sourceMappingURL=speech-audio.d.ts.map