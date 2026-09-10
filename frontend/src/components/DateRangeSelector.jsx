import { DATE_RANGE_LABELS, DATE_RANGE_PRESETS } from '../dateRange'

export default function DateRangeSelector({ value, onChange }) {
  const handlePresetChange = (event) => {
    const range = event.target.value
    if (range === 'custom') {
      onChange({ ...value, range, start_date: value.start_date || '', end_date: value.end_date || '' })
    } else {
      onChange({ ...value, range, start_date: null, end_date: null })
    }
  }

  const handleStartDateChange = (event) => {
    onChange({ ...value, start_date: event.target.value })
  }

  const handleEndDateChange = (event) => {
    onChange({ ...value, end_date: event.target.value })
  }

  const handleCompareToggle = (event) => {
    onChange({ ...value, compare_to_previous: event.target.checked })
  }

  return (
    <div className="date-range-selector" role="group" aria-label="Date range">
      <label>
        Range
        <select value={value.range} onChange={handlePresetChange}>
          {DATE_RANGE_PRESETS.map((preset) => (
            <option key={preset} value={preset}>{DATE_RANGE_LABELS[preset]}</option>
          ))}
        </select>
      </label>
      {value.range === 'custom' && (
        <>
          <label>
            Start date
            <input type="date" value={value.start_date || ''} onChange={handleStartDateChange} />
          </label>
          <label>
            End date
            <input type="date" value={value.end_date || ''} onChange={handleEndDateChange} />
          </label>
        </>
      )}
      <label className="date-range-compare">
        <input type="checkbox" checked={Boolean(value.compare_to_previous)} onChange={handleCompareToggle} />
        Compare to previous period
      </label>
    </div>
  )
}
