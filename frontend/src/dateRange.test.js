import { describe, expect, it } from 'vitest'
import {
  createDefaultDateRange,
  formatDateDisplay,
  formatMonthDisplay,
  getDefaultCustomRange,
  isValidDateRange,
  parseDateInput,
  parseMonthInput,
  toQueryParams,
} from './dateRange'

describe('dateRange utilities', () => {
  it('creates default date range', () => {
    const range = createDefaultDateRange()
    expect(range.range).toBe('last.week')
    expect(range.start_date).toBeNull()
    expect(range.end_date).toBeNull()
    expect(range.compare_to_previous).toBe(false)
  })

  it('formats dates as d MMM yyyy', () => {
    expect(formatDateDisplay('2025-08-29')).toBe('29 Aug 2025')
    expect(formatDateDisplay('2026-09-14')).toBe('14 Sep 2026')
    expect(formatDateDisplay('2024-01-01')).toBe('1 Jan 2024')
  })

  it('never displays 1912 or bogus dates and returns fallback', () => {
    expect(formatDateDisplay('1912-10-01')).toBe('Any date')
    expect(formatDateDisplay('1900-01-01')).toBe('Any date')
    expect(formatDateDisplay('')).toBe('Any date')
    expect(formatDateDisplay(null)).toBe('Any date')
    expect(formatDateDisplay(undefined, 'Custom fallback')).toBe('Custom fallback')
  })

  it('formats months as MMM yyyy', () => {
    expect(formatMonthDisplay('2025-08')).toBe('Aug 2025')
    expect(formatMonthDisplay('2026-12')).toBe('Dec 2026')
    expect(formatMonthDisplay('1912-10')).toBe('Any date')
    expect(formatMonthDisplay('')).toBe('Any date')
  })

  it('parses date and month inputs correctly while filtering bogus years', () => {
    expect(parseDateInput('2025-08-29')).toBe('2025-08-29')
    expect(parseDateInput('29 Aug 2025')).toBe('2025-08-29')
    expect(parseDateInput('1912-10-01')).toBeNull()
    expect(parseDateInput('')).toBeNull()

    expect(parseMonthInput('2025-08')).toBe('2025-08')
    expect(parseMonthInput('Aug 2025')).toBe('2025-08')
    expect(parseMonthInput('1912-10')).toBeNull()
    expect(parseMonthInput('')).toBeNull()
  })

  it('validates date ranges, rejecting invalid or 1912 dates', () => {
    expect(isValidDateRange({ range: 'last.week' })).toBe(true)
    expect(isValidDateRange({ range: 'custom', start_date: '2025-01-01', end_date: '2025-06-01' })).toBe(true)
    expect(isValidDateRange({ range: 'custom', start_date: '2025-06-01', end_date: '2025-01-01' })).toBe(false)
    expect(isValidDateRange({ range: 'custom', start_date: '1912-01-01', end_date: '2025-01-01' })).toBe(false)
    expect(isValidDateRange({ range: 'custom', start_date: '', end_date: '' })).toBe(false)
  })

  it('returns default custom range spanning the last year to today', () => {
    const range = getDefaultCustomRange()
    expect(range.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(range.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(new Date(range.start_date).getFullYear()).toBeGreaterThan(2020)
  })

  it('builds query parameters', () => {
    expect(toQueryParams({ range: 'last.week', compare_to_previous: true })).toEqual({
      range: 'last.week',
      compare_to_previous: true,
    })
    expect(toQueryParams({ range: 'custom', start_date: '2025-01-01', end_date: '2025-02-01', compare_to_previous: false })).toEqual({
      range: 'custom',
      start_date: '2025-01-01',
      end_date: '2025-02-01',
      compare_to_previous: false,
    })
  })
})

