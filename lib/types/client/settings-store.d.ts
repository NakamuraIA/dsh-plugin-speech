/**
 * Speech settings row store: a mirror of the durable section plus the voice
 * catalog and the settlement of the last write this row asked for. The plugin's
 * apply-world listener is the only writer; the row reads via props.useStore.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import type { SpeechVoice } from '../providers/types.ts';
import { type SpeechProviderId } from '../settings.ts';
/** The durable preferences this row mirrors, flattened for display. */
export interface SpeechRowSection {
    /** Selected provider. */
    provider: SpeechProviderId;
    /** Selected voice id for that provider. */
    voice: string;
    /** Speaking rate delta. */
    rate: number;
    /** Volume delta. */
    volume: number;
    /** Pitch delta. */
    pitch: number;
    /** Whether read-aloud drops code and tables. */
    skipCode: boolean;
}
/** Store state mirrored from the speech settings snapshot and the voice catalog. */
export interface SpeechRowState extends SpeechRowSection {
    /** Voices the selected provider published; empty until it answers or when it has none. */
    voices: readonly SpeechVoice[];
    /** Language currently filtered in the voice picker. */
    language: string;
    /** Service revision; -1 until first sync so revision 0 lands as a change. */
    revision: number;
    /** Whether the last write this row asked for was refused or lost. */
    writeFailed: boolean;
}
/** Declared action shape giving the exported factory a stable return type. */
type SpeechRowActions = {
    sync: (draft: SpeechRowState, section: SpeechRowSection, revision: number) => void;
    setVoices: (draft: SpeechRowState, voices: readonly SpeechVoice[]) => void;
    setLanguage: (draft: SpeechRowState, language: string) => void;
    markWriteFailed: (draft: SpeechRowState, failed: boolean) => void;
};
/**
 * Declares the speech row state and write surface.
 * @returns the store handle.
 */
export declare function createSpeechRowStore(): EngineStoreHandle<SpeechRowState, SpeechRowActions>;
export {};
//# sourceMappingURL=settings-store.d.ts.map