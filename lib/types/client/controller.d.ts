/**
 * Read-aloud orchestration: owns the folded assistant prose, drives playback,
 * and publishes the state every speaker action renders from. One controller per
 * plugin, so a second request stops whatever the first started, across sessions
 * included. The projection onto spoken text runs per request, so a preference
 * change applies to the next reading without re-folding the log.
 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import { type SpeechTextOptions } from '../speech-text.ts';
import type { SpeechAudio, SpeechOverrides } from './speech-audio.ts';
import type { SpeechState } from './speech-state.ts';
/** Owns read-aloud state transitions over one playback engine. */
export declare class SpeechController {
    private readonly state;
    private readonly audio;
    private readonly report;
    /**
     * @param state - the shared state source every action reads.
     * @param audio - playback over the host's synthesis route.
     * @param report - receives failure detail (the surface shows the code's copy).
     */
    constructor(state: SnapshotStore<SpeechState>, audio: SpeechAudio, report: (message: string) => void);
    /**
     * Fold one finalized assistant message's prose.
     * @param messageId - the message the prose belongs to.
     * @param source - the message's raw text blocks, before projection.
     */
    record(messageId: string, source: string): void;
    /**
     * Speak one message, replacing whatever is playing. A request superseded by a
     * newer one starts nothing.
     * @param messageId - message whose audio is requested.
     * @param options - projection options in effect for this reading.
     * @param overrides - preview overrides when the settings screen asks for them.
     */
    speak(messageId: string, options: SpeechTextOptions, overrides?: SpeechOverrides): Promise<void>;
    /**
     * Speak one ad-hoc sample for the settings row's test button, through the
     * settings currently on screen rather than the durable ones.
     * @param text - sample to speak.
     * @param overrides - provider, voice, and tuning to preview.
     */
    speakSample(text: string, overrides: SpeechOverrides): Promise<void>;
    /** Stop the current playback and clear the active message. */
    stop(): void;
    /** Release playback with the owning plugin. */
    dispose(): void;
    private publish;
}
//# sourceMappingURL=controller.d.ts.map