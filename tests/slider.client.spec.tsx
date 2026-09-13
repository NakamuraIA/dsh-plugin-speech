// @vitest-environment jsdom
/** The range control this package owns, since the shared kit has none. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Slider } from '../src/client/Slider.tsx'

afterEach(cleanup)

describe('Slider', () => {
  it('renders a labelled range with its formatted value', () => {
    render(<Slider label="Speed" value={5} min={-50} max={50} display="+5%" onChange={() => {}} />)
    const range = screen.getByLabelText('Speed') as HTMLInputElement
    expect(range.type).toBe('range')
    expect(range.min).toBe('-50')
    expect(range.max).toBe('50')
    expect(range.value).toBe('5')
    expect(screen.getByText('+5%')).toBeDefined()
  })

  it('reports the value the user dragged to', () => {
    const onChange = vi.fn()
    render(<Slider label="Volume" value={0} min={-50} max={50} display="0%" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '-25' } })
    expect(onChange).toHaveBeenCalledWith(-25)
  })
})
