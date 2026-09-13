import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * A labelled range control. The shared primitive catalog has no slider, so this
 * package owns one; it stays a native `input[type=range]` so keyboard, touch,
 * and assistive technology keep working without being reimplemented.
 */
import css from './Slider.module.css';
/**
 * Render one labelled range control.
 * @param props - control props.
 * @returns the control element.
 */
export function Slider({ label, value, min, max, display, onChange }) {
    return (_jsxs("label", { className: css.row, children: [_jsx("span", { className: css.label, children: label }), _jsx("input", { className: css.range, type: "range", min: min, max: max, value: value, onChange: (event) => { onChange(Number(event.currentTarget.value)); } }), _jsx("span", { className: css.value, children: display })] }));
}
//# sourceMappingURL=Slider.js.map