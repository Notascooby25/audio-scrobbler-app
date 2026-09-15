export default function LibraryViewToggle({ view, onChange, selectMode = false, onToggleSelectMode }) {
  return (
    <div className="library-view-toggle" role="group" aria-label="Library view">
      <button type="button" className={view === 'list' ? 'active' : ''} aria-pressed={view === 'list'} onClick={() => onChange('list')}>List</button>
      <button type="button" className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'} onClick={() => onChange('grid')}>Grid</button>
      {onToggleSelectMode && (
        <button
          type="button"
          className={`library-select-toggle ${selectMode ? 'active' : ''}`}
          aria-pressed={Boolean(selectMode)}
          onClick={onToggleSelectMode}
        >
          Select
        </button>
      )}
    </div>
  )
}
