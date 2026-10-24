/**
 * Browser playback over the host's synthesis route.
 *
 * The whole reply travels in one request and is played as one audio file: the
 * body is read to the end, handed to a single element as a blob, and played
 * from start to finish. One file has no seams, so a reading is continuous by
 * construction — the MediaSource path this replaced could not promise that on
 * every engine, and a browser that silently refused to start it left the reply
 * silent.
 *
 * Waiting for the whole body costs less than it sounds: the service synthesizes
 * faster than a voice speaks, so a twenty-second reading arrives in about a
 * second. Only a reply larger than one request may carry is spoken sentence by
 * sentence, because no single request could hold it.
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
     * Speak one text. The whole reply travels in one request and plays as one
     * file; a reply too large for that is spoken sentence by sentence.
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
     * Fetch one reply and play it as a single file.
     * @param text - the whole projected text.
     * @param overrides - preview overrides, when any.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    private playWhole;
    /**
     * Fallback path for a reply one request cannot carry: one request per
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
     * Play one buffered file and wait for it to finish.
     * @param audio - encoded audio bytes.
     * @param generation - token this run belongs to.
     * @returns whether the file played out under the same generation.
     */
    private playBlob;
    /**
     * Resolve when one element stops producing sound, whether it ended, failed, or
     * was stopped by a newer request.
     * @param element - the audio element.
     * @param generation - token the run belongs to.
     */
    private playedOut;
    /**
     * Start one element, reading a pause as the cancellation it is.
     * @param element - element to start.
     * @param generation - token the run belongs to.
     * @returns whether playback started; false means a stop got there first.
     */
    private startPlayback;
    private dropPlayback;
    private releaseChunk;
}
//# sourceMappingURL=speech-audio.d.ts.map