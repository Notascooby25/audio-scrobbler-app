import AnalyticsPage from '../components/AnalyticsPage'
import { CHANGELOG } from '../changelogData'

export default function ChangelogPage() {
  return (
    <AnalyticsPage eyebrow="Updates & Improvements" title="Changelog">
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card-body">
          <div className="changelog-container">
            {CHANGELOG.map((release) => (
              <div key={release.version} style={{ marginBottom: '2rem' }}>
                <h3
                  style={{
                    fontSize: '1.15rem',
                    marginBottom: '0.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                  }}
                >
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'var(--color-primary, #1db954)',
                      color: '#000',
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                    }}
                  >
                    v{release.version}
                  </span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>
                    {release.date}
                  </span>
                </h3>
                <ul style={{ paddingLeft: '1.25rem', color: 'var(--color-text, inherit)' }}>
                  {release.changes.map((change, index) => (
                    <li key={index} style={{ marginBottom: '0.35rem', lineHeight: 1.5 }}>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AnalyticsPage>
  )
}
