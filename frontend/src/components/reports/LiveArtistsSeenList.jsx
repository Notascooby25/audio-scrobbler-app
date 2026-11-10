import { useState } from "react";

const INITIAL_LIMIT = 5;

export default function LiveArtistsSeenList({ artists = [] }) {
  const [showAll, setShowAll] = useState(false);

  if (!artists || artists.length === 0) {
    return (
      <div className="chart-panel">
        <div className="panel-header">
          <h2>Live Artist Rankings</h2>
        </div>
        <p className="notice" style={{ marginTop: "10px" }}>
          Log more gigs to rank the artists you&apos;ve experienced the most in person.
        </p>
      </div>
    );
  }

  const displayedArtists = showAll ? artists : artists.slice(0, INITIAL_LIMIT);
  const maxShows = Math.max(...artists.map((a) => a.count || 0), 1);
  const totalShowsLogged = artists.reduce((sum, a) => sum + (a.count || 0), 0);

  return (
    <div className="chart-panel">
      <div
        className="panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "8px",
        }}
      >
        <h2>Live Artist Rankings</h2>
        <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>
          {artists.length} artists seen live
        </span>
      </div>
      <p className="chart-caption" style={{ marginBottom: "14px" }}>
        The musical acts you return to see the most often in concert.
      </p>

      <ol className="ranked-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {displayedArtists.map((artist, idx) => {
          const share = totalShowsLogged ? Math.round((artist.count / totalShowsLogged) * 100) : 0;
          const relativePct = Math.round((artist.count / maxShows) * 100);

          return (
            <li
              key={artist.artist_name}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "8px 0",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    className="rank-number"
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--color-muted)",
                      width: "22px",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <strong style={{ color: "var(--color-ink)", fontSize: "14px" }}>
                      {artist.artist_name}
                    </strong>
                    <small
                      style={{
                        display: "block",
                        color: "var(--color-muted)",
                        fontSize: "11px",
                      }}
                    >
                      {artist.count} show{artist.count === 1 ? "" : "s"}
                      {share > 0 ? ` · ${share}% of all live sets` : ""}
                    </small>
                  </div>
                </div>
                <strong
                  style={{
                    fontSize: "13px",
                    color: "var(--color-ink)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {artist.count} gig{artist.count === 1 ? "" : "s"}
                </strong>
              </div>

              {/* Relative volume bar */}
              <div
                style={{
                  height: "4px",
                  background: "var(--color-surface-subtle, rgba(0, 0, 0, 0.05))",
                  borderRadius: "2px",
                  overflow: "hidden",
                  marginLeft: "32px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${relativePct}%`,
                    background: "var(--color-primary)",
                    borderRadius: "2px",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {artists.length > INITIAL_LIMIT && (
        <div style={{ marginTop: "12px", textAlign: "center" }}>
          <button
            type="button"
            className="sfm-link"
            style={{
              fontSize: "12px",
              padding: "6px 14px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              cursor: "pointer",
              textTransform: "none",
            }}
            onClick={() => setShowAll((prev) => !prev)}
          >
            {showAll ? "Show top 5 only" : `Show all ${artists.length} artists`}
          </button>
        </div>
      )}
    </div>
  );
}
