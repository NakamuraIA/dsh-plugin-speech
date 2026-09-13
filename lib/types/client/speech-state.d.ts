/**
 * Browser state every read-aloud action renders from: the message currently
 * being spoken, the failure the last attempt hit, and the spoken prose folded
 * from the session log. One source per plugin, shared by every session's action
 * strip.
 */
import { type SnapshotStore } from '@deepseek-ai/dsh-client-store';
/** Why the last read-aloud attempt produced nothing, in the reader's terms. */
export type SpeechFailure = 
/** The message projected onto no speakable text. */
'unavailable'
/** The provider call failed, or the audio could not be played. */
 | 'provider';
/** State the read-aloud surface renders from. */
export interface SpeechState {
    /** Message whose audio is being produced or playing; null while silent. */
    active: string | null;
    /** Failure the last attempt hit; null when none stands. */
    failure: SpeechFailure | null;
    /**
     * The underlying error text behind {@link failure}, shown as the notice's
     * tooltip. Diagnostics only: the visible copy stays localized, and the detail
     * is whatever the provider or the transport reported.
     */
    detail: string | null;
    /**
     * Assistant prose by message id, folded from the session log. The projection
     * onto spoken text happens per request, so changing a read-aloud preference
     * applies to every later reading without a refold.
     */
    sources: ReadonlyMap<string, string>;
}
/**
 * Create the shared speech state source.
 * @returns an empty, unspeaking state.
 */
export declare function createSpeechState(): SnapshotStore<SpeechState>;
//# sourceMappingURL=speech-state.d.ts.map