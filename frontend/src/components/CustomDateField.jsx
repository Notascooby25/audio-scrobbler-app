import { useState } from 'react'
import { formatDateDisplay, formatMonthDisplay, parseDateInput, parseMonthInput } from '../dateRange'

export default function CustomDateField({
  label,
  id,
  value,
  onChange,
  type = 'date',
  placeholder = 'Any date',
  min,
  max,
  className = '',
}) {
  const [editingText, setEditingText] = useState(null)
  const isMonth = type === 'month'

  const formattedDisplay = isMonth
    ? formatMonthDisplay(value, '')
    : formatDateDisplay(value, '')

  const currentDisplay = editingText !== null ? editingText : (formattedDisplay || '')

  const handleChange = (e) => {
    const raw = e.target.value
    setEditingText(raw)
    const parsed = isMonth ? parseMonthInput(raw) : parseDateInput(raw)
    const nextVal = parsed !== null ? parsed : (raw.trim() === '' ? '' : raw)
    if (onChange) {
      onChange({ target: { value: nextVal } })
    }
  }

  const handleBlur = () => {
    setEditingText(null)
  }

  return (
    <div className={`date-field-wrapper ${className}`}>
      {label && <label htmlFor={id} className="date-field-label">{label}</label>}
      <div className="date-field-box">
        <svg className="date-field-calendar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <input
          id={id}
          type="text"
          aria-label={label || placeholder}
          className="date-field"
          placeholder={placeholder}
          value={currentDisplay}
          onChange={handleChange}
          onBlur={handleBlur}
          min={min}
          max={max}
        />
      </div>
    </div>
  )
}
