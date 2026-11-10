import { useState } from "react";

const INITIAL_LIMIT = 10;

export default function SetlistReplayHighlights({ songs = [] }) {
  const [showAll, setShowAll] = useState(false);

  if (!songs || songs.length === 0) {
    return (
      <div className="chart-panel">
        <div className="panel-header">
          <h2>Setlist Replay Tracker</h2>
        </div>
        <p className="notice" style={{ marginTop: "10px" }}>
          Log concerts with setlists to see your most-heard live songs and your scrobbles for them.
        </p>
      </div>
    );
  }

  const displayedSongs = showAll ? songs : songs.slice(0, INITIAL_LIMIT);
  const maxLiveTimes = Math.max(...songs.map((s) => s.count || 0), 1);

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
        <h2>Setlist Replay Tracker</h2>
        <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>
          {songs.length} songs heard live
        </span>
      </div>
      <p className="chart-caption" style={{ marginBottom: "14px" }}>
        Songs you&apos;ve experienced performed live in concert across attended setlists.
      </p>

      <ol className="ranked-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {displayedSongs.map((song, idx) => {
          const relativePct = Math.round((song.count / maxLiveTimes) * 100);

          return (
            <li
              key={`${song.artist_name}-${song.track_name || song.song_name}-${idx}`}
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
                      {song.track_name || song.song_name}
                    </strong>
                    <small
                      style={{
                        display: "block",
                        color: "var(--color-muted)",
                        fontSize: "11px",
                      }}
                    >
                      {song.artist_name}
                    </small>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "var(--color-ink)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {song.count} live play{song.count === 1 ? "" : "s"}
                  </strong>
                </div>
              </div>

              {/* Relative bar */}
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

      {songs.length > INITIAL_LIMIT && (
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
            {showAll ? "Show top 10 only" : `Show all ${songs.length} tracks`}
          </button>
        </div>
      )}
    </div>
  );
}
