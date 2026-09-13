import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SpeechState } from './speech-state.ts';
/** Injected business face of one read-aloud action. */
export interface SpeechActionInjected {
    hooks: {
        /** Shared read-aloud state: the active message and the folded prose. */
        speech: HostObservable<SpeechState>;
    };
    /**
     * Speak the message, or stop it while it is the active one; a failed message
     * retries instead of stopping.
     * @param messageId - target assistant message.
     */
    toggle: (messageId: string) => void;
}
/** Full props of one read-aloud action. */
export type SpeechActionProps = PropsRuntime<'conversation.chat.assistant-actions'> & InjectFace<SpeechActionInjected> & PropsLocale<'speech'>;
/**
 * Render the read-aloud action.
 * @param props - composed slot props.
 * @returns the action element tree.
 */
export declare function SpeakAction({ messageId, t, useSpeech, toggle }: SpeechActionProps): import("react").JSX.Element;
//# sourceMappingURL=SpeakAction.d.ts.map