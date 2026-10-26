/**
 * Browser playback over the host's synthesis route.
 *
 * A reply is spoken in **segments** — a few hundred characters each, cut on
 * sentence ends — and every segment's audio is appended to the **same**
 * MediaSource buffer. Two properties come out of that one decision:
 *
 * - continuity: one buffer, one element, no seams between segments, so the
 *   voice never pauses at a boundary;
 * - resilience: the service drops a connection now and then with no error
 *   frame, and a dropped connection can only cost the segment it was carrying.
 *   One request for the whole reply meant one drop silenced the reading.
 *
 * Playback starts once a few seconds of audio are buffered, early enough to feel
 * immediate and late enough that it cannot catch the network and stall in the
 * middle of a sentence. The next segment is already being fetched while the
 * current one is appended, so the buffer fills ahead of the voice.
 *
 * When MediaSource is unusable the reply is still spoken, one segment per blob.
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
    /** Aborts the response bodies a stop would otherwise keep reading forever. */
    private abort;
    /**
     * Speak one text, segment by segment, into one continuous buffer.
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
     * Append every segment to one buffer and play the result as one reading.
     * @param segments - sentence-sized spans, in order.
     * @param overrides - preview overrides, when any.
     * @param generation - token this run belongs to.
     * @param signal - aborts the replies in flight.
     * @returns whether playback ran to the end under the same generation.
     */
    private streamSegments;
    /**
     * Append one segment's audio, retrying a segment the service cut before it
     * produced anything.
     * @param buffer - the source buffer every segment shares.
     * @param text - the segment to speak.
     * @param response - its first reply.
     * @param overrides - preview overrides, when any.
     * @param signal - aborts the replies in flight.
     * @param generation - token this run belongs to.
     * @param gate - asked after every append whether playback may start yet.
     * @returns how many audio bytes this segment contributed.
     */
    private appendSegment;
    /**
     * Read one reply's body into the buffer.
     * @param buffer - the source buffer.
     * @param response - the reply carrying this segment's audio.
     * @param generation - token this run belongs to.
     * @param gate - asked after every append whether playback may start yet.
     * @returns how many audio bytes reached the buffer.
     */
    private appendBody;
    /**
     * Request one segment's audio.
     * @param text - the segment to speak.
     * @param overrides - preview overrides, when any.
     * @param signal - aborts the reply in flight.
     * @returns the reply, its body still unread.
     */
    private fetchSegment;
    /**
     * Fallback for a browser without MediaSource: one segment per blob, played in
     * order. It cannot overlap segments, so a boundary is audible here.
     * @param segments - sentence-sized spans, in order.
     * @param overrides - preview overrides, when any.
     * @param generation - token this run belongs to.
     * @param signal - aborts the replies in flight.
     * @returns whether every segment played out under the same generation.
     */
    private playSegmentBySegment;
    /**
     * Fetch the audio of one segment as a whole file.
     * @param text - segment to speak.
     * @param overrides - preview overrides, when any.
     * @param signal - aborts the reply in flight.
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