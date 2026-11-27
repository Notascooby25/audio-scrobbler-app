import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./wrapped.css";
import { fetchWrapped } from "../../api/wrapped";

const UNLOCK_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/London",
});

// The server sends naive UTC times with no "Z".
function formatUnlock(iso) {
  const stamp = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  return UNLOCK_FORMAT.format(new Date(stamp));
}

// One card per year on the Reports page, newest first. A year that hasn't unlocked yet shows its date.
export default function WrappedYearsCard({ token }) {
  const [years, setYears] = useState([]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    fetchWrapped({ token })
      .then((list) => {
        if (!cancelled) setYears(list.years || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!years.length) return null;

  return (
    <section className="wrapped-years" aria-label="Your years in review">
      <h2>Your year in review</h2>
      <ul className="wrapped-years__list">
        {years.map((entry) => (
          <li key={entry.year} className="wrapped-year-card">
            <h3>{entry.year} Wrapped</h3>
            {entry.status === "locked" ? (
              <p>Unlocks {formatUnlock(entry.unlocks_at)}</p>
            ) : (
              <>
                {entry.top_artist && <p>Top artist: {entry.top_artist}</p>}
                {entry.is_sample && <p>Sample: only you can see this</p>}
                {entry.updated && <p>Updated with the full year</p>}
                <Link to={`/wrapped/${entry.year}`}>Play story</Link>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
