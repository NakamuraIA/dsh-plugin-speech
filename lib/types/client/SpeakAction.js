import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Read-aloud action for one finalized assistant message: a play/stop control in
 * the message's action strip, with the failure it hit shown beside it.
 */
import { IconPlayOutline16, IconStopFill16 } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './SpeakAction.module.css';
/** Failure copy per code, so the rendered key stays a literal for the locale seat. */
const FAILURE_KEYS = {
    unavailable: 'speak.failed.unavailable',
    provider: 'speak.failed.provider',
};
/**
 * Render the read-aloud action.
 * @param props - composed slot props.
 * @returns the action element tree.
 */
export function SpeakAction({ messageId, t, useSpeech, toggle }) {
    const active = useSpeech(s => s.active);
    const failure = useSpeech(s => s.failure);
    const detail = useSpeech(s => s.detail);
    const known = useSpeech(s => s.sources.has(messageId));
    const mine = active === messageId;
    const failed = mine && failure !== null;
    const speaking = mine && !failed;
    const label = speaking ? t('speak.stop') : t('speak.read');
    return (_jsxs("span", { className: css.wrap, children: [failed && (_jsx("span", { className: css.failure, role: "status", title: detail ?? undefined, children: t(FAILURE_KEYS[failure]) })), _jsx("button", { type: "button", className: css.action, "aria-label": label, title: label, disabled: !known && !mine, onClick: () => { toggle(String(messageId)); }, children: speaking ? _jsx(IconStopFill16, {}) : _jsx(IconPlayOutline16, {}) })] }));
}
//# sourceMappingURL=SpeakAction.js.map