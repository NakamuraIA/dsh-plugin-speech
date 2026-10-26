/**
 * Browser playback over the host's synthesis route.
 *
 * One click sends the whole reply in **one request** and the host streams the
 * audio back while the service is still working. The browser appends every chunk
 * to a single MediaSource buffer and starts the element as soon as a short head
 * of audio is in hand — under a second in practice, because the service
 * synthesizes far faster than a voice speaks (measured at 73x realtime on a warm
 * connection, 1.5x on a cold one). From there the element plays out of the
 * buffer while the rest arrives behind it, so the voice is continuous and the
 * wait is a fraction of a second.
 *
 * That head is deliberately small: it exists to cover the first chunk's jitter,
 * not to wait for a meaningful part of the reply. Raising it buys nothing when
 * the service is fast and costs exactly what it waits.
 *
 * When MediaSource is unusable — or the engine accepts the type and then refuses
 * the buffer — the reply is still played as one whole file in one element.
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
     * Speak one text: one request for the whole reply, played as it arrives.
     * @param text - projected spoken text.
     * @param overrides - preview overrides, or undefined to use the durable settings.
     * @param onEnded - called once the last audio has played out.
     */
    speak(text: string, overrides: SpeechOverrides | undefined, onEnded: () => void): Promise<void>;
    /** Stop playback and abandon whatever is still arriving. */
    stop(): void;
    /** Stop playback and release the last object URL. */
    dispose(): void;
    /**
     * Fetch one reply and play it, streaming it when the browser can.
     * @param text - the whole projected text.
     * @param overrides - preview overrides, when any.
     * @param generation - token this request belongs to.
     * @param signal - aborts the reply in flight.
     * @returns whether playback ran to the end under the same generation.
     */
    private playReply;
    /**
     * Append one reply's frames and start the element as soon as the head is in.
     * @param body - the response body carrying encoded audio.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    private streamReply;
    /**
     * Drain what is left of a reply and play everything as one file.
     * @param reader - the response reader, partly consumed.
     * @param held - the chunks already in hand.
     * @param generation - token this request belongs to.
     * @returns whether playback ran to the end under the same generation.
     */
    private playCollected;
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