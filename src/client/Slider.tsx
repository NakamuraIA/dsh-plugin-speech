/**
 * A labelled range control. The shared primitive catalog has no slider, so this
 * package owns one; it stays a native `input[type=range]` so keyboard, touch,
 * and assistive technology keep working without being reimplemented.
 */
import css from './Slider.module.css'

/** One labelled range row. */
export interface SliderProps {
  /** Localized label, associated with the input. */
  label: string
  /** Current value. */
  value: number
  /** Lowest value. */
  min: number
  /** Highest value. */
  max: number
  /** Rendered beside the track; the caller owns its formatting. */
  display: string
  /** Called with the value the user asked for. */
  onChange: (value: number) => void
}

/**
 * Render one labelled range control.
 * @param props - control props.
 * @returns the control element.
 */
export function Slider({ label, value, min, max, display, onChange }: SliderProps) {
  return (
    <label className={css.row}>
      <span className={css.label}>{label}</span>
      <input
        className={css.range}
        type="range"
        min={min}
        max={max}
        value={value}
        // The wrapping label also carries the formatted value, so the control
        // names itself: otherwise the accessible name would read "Speed+5%".
        aria-label={label}
        onChange={(event) => { onChange(Number(event.currentTarget.value)) }}
      />
      <span className={css.value}>{display}</span>
    </label>
  )
}
