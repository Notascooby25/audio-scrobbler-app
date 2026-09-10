import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/overview', label: 'Overview' },
  { to: '/library', label: 'Library' },
  { to: '/reports', label: 'Reports' },
  { to: '/profile', label: 'Profile' },
  { to: '/connect', label: 'Connect' },
]

export default function HeaderNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const linkClassName = ({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Audio Scrobbler App</p>
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
      </nav>
    </header>
  )
}
