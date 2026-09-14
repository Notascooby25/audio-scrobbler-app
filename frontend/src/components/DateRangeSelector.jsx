import { useEffect, useRef, useState } from 'react'
import { DATE_RANGE_LABELS, DATE_RANGE_PRESETS, formatDateDisplay, parseDateInput } from '../dateRange'
import CalendarPicker from './CalendarPicker'

export default function DateRangeSelector({ value, onChange, showCompare = true }) {
  const [popoverOpen, setPopoverOpen] = useState(true)
  const [startInputText, setStartInputText] = useState(null)
  const [endInputText, setEndInputText] = useState(null)
  const containerRef = useRef(null)

  const handlePresetSelect = (range) => {
    if (range === 'custom') {
      onChange({ ...value, range, start_date: value.start_date || '', end_date: value.end_date || '' })
      setPopoverOpen(true)
    } else {
      onChange({ ...value, range, start_date: null, end_date: null })
      setPopoverOpen(false)
    }
  }

  const handlePresetChange = (event) => {
    handlePresetSelect(event.target.value)
  }

  const handleStartDateChange = (event) => {
    const raw = event.target.value
    setStartInputText(raw)
    const parsed = parseDateInput(raw)
    if (parsed) {
      onChange({ ...value, start_date: parsed })
    } else if (!raw.trim()) {
      onChange({ ...value, start_date: '' })
    }
  }

  const handleEndDateChange = (event) => {
    const raw = event.target.value
    setEndInputText(raw)
    const parsed = parseDateInput(raw)
    if (parsed) {
      onChange({ ...value, end_date: parsed })
    } else if (!raw.trim()) {
      onChange({ ...value, end_date: '' })
    }
  }

  const handleCalendarSelect = (dateStr, endpoint) => {
    if (endpoint === 'start') {
      onChange({ ...value, start_date: dateStr })
      setStartInputText(null)
    } else {
      onChange({ ...value, end_date: dateStr })
      setEndInputText(null)
    }
  }

  const handleQuickPreset = (startStr, endStr) => {
    onChange({ ...value, start_date: startStr, end_date: endStr })
    setStartInputText(null)
    setEndInputText(null)
  }

  const handleCompareToggle = (event) => {
    onChange({ ...value, compare_to_previous: event.target.checked })
  }

  const formattedStart = formatDateDisplay(value.start_date, 'Any date')
  const formattedEnd = formatDateDisplay(value.end_date, 'Today')
  const pillDisplay = (value.start_date || value.end_date)
    ? `${formattedStart} → ${formattedEnd}`
    : 'Any date → Today'

  const startDisplay = startInputText !== null ? startInputText : (value.start_date ? formatDateDisplay(value.start_date, '') : '')
  const endDisplay = endInputText !== null ? endInputText : (value.end_date ? formatDateDisplay(value.end_date, '') : '')

  return (
    <div className="date-range-selector" role="group" aria-label="Date range" ref={containerRef}>
      <div className="date-range-segmented-group">
        <label className="date-range-label" htmlFor="date-range-native-select">
          Range
        </label>
        <div className="segmented-tabs" role="tablist" aria-label="Range presets">
          {DATE_RANGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              role="tab"
              aria-selected={value.range === preset}
              className={`segmented-tab ${value.range === preset ? 'active' : ''}`}
              onClick={() => handlePresetSelect(preset)}
            >
              {DATE_RANGE_LABELS[preset]}
            </button>
          ))}
        </div>
        <select
          id="date-range-native-select"
          aria-label="Range"
          value={value.range}
          onChange={handlePresetChange}
          className="visually-hidden-accessible"
        >
          {DATE_RANGE_PRESETS.map((preset) => (
            <option key={preset} value={preset}>{DATE_RANGE_LABELS[preset]}</option>
          ))}
        </select>
      </div>

      {value.range === 'custom' && (
        <div className="date-range-custom-wrapper">
          <button
            type="button"
            className={`date-range-pill ${popoverOpen ? 'active' : ''}`}
            aria-expanded={popoverOpen}
            aria-haspopup="dialog"
            aria-label="Custom date range: click to toggle calendar"
            onClick={() => setPopoverOpen((open) => !open)}
          >
            <svg className="calendar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span className="date-range-pill-text">{pillDisplay}</span>
            <svg className="pill-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: popoverOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {popoverOpen && (
            <div className="date-range-popover" role="dialog" aria-label="Custom date range selector">
              <div className="date-range-custom-inputs">
                <label>
                  Start date
                  <input
                    id="custom-start-date"
                    type="text"
                    aria-label="Start date"
                    className="date-field"
                    placeholder="Any date"
                    value={startDisplay}
                    onChange={handleStartDateChange}
                    onBlur={() => setStartInputText(null)}
                  />
                </label>
                <span className="date-range-arrow" aria-hidden="true">→</span>
                <label>
                  End date
                  <input
                    id="custom-end-date"
                    type="text"
                    aria-label="End date"
                    className="date-field"
                    placeholder="Any date"
                    value={endDisplay}
                    onChange={handleEndDateChange}
                    onBlur={() => setEndInputText(null)}
                  />
                </label>
              </div>

              <CalendarPicker
                startDate={value.start_date}
                endDate={value.end_date}
                onSelectDate={handleCalendarSelect}
                onPresetSelect={handleQuickPreset}
                onClose={() => setPopoverOpen(false)}
              />
            </div>
          )}
        </div>
      )}

      {showCompare && (
        <label className="date-range-compare">
          <input type="checkbox" checked={Boolean(value.compare_to_previous)} onChange={handleCompareToggle} />
          Compare to previous period
        </label>
      )}
    </div>
  )
}
