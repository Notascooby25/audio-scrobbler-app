const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function PageSizeSelect({ value, onChange }) {
  return (
    <label className="page-size-select">
      Per page
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {PAGE_SIZE_OPTIONS.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}
