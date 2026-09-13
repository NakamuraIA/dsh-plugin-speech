/**
 * Client plugin body: fold every finalized assistant message's prose, drive
 * read-aloud through the host's synthesis route, and register the message
 * action plus its settings row. Nothing here holds a credential — the host owns
 * the provider call and the browser only posts text.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
export type { SpeechActionInjected, SpeechActionProps } from './SpeakAction.tsx';
export type { SpeechRowComponentProps, SpeechRowInjected } from './SpeechRow.tsx';
export type { SpeechRowState, SpeechRowSection } from './settings-store.ts';
export type { SpeechFailure, SpeechState } from './speech-state.ts';
export type { SpeechOverrides } from './speech-audio.ts';
export type { SpeechKey } from './locales.ts';
export type { SpeechSettings, SpeechProviderId } from '../settings.ts';
/** Namespace owning this feature's copy. */
export declare const SETTINGS_NS = "speech";
/** Required services: the surfaces' registries and the settings transport. */
export declare const inject: string[];
/**
 * Client plugin body.
 * @param ctx - client cordis context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map