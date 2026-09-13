/**
 * State-only Conversation Definition: it folds each finalized assistant message
 * into the spoken-text map and owns no view target, so read-aloud reads exactly
 * the content the chat renders without adding a node to the conversation flow.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { SpeechController } from './controller.ts';
/**
 * Register the spoken-text fold.
 * @param ctx - client context carrying the conversation registries.
 * @param controller - receives every folded message's raw prose.
 */
export declare function registerSpeechText(ctx: ClientContext, controller: SpeechController): void;
//# sourceMappingURL=nodes.d.ts.map