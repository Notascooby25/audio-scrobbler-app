const PAGE_SIZE_OPTIONS = [25, 50, 100, 250]
const ALL_OPTIONS = [10, 25, 50, 100, 150, 200, 250]

export default function PageSizeSelect({ value, onChange }) {
  return (
    <div className="page-size-select" role="group" aria-label="Page size">
      <span className="page-size-label">Per page</span>
      <div className="segmented-tabs" role="tablist" aria-label="Page size options">
        {PAGE_SIZE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={value === option}
            className={`segmented-tab ${value === option ? 'active' : ''}`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <select
        aria-label="Per page"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="visually-hidden-accessible"
      >
        {ALL_OPTIONS.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}
