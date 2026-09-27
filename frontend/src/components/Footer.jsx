import { Link } from 'react-router-dom'
import { CHANGELOG } from '../changelogData'

export default function Footer() {
  const currentVersion = CHANGELOG[0]?.version || '0.9.5'

  return (
    <footer className="app-footer" data-testid="app-footer">
      <div className="app-footer-content">
        <div className="app-footer-brand">
          <span>Audio Scrobbler App</span>
          <span className="app-footer-version">v{currentVersion}</span>
        </div>
        <div className="app-footer-links">
          <Link to="/changelog" className="app-footer-link">
            Changelog
          </Link>
        </div>
      </div>
    </footer>
  )
}
