export const DATE_RANGE_PRESETS = ['last.week', 'last.month', 'last.year', 'custom']

export const DATE_RANGE_LABELS = {
  'last.week': 'Last week',
  'last.month': 'Last month',
  'last.year': 'Last year',
  custom: 'Custom range',
}

export function createDefaultDateRange() {
  return {
    range: 'last.week',
    start_date: null,
    end_date: null,
    compare_to_previous: false,
  }
}

export function isValidDateRange(dateRange) {
  if (!dateRange || !DATE_RANGE_PRESETS.includes(dateRange.range)) return false
  if (dateRange.range !== 'custom') return true
  if (!dateRange.start_date || !dateRange.end_date) return false
  return new Date(dateRange.start_date) <= new Date(dateRange.end_date)
}

export function toQueryParams(dateRange) {
  const params = {
    range: dateRange.range,
    compare_to_previous: Boolean(dateRange.compare_to_previous),
  }
  if (dateRange.range === 'custom') {
    params.start_date = dateRange.start_date
    params.end_date = dateRange.end_date
  }
  return params
}
