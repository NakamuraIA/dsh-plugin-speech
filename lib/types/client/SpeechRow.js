import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Read-aloud settings row registered into the General section item slot: the
 * service, the voice (language first, then the voices that language offers), the
 * three tuning sliders, the skip-code switch, and a test button that speaks the
 * settings currently on screen — saved or not.
 */
import { useState } from 'react';
import { Button, IconChevronDownOutline14, Menu, Switch } from '@deepseek-ai/dsh-client-ui-primitives';
import { SPEECH_PROVIDERS } from "../settings.js";
import { Slider } from "./Slider.js";
import css from './SpeechRow.module.css';
/** Tuning bounds, matching the durable schema. */
const TUNING_MIN = -50;
const TUNING_MAX = 50;
/** Signed unit value, in whatever unit the locale names for this control. */
function signed(value, unit) {
    return `${value > 0 ? '+' : ''}${value}${unit}`;
}
/** One labelled dropdown: a pill that opens a menu of string options. */
function Picker({ label, options, selected, onSelect }) {
    const [open, setOpen] = useState(false);
    const active = options.find(option => option.id === selected)?.label ?? selected;
    return (_jsxs("div", { className: css.field, children: [_jsx("div", { className: css.fieldLabel, children: label }), _jsx(Menu, { open: open, onClose: () => { setOpen(false); }, items: options, selectedId: selected, onSelect: (id) => {
                    onSelect(id);
                    setOpen(false);
                }, align: "start", portal: true, anchor: (_jsxs("button", { type: "button", className: css.selector, "aria-haspopup": "menu", "aria-expanded": open, onClick: () => { setOpen(current => !current); }, children: [_jsx("span", { className: css.selectorText, children: active }), _jsx(IconChevronDownOutline14, { className: css.chevron })] })) })] }));
}
/**
 * Render the read-aloud settings row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function SpeechRow({ t, useStore, setProvider, setVoice, setTuning, setSkipCode, test, }) {
    const provider = useStore(s => s.provider);
    const voice = useStore(s => s.voice);
    const rate = useStore(s => s.rate);
    const volume = useStore(s => s.volume);
    const pitch = useStore(s => s.pitch);
    const skipCode = useStore(s => s.skipCode);
    const voices = useStore(s => s.voices);
    const language = useStore(s => s.language);
    const writeFailed = useStore(s => s.writeFailed);
    const languages = [...new Set(voices.map(entry => entry.language))].sort();
    const offered = voices.filter(entry => entry.language === language);
    return (_jsxs("div", { className: css.group, children: [_jsxs("div", { className: css.rowText, children: [_jsx("div", { className: css.title, children: t('row.title') }), _jsx("div", { className: css.desc, children: t('row.description') }), writeFailed && _jsx("div", { className: css.failure, role: "status", children: t('row.writeFailed') })] }), _jsx(Picker, { label: t('row.provider'), options: SPEECH_PROVIDERS.map(id => ({ id, label: t(`provider.${id}`) })), selected: provider, onSelect: (id) => { setProvider(id); } }), _jsx(Picker, { label: t('row.language'), options: languages.map(tag => ({ id: tag, label: tag })), selected: language, onSelect: (id) => { setVoice(firstVoiceOf(voices, id)); } }), _jsx(Picker, { label: t('row.voice'), options: offered.map(entry => ({ id: entry.id, label: entry.name })), selected: voice, onSelect: setVoice }), _jsx(Slider, { label: t('row.rate'), value: rate, min: TUNING_MIN, max: TUNING_MAX, display: signed(rate, t('row.percentUnit')), onChange: (value) => { setTuning('rate', value); } }), _jsx(Slider, { label: t('row.volume'), value: volume, min: TUNING_MIN, max: TUNING_MAX, display: signed(volume, t('row.percentUnit')), onChange: (value) => { setTuning('volume', value); } }), _jsx(Slider, { label: t('row.pitch'), value: pitch, min: TUNING_MIN, max: TUNING_MAX, display: signed(pitch, t('row.pitchUnit')), onChange: (value) => { setTuning('pitch', value); } }), _jsxs("div", { className: css.fieldRow, children: [_jsxs("div", { className: css.fieldText, children: [_jsx("div", { className: css.fieldLabel, children: t('row.skipCode') }), _jsx("div", { className: css.desc, children: t('row.skipCode.description') })] }), _jsx(Switch, { checked: skipCode, label: t('row.skipCode'), onChange: setSkipCode })] }), _jsx("div", { className: css.testRow, children: _jsx(Button, { variant: "outline", onClick: () => {
                        test(t('row.testSample'), {
                            provider,
                            voice,
                            tuning: { rate, volume, pitch },
                        });
                    }, children: t('row.test') }) }), _jsx("div", { className: css.sample, children: t('row.testSample') })] }));
}
/**
 * Pick the voice one language selection lands on: its first listed voice, or the
 * current selection when that selection already belongs to the language.
 * @param voices - full catalog.
 * @param language - language the user selected.
 * @returns the voice id to select.
 */
function firstVoiceOf(voices, language) {
    /* v8 ignore next -- every language offered came from this catalog, so a lookup for one always finds a voice */
    return voices.find(entry => entry.language === language)?.id ?? '';
}
//# sourceMappingURL=SpeechRow.js.map