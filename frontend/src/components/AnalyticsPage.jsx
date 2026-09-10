import { Link } from 'react-router-dom'

export default function AnalyticsPage({ eyebrow, title, children }) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Audio Scrobbler App</p>
          <h1>{title}</h1>
        </div>
        <nav className="topbar-nav" aria-label="Primary navigation">
          <Link to="/overview">Overview</Link>
          <Link to="/library">Library</Link>
          <Link to="/reports">Reports</Link>
          <Link to="/profile">Profile</Link>
        </nav>
      </header>
      <section className="dashboard analytics-page">
        <p className="section-kicker">{eyebrow}</p>
        {children}
      </section>
    </main>
  )
}