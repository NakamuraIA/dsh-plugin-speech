/** One labelled range row. */
export interface SliderProps {
    /** Localized label, associated with the input. */
    label: string;
    /** Current value. */
    value: number;
    /** Lowest value. */
    min: number;
    /** Highest value. */
    max: number;
    /** Rendered beside the track; the caller owns its formatting. */
    display: string;
    /** Called with the value the user asked for. */
    onChange: (value: number) => void;
}
/**
 * Render one labelled range control.
 * @param props - control props.
 * @returns the control element.
 */
export declare function Slider({ label, value, min, max, display, onChange }: SliderProps): import("react").JSX.Element;
//# sourceMappingURL=Slider.d.ts.map