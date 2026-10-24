/**
 * Browser playback over the host's synthesis route.
 *
 * The whole reply goes out in one request and the host streams the audio back
 * while the service is still synthesizing it. The browser appends each chunk to
 * a MediaSource buffer and starts playing once a few seconds of audio are
 * buffered — early enough to feel immediate, late enough that playback cannot
 * catch the network and stall in the middle of a sentence. That pre-buffer is
 * the whole trick: streaming alone started too early and paused whenever the
 * service fell behind; waiting for the whole file was seamless but slow.
 *
 * When a link in that chain is missing — no MediaSource, a container the engine
 * refuses, a buffer that dies mid-reply — the reply is still played, as one
 * whole file assembled from the bytes in hand. That path cannot start before the
 * reply is complete, but it always produces sound.
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
    /** Aborts the response body a stop would otherwise keep reading forever. */
    private abort;
    /**
     * Speak one text. The whole reply travels in one request; playback starts on
     * the buffered head of it. A reply too large for one request is spoken
     * sentence by sentence.
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
     * Fetch one reply and play it, streaming it when the browser can.
     * @param text - the whole projected text.
     * @param overrides - preview overrides, when any.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    private playReply;
    /**
     * Append one reply's frames and start playing once enough of it is buffered.
     * @param body - the response body carrying encoded audio.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    private streamReply;
    /**
     * Drain what is left of a reply and play everything received as one file.
     * @param reader - the response reader, possibly partly consumed.
     * @param held - chunks already in hand.
     * @param generation - token this request belongs to.
     * @param cause - the failure that sent the reply down this path, when there was one.
     * @returns whether playback ran to the end under the same generation.
     */
    private playCollected;
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
     * Start one element, reading a pause as the cancellation it is.
     * @param element - element to start.
     * @param generation - token the run belongs to.
     * @returns whether playback started; false means a stop got there first.
     */
    private startPlayback;
    /**
     * Resolve when one element stops producing sound, whether it ended, failed, or
     * was stopped by a newer request.
     * @param element - the audio element.
     * @param generation - token the run belongs to.
     */
    private playedOut;
    private dropPlayback;
    private releaseChunk;
}
//# sourceMappingURL=speech-audio.d.ts.map