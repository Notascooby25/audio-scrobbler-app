export default function GigBadgesCatalog({ badges = [] }) {
  if (!badges || badges.length === 0) {
    return <p className="sfm-empty">No milestone badges available.</p>;
  }

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="gig-badges-catalog">
      <div
        className="panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "12px",
        }}
      >
        <h2>Live Music Milestones & Badges</h2>
        <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 700 }}>
          {unlockedCount} / {badges.length} Unlocked
        </span>
      </div>
      <p className="chart-caption" style={{ marginBottom: "16px" }}>
        Achievements unlocked from your real concert attendance history and listening crossover.
      </p>

      <div
        className="badge-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "10px",
        }}
      >
        {badges.map((badge) => {
          const isUnlocked = badge.unlocked;
          return (
            <div
              key={badge.id}
              className={`badge-item ${isUnlocked ? "badge-unlocked" : "badge-locked"}`}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderColor: isUnlocked ? "var(--color-primary)" : "var(--color-border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "4px",
                opacity: isUnlocked ? 1 : 0.65,
              }}
            >
              <span
                className="badge-icon"
                style={{ fontSize: "24px" }}
                role="img"
                aria-label={badge.name}
              >
                {badge.emoji}
              </span>
              <strong
                className="badge-name"
                style={{ fontSize: "12px", color: "var(--color-ink)" }}
              >
                {badge.name}
              </strong>
              <small
                className="badge-desc"
                style={{ fontSize: "10px", color: "var(--color-muted)", lineHeight: 1.25 }}
              >
                {badge.description}
              </small>

              <span
                className="badge-status-pill"
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  marginTop: "4px",
                  background: isUnlocked ? "rgba(34, 197, 94, 0.15)" : "var(--tl-tile)",
                  color: isUnlocked ? "#15803d" : "var(--color-muted)",
                }}
              >
                {isUnlocked ? "Unlocked" : `${badge.progress} / ${badge.target}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
