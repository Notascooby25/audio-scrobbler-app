import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { readSession } from "../session";
import { fetchUnreadNotificationCount } from "../api";

const NAV_LINKS = [
  { to: "/overview", label: "Play", alsoActive: "/" },
  { to: "/library", label: "Library" },
  { to: "/reports", label: "Reports" },
  // A gig's setlist page (/gigs/:id) belongs to the Gigs section
  { to: "/setlists", label: "Gigs", alsoActive: "/gigs/" },
];

const ICON_LINKS = [
  { to: "/profile", label: "Profile", Icon: UserIcon },
  { to: "/connect", label: "Connect", Icon: LinkPlugIcon },
];

function UserIcon({ className }) {
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
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LinkPlugIcon({ className }) {
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

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

  const { pathname } = useLocation();
  const linkClassName = ({ isActive }) => (isActive ? "nav-link nav-link-active" : "nav-link");
  const iconLinkClassName = ({ isActive }) =>
    isActive ? "nav-link nav-icon-link nav-link-active" : "nav-link nav-icon-link";
  const navLinkClassName =
    (alsoActive) =>
    ({ isActive }) => {
      const matchesAlso =
        alsoActive === "/"
          ? pathname === "/"
          : Boolean(alsoActive && pathname.startsWith(alsoActive));
      return linkClassName({
        isActive: isActive || matchesAlso,
      });
    };

  const bellAriaLabel =
    unreadCount > 0
      ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
      : "Notifications";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/logo.png" alt="Audio Scrobbler App" className="topbar-logo" />
      </div>

      <nav
        id="primary-navigation"
        className={isMenuOpen ? "topbar-nav topbar-nav-open" : "topbar-nav"}
        aria-label="Primary navigation"
      >
        <div className="topbar-links">
          {NAV_LINKS.map(({ to, label, alsoActive }) => (
            <NavLink
              key={to}
              to={to}
              className={navLinkClassName(alsoActive)}
              onClick={() => setIsMenuOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className="topbar-icons" role="group" aria-label="Account and connections">
          {ICON_LINKS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={iconLinkClassName}
              aria-label={label}
              title={label}
              onClick={() => setIsMenuOpen(false)}
            >
              <Icon />
            </NavLink>
          ))}
          {session?.accessToken && (
            <NavLink
              to="/settings?tab=notifications"
              className={iconLinkClassName}
              aria-label={bellAriaLabel}
              title="Notifications"
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
          )}
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
      </nav>
    </header>
  );
}
