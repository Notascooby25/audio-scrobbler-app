import { DATE_RANGE_LABELS, DATE_RANGE_PRESETS } from '../dateRange'

export default function DateRangeSelector({ value, onChange, showCompare = true }) {
  const handlePresetSelect = (range) => {
    if (range === 'custom') {
      onChange({ ...value, range, start_date: value.start_date || '', end_date: value.end_date || '' })
    } else {
      onChange({ ...value, range, start_date: null, end_date: null })
    }
  }

  const handlePresetChange = (event) => {
    handlePresetSelect(event.target.value)
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
        <div className="date-range-custom-inputs">
          <label>
            Start date
            <input type="date" value={value.start_date || ''} onChange={handleStartDateChange} />
          </label>
          <label>
            End date
            <input type="date" value={value.end_date || ''} onChange={handleEndDateChange} />
          </label>
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
