import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DateRangeSelector from './DateRangeSelector'

describe('DateRangeSelector', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders presets and hides custom controls when a preset is selected', () => {
    const value = { range: 'last.week', start_date: null, end_date: null }
    render(<DateRangeSelector value={value} onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'Last week' })).toHaveClass('active')
    expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('End date')).not.toBeInTheDocument()
  })

  it('renders single range pill button and custom inputs when custom range is selected', () => {
    const value = { range: 'custom', start_date: '2025-08-29', end_date: '2026-09-14' }
    render(<DateRangeSelector value={value} onChange={vi.fn()} />)

    // Range pill displays formatted d MMM yyyy range
    expect(screen.getByText('29 Aug 2025 → 14 Sep 2026')).toBeInTheDocument()

    // Popover inputs display formatted dates
    expect(screen.getByLabelText('Start date')).toHaveValue('29 Aug 2025')
    expect(screen.getByLabelText('End date')).toHaveValue('14 Sep 2026')
  })

  it('displays "Any date" instead of dashes or 1912 when empty or unset', () => {
    const value = { range: 'custom', start_date: '', end_date: '' }
    render(<DateRangeSelector value={value} onChange={vi.fn()} />)

    expect(screen.getByText('Any date → Today')).toBeInTheDocument()
    expect(screen.getByLabelText('Start date')).toHaveAttribute('placeholder', 'Any date')
    expect(screen.getByLabelText('End date')).toHaveAttribute('placeholder', 'Any date')
    expect(screen.queryByText(/1912/)).not.toBeInTheDocument()
  })

  it('updates start date and end date when typed into inputs', () => {
    const onChange = vi.fn()
    const value = { range: 'custom', start_date: '', end_date: '' }
    render(<DateRangeSelector value={value} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2025-08-29' } })
    expect(onChange).toHaveBeenCalledWith({
      range: 'custom',
      start_date: '2025-08-29',
      end_date: '',
    })

    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-09-14' } })
    expect(onChange).toHaveBeenCalledWith({
      range: 'custom',
      start_date: '',
      end_date: '2026-09-14',
    })
  })

  it('toggles the calendar popover when clicking the pill button', () => {
    const value = { range: 'custom', start_date: '2025-08-29', end_date: '2026-09-14' }
    render(<DateRangeSelector value={value} onChange={vi.fn()} />)

    const pillBtn = screen.getByRole('button', { name: /Custom date range/ })
    expect(screen.getByLabelText('Start date')).toBeInTheDocument()

    // Click pill to close
    fireEvent.click(pillBtn)
    expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument()

    // Click pill to reopen
    fireEvent.click(pillBtn)
    expect(screen.getByLabelText('Start date')).toBeInTheDocument()
  })

  it('maintains strict single active button hierarchy in segmented range filter', () => {
    const onChange = vi.fn()
    const value = { range: 'last.month', start_date: null, end_date: null }
    render(<DateRangeSelector value={value} onChange={onChange} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(5)

    const activeTabs = tabs.filter((tab) => tab.classList.contains('active'))
    expect(activeTabs).toHaveLength(1)
    expect(activeTabs[0]).toHaveTextContent('Last month')
    expect(activeTabs[0]).toHaveAttribute('aria-selected', 'true')

    const inactiveTabs = tabs.filter((tab) => !tab.classList.contains('active'))
    expect(inactiveTabs).toHaveLength(4)
    inactiveTabs.forEach((tab) => {
      expect(tab).toHaveAttribute('aria-selected', 'false')
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Last year' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ range: 'last.year' }))
  })
})

