export default function ImportProgressBar({ progress }) {
  if (!progress) return null

  const { stage, percent = 0, message = '', current = 0, total = 0, errors = [] } = progress

  const stageLabels = {
    file_validation: 'Validating File',
    record_normalization: 'Normalizing Records',
    artwork_caching: 'Caching Artwork',
    database_insertion: 'Inserting Scrobbles',
    completion: 'Import Complete',
  }

  const stageName = stageLabels[stage] || 'Importing'

  return (
    <section className="import-progress-card" aria-label="Import progress">
      <div className="import-progress-header">
        <span className="import-progress-stage">{stageName}</span>
        <span className="import-progress-percent">{percent}%</span>
      </div>

      <div className="import-progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="import-progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>

      <div className="import-progress-footer">
        <p className="import-progress-message" role="status">
          {message}
        </p>
        {total > 0 && (
          <span className="import-progress-count">
            {current.toLocaleString()} / {total.toLocaleString()}
          </span>
        )}
      </div>

      {errors && errors.length > 0 && (
        <details className="import-errors-details">
          <summary>
            {errors.length} failed or skipped {errors.length === 1 ? 'record' : 'records'}
          </summary>
          <ul className="import-errors-list">
            {errors.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

