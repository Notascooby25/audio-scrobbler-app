export default function GigDayOfWeekChart({ cadence = [] }) {
  if (!cadence || cadence.length === 0) {
    return null;
  }

  const maxCount = Math.max(...cadence.map((d) => d.count), 1);
  const weekendCount = cadence
    .filter((d) => d.day_index === 4 || d.day_index === 5)
    .reduce((sum, d) => sum + d.count, 0);
  const totalCount = cadence.reduce((sum, d) => sum + d.count, 0);
  const weekendPercent = totalCount > 0 ? Math.round((weekendCount / totalCount) * 100) : 0;

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
        <h2>Gig Rhythm & Cadence</h2>
        <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 700 }}>
          {weekendPercent}% Weekend Shows
        </span>
      </div>
      <p className="chart-caption" style={{ marginBottom: "14px" }}>
        Distribution of attended concerts by day of the week (Friday & Saturday vs. School Nights).
      </p>

      <div
        className="day-cadence-bars"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          height: "90px",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "6px",
        }}
      >
        {cadence.map((d) => {
          const heightPct = Math.max(10, Math.round((d.count / maxCount) * 100));
          const isWeekend = d.day_index === 4 || d.day_index === 5;
          return (
            <div
              key={d.day_name}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "100%",
                justifyContent: "flex-end",
                gap: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--color-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {d.count > 0 ? d.count : ""}
              </span>
              <div
                style={{
                  width: "100%",
                  maxWidth: "28px",
                  height: `${heightPct}%`,
                  background: isWeekend ? "var(--color-primary)" : "var(--tl-tile)",
                  borderRadius: "3px 3px 0 0",
                  transition: "height 0.3s ease",
                }}
                title={`${d.day_name}: ${d.count} gigs (${d.percent}%)`}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: isWeekend ? 700 : 500,
                  color: isWeekend ? "var(--color-ink)" : "var(--color-muted)",
                }}
              >
                {d.day_name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
