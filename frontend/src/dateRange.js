export const DATE_RANGE_PRESETS = ['last.week', 'last.month', 'last.year', 'all.time', 'custom']

export const DATE_RANGE_LABELS = {
  'last.week': 'Last week',
  'last.month': 'Last month',
  'last.year': 'Last year',
  'all.time': 'All time',
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

export function getDefaultCustomRange() {
  const end = new Date()
  const start = new Date()
  start.setFullYear(end.getFullYear() - 1)
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  }
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDateDisplay(dateStr, fallback = 'Any date') {
  if (!dateStr) return fallback
  try {
    const clean = String(dateStr).split('T')[0].trim()
    const parts = clean.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const monthIndex = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      if (isNaN(year) || year <= 1920 || monthIndex < 0 || monthIndex > 11) return fallback
      return `${day} ${SHORT_MONTHS[monthIndex]} ${year}`
    } else {
      const date = new Date(clean)
      if (!isNaN(date.getTime()) && date.getFullYear() > 1920) {
        return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`
      }
    }
  } catch {
    // fallback
  }
  return fallback
}

export function formatMonthDisplay(monthStr, fallback = 'Any date') {
  if (!monthStr) return fallback
  try {
    const clean = String(monthStr).trim()
    const parts = clean.split('-')
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10)
      const monthIndex = parseInt(parts[1], 10) - 1
      if (isNaN(year) || year <= 1920 || monthIndex < 0 || monthIndex > 11) return fallback
      return `${SHORT_MONTHS[monthIndex]} ${year}`
    }
  } catch {
    // fallback
  }
  return fallback
}

export function parseDateInput(inputStr) {
  if (!inputStr || !String(inputStr).trim()) return null
  const str = String(inputStr).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const year = parseInt(str.slice(0, 4), 10)
    return year > 1920 ? str : null
  }
  const parsed = Date.parse(str)
  if (!isNaN(parsed)) {
    const d = new Date(parsed)
    if (d.getFullYear() > 1920) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
  return null
}

export function parseMonthInput(inputStr) {
  if (!inputStr || !String(inputStr).trim()) return null
  const str = String(inputStr).trim()
  if (/^\d{4}-\d{2}$/.test(str)) {
    const year = parseInt(str.slice(0, 4), 10)
    return year > 1920 ? str : null
  }
  const parsed = Date.parse(str.length <= 8 ? str + '-01' : str)
  if (!isNaN(parsed)) {
    const d = new Date(parsed)
    if (d.getFullYear() > 1920) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      return `${year}-${month}`
    }
  }
  return null
}

export function isValidDateRange(dateRange) {
  if (!dateRange || !DATE_RANGE_PRESETS.includes(dateRange.range)) return false
  if (dateRange.range !== 'custom') return true
  if (!dateRange.start_date || !dateRange.end_date) return false
  const s = new Date(dateRange.start_date)
  const e = new Date(dateRange.end_date)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false
  if (s.getFullYear() <= 1920 || e.getFullYear() <= 1920) return false
  return s <= e
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
