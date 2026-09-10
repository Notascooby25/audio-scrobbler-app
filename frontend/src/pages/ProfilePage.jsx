import { Link, useParams } from 'react-router-dom'

function readSavedSession() {
  try {
    return JSON.parse(localStorage.getItem('audio-scrobbler-session') || 'null')
  } catch {
    return null
  }
}

export default function ProfilePage() {
  const { userId: routeUserId } = useParams()
  const savedSession = readSavedSession()
  const userId = routeUserId || savedSession?.userId

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Audio Scrobbler App</p>
          <h1>Profile</h1>
        </div>
        <nav className="topbar-nav">
          <Link to="/">Dashboard</Link>
        </nav>
      </header>
      <section className="dashboard" aria-labelledby="profile-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Personal archive</p>
            <h2 id="profile-heading">Profile</h2>
          </div>
        </div>
        {!userId && <p className="notice">Sign in from the dashboard to view your profile.</p>}
        {userId && <p className="notice">Profile details are coming soon.</p>}
      </section>
    </main>
  )
}
