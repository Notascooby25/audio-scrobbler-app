import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { readSession } from "../session";
import { fetchUnreadNotificationCount } from "../api";

const NAV_LINKS = [
  { to: "/overview", label: "Overview" },
  { to: "/library", label: "Library" },
  { to: "/reports", label: "Reports" },
  { to: "/setlists", label: "Set Lists" },
  { to: "/profile", label: "Profile" },
  { to: "/connect", label: "Connect" },
];

function BellIcon({ className }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function HeaderNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const session = readSession();

  useEffect(() => {
    if (!session?.accessToken) return;

    const fetchCount = () => {
      fetchUnreadNotificationCount({ token: session.accessToken })
        .then((data) => setUnreadCount(data.count))
        .catch((err) => console.error("Could not fetch unread count:", err));
    };

    // Fetch immediately on mount
    fetchCount();

    // Poll every 1 minute
    const interval = setInterval(fetchCount, 60 * 1000);

    const handleRead = () => setUnreadCount(0);
    window.addEventListener("notifications_read", handleRead);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications_read", handleRead);
    };
  }, [session?.accessToken]);

  const linkClassName = ({ isActive }) => (isActive ? "nav-link nav-link-active" : "nav-link");

  const bellAriaLabel =
    unreadCount > 0
      ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
      : "Notifications";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/logo.png" alt="Audio Scrobbler App" className="topbar-logo" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {session?.accessToken && (
          <div className="mobile-bell">
            <NavLink
              to="/settings?tab=notifications"
              className={linkClassName}
              aria-label={bellAriaLabel}
              onClick={() => setIsMenuOpen(false)}
            >
              <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <BellIcon />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-6px",
                      right: "-8px",
                      backgroundColor: "var(--color-danger, #ef4444)",
                      color: "#ffffff",
                      borderRadius: "9999px",
                      padding: "1px 5px",
                      fontSize: "10px",
                      fontWeight: "bold",
                      lineHeight: 1.2,
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </span>
            </NavLink>
          </div>
        )}

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
      </div>

      <nav
        id="primary-navigation"
        className={isMenuOpen ? "topbar-nav topbar-nav-open" : "topbar-nav"}
        aria-label="Primary navigation"
      >
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink key={to} to={to} className={linkClassName} onClick={() => setIsMenuOpen(false)}>
            {label}
          </NavLink>
        ))}
        {session?.accessToken && (
          <div className="desktop-bell">
            <NavLink
              to="/settings?tab=notifications"
              className={linkClassName}
              aria-label={bellAriaLabel}
              onClick={() => setIsMenuOpen(false)}
            >
              <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <BellIcon />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-6px",
                      right: "-8px",
                      backgroundColor: "var(--color-danger, #ef4444)",
                      color: "#ffffff",
                      borderRadius: "9999px",
                      padding: "1px 5px",
                      fontSize: "10px",
                      fontWeight: "bold",
                      lineHeight: 1.2,
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </span>
            </NavLink>
          </div>
        )}
      </nav>
    </header>
  );
}
