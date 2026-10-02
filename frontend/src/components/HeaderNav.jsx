import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { readSession } from '../session'
import { fetchUnreadNotificationCount } from '../api'

const NAV_LINKS = [
  { to: '/overview', label: 'Overview' },
  { to: '/library', label: 'Library' },
  { to: '/reports', label: 'Reports' },
  { to: '/profile', label: 'Profile' },
  { to: '/following', label: 'Following' },
  { to: '/connect', label: 'Connect' },
]

export default function HeaderNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const session = readSession()

  useEffect(() => {
    if (session?.accessToken) {
      fetchUnreadNotificationCount({ token: session.accessToken })
        .then(data => setUnreadCount(data.count))
        .catch(err => console.error("Could not fetch unread count:", err))
    }
  }, [session?.accessToken])

  const linkClassName = ({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/logo.png" alt="Audio Scrobbler App" className="topbar-logo" />
      </div>
      <button
        type="button"
        className="nav-menu-toggle"
        aria-label="Toggle navigation menu"
        aria-expanded={isMenuOpen}
        aria-controls="primary-navigation"
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        Menu
      </button>
      <nav
        id="primary-navigation"
        className={isMenuOpen ? 'topbar-nav topbar-nav-open' : 'topbar-nav'}
        aria-label="Primary navigation"
      >
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink key={to} to={to} className={linkClassName} onClick={() => setIsMenuOpen(false)}>
            {label}
          </NavLink>
        ))}
        {session?.accessToken && (
          <NavLink to="/settings?tab=notifications" className={linkClassName} onClick={() => setIsMenuOpen(false)}>
            <span style={{ position: 'relative' }}>
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-5px', right: '-10px',
                  backgroundColor: 'red', color: 'white', borderRadius: '50%',
                  padding: '2px 5px', fontSize: '10px', fontWeight: 'bold'
                }}>
                  {unreadCount}
                </span>
              )}
            </span>
          </NavLink>
        )}
      </nav>
    </header>
  )
}
