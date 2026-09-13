/**
 * State-only Conversation Definition: it folds each finalized assistant message
 * into the spoken-text map and owns no view target, so read-aloud reads exactly
 * the content the chat renders without adding a node to the conversation flow.
 */
/** Definition kind, unique among the composed definitions. */
const KIND = 'speech-text';
/**
 * Join the spoken source of one finalized assistant message: its text blocks, in
 * order, with paragraph breaks between them.
 * @param event - the finalized assistant message event.
 * @returns the message's prose.
 */
function assistantSource(event) {
    return event.data.message.content
        .flatMap(block => (block.type === 'text' ? [block.text] : []))
        .join('\n\n');
}
/**
 * Register the spoken-text fold.
 * @param ctx - client context carrying the conversation registries.
 * @param controller - receives every folded message's raw prose.
 */
export function registerSpeechText(ctx, controller) {
    const definition = {
        kind: KIND,
        match(event) {
            if (event.type !== 'assistant/message')
                return null;
            return { id: event.data.message.id, role: 'start' };
        },
        start(_context, match) {
            const { event } = match;
            if (event.type !== 'assistant/message')
                throw new Error('speech-text start requires assistant/message');
            controller.record(event.data.message.id, assistantSource(event));
            return { messageId: event.data.message.id };
        },
        update(context, match) {
            // A rebuilt window folds the same finalized message again; the fold is
            // idempotent, so replay cannot drift from what was spoken.
            if (match.event.type === 'assistant/message') {
                controller.record(match.event.data.message.id, assistantSource(match.event));
            }
            return context.state;
        },
    };
    ctx.effect(() => ctx.uiConversation.events.register(definition), 'ui-speech: assistant spoken text');
}
//# sourceMappingURL=nodes.js.map