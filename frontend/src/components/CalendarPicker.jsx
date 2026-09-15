import { useState } from 'react'

export default function CalendarPicker({
  startDate,
  endDate,
  onSelectDate,
  onPresetSelect,
  onClose,
}) {
  // Use endDate's month, or startDate's month, or current month as initial view
  const initialDate = endDate ? new Date(endDate) : startDate ? new Date(startDate) : new Date()
  const [viewYear, setViewYear] = useState(() => initialDate.getFullYear() > 1920 ? initialDate.getFullYear() : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => !isNaN(initialDate.getMonth()) ? initialDate.getMonth() : new Date().getMonth())
  const [selectingStep, setSelectingStep] = useState('start')

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(viewYear, viewMonth, 1))

  // Days in this month
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sun
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate()

  const handleDayClick = (day) => {
    const mStr = String(viewMonth + 1).padStart(2, '0')
    const dStr = String(day).padStart(2, '0')
    const dateStr = `${viewYear}-${mStr}-${dStr}`

    if (selectingStep === 'start') {
      onSelectDate(dateStr, 'start')
      setSelectingStep('end')
    } else {
      onSelectDate(dateStr, 'end')
      setSelectingStep('start')
    }
  }

  const applyQuickPreset = (type) => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    let start = new Date()

    if (type === '7d') {
      start.setDate(today.getDate() - 7)
    } else if (type === '30d') {
      start.setDate(today.getDate() - 30)
    } else if (type === '90d') {
      start.setDate(today.getDate() - 90)
    } else if (type === 'ytd') {
      start = new Date(today.getFullYear(), 0, 1)
    } else if (type === '1y') {
      start.setFullYear(today.getFullYear() - 1)
    } else if (type === 'clear') {
      if (onPresetSelect) onPresetSelect('', '')
      return
    }

    const startStr = start.toISOString().slice(0, 10)
    if (onPresetSelect) {
      onPresetSelect(startStr, todayStr)
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="calendar-picker" role="dialog" aria-label="Calendar date picker">
      <div className="calendar-header">
        <button type="button" className="calendar-nav-btn" onClick={prevMonth} aria-label="Previous month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="calendar-month-title">{monthName}</span>
        <button type="button" className="calendar-nav-btn" onClick={nextMonth} aria-label="Next month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>

      <div className="calendar-grid" role="grid">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <span key={`blank-${i}`} className="calendar-cell calendar-cell-empty" />
        ))}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1
          const mStr = String(viewMonth + 1).padStart(2, '0')
          const dStr = String(day).padStart(2, '0')
          const dateStr = `${viewYear}-${mStr}-${dStr}`

          const isStart = startDate === dateStr
          const isEnd = endDate === dateStr
          const inRange = startDate && endDate && dateStr > startDate && dateStr < endDate
          const isToday = todayStr === dateStr

          let cellClass = 'calendar-day-btn'
          if (isStart) cellClass += ' calendar-day-start'
          if (isEnd) cellClass += ' calendar-day-end'
          if (inRange) cellClass += ' calendar-day-range'
          if (isToday) cellClass += ' calendar-day-today'

          return (
            <button
              key={day}
              type="button"
              className={cellClass}
              onClick={() => handleDayClick(day)}
              aria-label={dateStr}
              aria-pressed={isStart || isEnd}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="calendar-presets-row">
        <button type="button" className="calendar-preset-chip" onClick={() => applyQuickPreset('30d')}>Last 30d</button>
        <button type="button" className="calendar-preset-chip" onClick={() => applyQuickPreset('90d')}>Last 90d</button>
        <button type="button" className="calendar-preset-chip" onClick={() => applyQuickPreset('1y')}>Past year</button>
        <button type="button" className="calendar-preset-chip" onClick={() => applyQuickPreset('clear')}>Clear</button>
        {onClose && (
          <button type="button" className="calendar-done-btn" onClick={onClose}>Done</button>
        )}
      </div>
    </div>
  )
}

