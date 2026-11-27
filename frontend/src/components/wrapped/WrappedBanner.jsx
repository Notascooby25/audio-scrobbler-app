import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./wrapped.css";
import { dismissWrapped, fetchWrapped } from "../../api/wrapped";
import { readSession } from "../../session";

// A bar at the top of every page when a year's Wrapped is ready and hasn't been opened or dismissed yet.
export default function WrappedBanner() {
  const token = readSession()?.accessToken;
  const location = useLocation();
  const [year, setYear] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    fetchWrapped({ token })
      .then((list) => {
        if (!cancelled) setYear(list.banner?.year ?? null);
      })
      .catch(() => {});
    const hide = () => setYear(null);
    window.addEventListener("wrapped_seen", hide);
    return () => {
      cancelled = true;
      window.removeEventListener("wrapped_seen", hide);
    };
  }, [token]);

  if (!token || !year || location.pathname.startsWith("/wrapped/")) return null;

  function dismiss() {
    setYear(null);
    dismissWrapped({ token, year }).catch(() => {});
  }

  return (
    <div className="wrapped-banner" role="region" aria-label="Your year in review">
      <div>
        <strong>Your {year} Wrapped is ready</strong>
        <span>A year of music and gigs, all in one place.</span>
      </div>
      <div className="wrapped-banner__actions">
        <Link className="wrapped-banner__primary" to={`/wrapped/${year}`}>
          Play my year
        </Link>
        <button type="button" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
