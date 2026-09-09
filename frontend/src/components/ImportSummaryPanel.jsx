export default function ImportSummaryPanel({ result, error, onDismiss }) {
  if (!result && !error) return null

  return (
    <div className={`import-summary${error ? ' import-summary-error' : ''}`} role="status">
      {error && <p className="notice notice-error">{error}</p>}
      {result && (
        <>
          <p className="import-summary-heading">
            Imported from <strong>{result.source}</strong>
          </p>
          <dl className="import-summary-counts">
            <div><dt>Inserted</dt><dd>{result.summary.inserted}</dd></div>
            <div><dt>Duplicate</dt><dd>{result.summary.duplicate}</dd></div>
            <div><dt>Skipped</dt><dd>{result.summary.skipped}</dd></div>
          </dl>
        </>
      )}
      <button type="button" className="import-summary-dismiss" onClick={onDismiss}>Dismiss</button>
    </div>
  )
}
