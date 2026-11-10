export default function LiveFirstDiscoveries({ discoveries = [] }) {
  if (!discoveries || discoveries.length === 0) {
    return (
      <div className="chart-panel">
        <div className="panel-header">
          <h2>Live First Discoveries</h2>
        </div>
        <p className="notice" style={{ marginTop: "10px" }}>
          No live-first discoveries found yet. As you log gigs seen before scrobbling began, they
          will appear here.
        </p>
      </div>
    );
  }

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
        <h2>Live First: Discovered in Person</h2>
        <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 700 }}>
          {discoveries.length} Artist{discoveries.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="chart-caption" style={{ marginBottom: "14px" }}>
        Bands you experienced on stage before your very first recorded scrobble in the app.
      </p>

      <ol className="ranked-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {discoveries.map((item, index) => (
          <li
            key={item.artist_name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid var(--color-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                className="rank-number"
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--color-muted)",
                  width: "20px",
                }}
              >
                {index + 1}
              </span>
              <div>
                <strong style={{ color: "var(--color-ink)", fontSize: "14px" }}>
                  {item.artist_name}
                </strong>
                <small style={{ display: "block", color: "var(--color-muted)", fontSize: "11px" }}>
                  Seen {item.gig_date} at {item.venue_name} &middot; First scrobbled{" "}
                  {item.first_scrobble_date}
                </small>
              </div>
            </div>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-primary)" }}>
              {item.lifetime_plays.toLocaleString()} plays
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
