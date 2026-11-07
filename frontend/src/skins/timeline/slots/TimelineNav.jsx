import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { readSession } from "../../../session";
import { fetchUnreadNotificationCount } from "../../../api";

const TABS = [
  {
    id: "today",
    label: "Today",
    to: "/",
    iconD: "M3 12h4l3-8 4 16 3-8h4",
    isActive: (p) => p === "/",
  },
  {
    id: "library",
    label: "Library",
    to: "/library",
    iconD: "M4 19V5M9 19V5M14 19V8l6 11",
    isActive: (p) => p === "/library" || p.startsWith("/library/"),
  },
  {
    id: "play",
    label: "Play",
    to: "/play",
    iconD: "M6 4l14 8-14 8z",
    isActive: (p) => p === "/play" || p === "/overview",
  },
  {
    id: "reports",
    label: "Reports",
    to: "/reports",
    iconD: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    isActive: (p) => p === "/reports" || p.startsWith("/reports/"),
  },
  {
    id: "gigs",
    label: "Gigs",
    to: "/gigs",
    iconD: "M3 9a3 3 0 0 0 0 6v3h18v-3a3 3 0 0 1 0-6V6H3z",
    isActive: (p) => p === "/gigs" || p === "/setlists",
  },
];

function getSubpageInfo(pathname) {
  if (pathname.startsWith("/gigs/") && pathname !== "/gigs") {
    return { label: "Back to Gigs", to: "/gigs" };
  }
  if (pathname === "/settings") {
    return { label: "Back to Profile", to: "/profile" };
  }
  if (pathname === "/following") {
    return { label: "Back to Profile", to: "/profile" };
  }
  if (pathname === "/connect") {
    return { label: "Back to Profile", to: "/profile" };
  }
  if (pathname === "/changelog") {
    return { label: "Back to Profile", to: "/profile" };
  }
  if (pathname.startsWith("/profile/") && pathname !== "/profile") {
    return { label: "Back to Friends", to: "/following" };
  }
  return null;
}

export default function TimelineNav() {
  const { pathname } = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const session = readSession();

  useEffect(() => {
    if (!session?.accessToken) return;

    const fetchCount = () => {
      fetchUnreadNotificationCount({ token: session.accessToken })
        .then((data) => setUnreadCount(data.count))
        .catch(() => {});
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60 * 1000);
    const handleRead = () => setUnreadCount(0);
    window.addEventListener("notifications_read", handleRead);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications_read", handleRead);
    };
  }, [session?.accessToken]);

  const subpageInfo = getSubpageInfo(pathname);

  const bellAriaLabel =
    unreadCount > 0
      ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
      : "Notifications";

  const avatarInitial = session?.username ? session.username.charAt(0).toUpperCase() : null;

  return (
    <>
      {subpageInfo ? (
        <header className="timeline-subpage-header">
          <Link to={subpageInfo.to} className="timeline-back-button" aria-label={subpageInfo.label}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>{subpageInfo.label}</span>
          </Link>
        </header>
      ) : (
        <header className="timeline-header">
          <NavLink to="/" className="timeline-header-wordmark">
            Scrobbler
          </NavLink>
          <div className="timeline-header-actions">
            {session?.accessToken && (
              <NavLink
                to="/settings?tab=notifications"
                className="timeline-header-bell"
                aria-label={bellAriaLabel}
                title="Notifications"
              >
                <svg
                  width="20"
                  height="20"
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
                {unreadCount > 0 && <span className="timeline-unread-badge" aria-hidden="true" />}
              </NavLink>
            )}

            <NavLink
              to="/profile"
              className="timeline-header-avatar"
              aria-label={session?.username ? `Profile (${session.username})` : "Profile"}
              title="Profile"
            >
              <span className="timeline-avatar-disc">
                {avatarInitial ? (
                  <span className="timeline-avatar-initial" aria-hidden="true">
                    {avatarInitial}
                  </span>
                ) : (
                  <svg
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
                )}
              </span>
            </NavLink>
          </div>
        </header>
      )}

      {/* Bottom Tab Bar */}
      <nav className="timeline-nav-bottom" aria-label="Timeline navigation">
        <div className="timeline-nav-bottom-inner">
          {TABS.map((tab) => {
            const active = !subpageInfo && tab.isActive(pathname);
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={`timeline-tab ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <svg
                  className="timeline-tab-icon"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? "2.5" : "2"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={tab.iconD} />
                </svg>
                <span className="timeline-tab-label">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
