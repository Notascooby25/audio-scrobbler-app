export default function VenueRoyaltyList({ venues = [] }) {
  if (!venues || venues.length === 0) {
    return (
      <div className="chart-panel">
        <div className="panel-header">
          <h2>Venue Stomping Grounds</h2>
        </div>
        <p className="notice" style={{ marginTop: "10px" }}>
          Log more gigs to see your most frequented rooms and halls.
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
        <h2>Venue Stomping Grounds</h2>
        <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>Most visited rooms</span>
      </div>
      <p className="chart-caption" style={{ marginBottom: "14px" }}>
        The venues, halls, and festival grounds you return to the most often.
      </p>

      <ol className="ranked-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {venues.map((v, idx) => (
          <li
            key={`${v.venue_name}-${v.city}`}
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
                {idx + 1}
              </span>
              <div>
                <strong style={{ color: "var(--color-ink)", fontSize: "14px" }}>
                  {v.venue_name}
                </strong>
                <small style={{ display: "block", color: "var(--color-muted)", fontSize: "11px" }}>
                  {v.city}, {v.country} · {v.distinct_artists} distinct artist
                  {v.distinct_artists === 1 ? "" : "s"}
                  {v.festivals > 0
                    ? ` · ${v.festivals} festival${v.festivals === 1 ? "" : "s"}`
                    : ""}
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
              {v.gig_count} gig{v.gig_count === 1 ? "" : "s"}
            </strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
