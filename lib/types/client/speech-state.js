/**
 * Browser state every read-aloud action renders from: the message currently
 * being spoken, the failure the last attempt hit, and the spoken prose folded
 * from the session log. One source per plugin, shared by every session's action
 * strip.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
/**
 * Create the shared speech state source.
 * @returns an empty, unspeaking state.
 */
export function createSpeechState() {
    return createSnapshotStore({
        active: null,
        failure: null,
        detail: null,
        sources: new Map(),
    });
}
//# sourceMappingURL=speech-state.js.map