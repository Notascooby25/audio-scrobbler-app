import PropTypes from "prop-types";

export default function ReportMilestones({ summary }) {
  const currentStreak = summary?.current_streak_days || 0;
  const periodBestStreak = summary?.period_best_streak_days || 0;
  const peakDay = summary?.peak_day;
  const rotation = summary?.heavy_rotation;
  const persona = summary?.persona || "Discovery Voyager";

  const personaIcons = {
    "Night Owl": "🦉",
    "Weekend Warrior": "⚡",
    "Discovery Voyager": "🧭",
    "Catalog Loyalist": "📚",
    "Deep Diver": "🌊",
  };
  const icon = personaIcons[persona] || "🎵";

  return (
    <section className="report-milestones-section" aria-label="Streaks and Milestones">
      <div className="report-milestones-grid">
        <div className="report-milestone-card milestone-streak">
          <span className="milestone-label">Current Streak</span>
          <strong className="milestone-value">🔥 {currentStreak} Days</strong>
          <span className="milestone-subtext">Best in period: {periodBestStreak} days</span>
        </div>

        <div className="report-milestone-card milestone-peak">
          <span className="milestone-label">Peak Listening Day</span>
          <strong className="milestone-value">
            {peakDay ? `${Number(peakDay.count).toLocaleString()} Scrobbles` : "No activity"}
          </strong>
          <span className="milestone-subtext">{peakDay ? peakDay.date : "None"}</span>
        </div>

        <div className="report-milestone-card milestone-rotation">
          <span className="milestone-label">Heavy Rotation</span>
          <strong
            className="milestone-value milestone-truncate"
            title={rotation ? rotation.track_name : "None"}
          >
            {rotation ? rotation.track_name : "None"}
          </strong>
          <span className="milestone-subtext milestone-truncate">
            {rotation ? `${rotation.artist_name} • ${rotation.count} plays` : "No repeat tracks"}
          </span>
        </div>

        <div className="report-milestone-card milestone-persona">
          <span className="milestone-label">Period Persona</span>
          <strong className="milestone-value">
            {icon} {persona}
          </strong>
          <span className="milestone-subtext">Listening Archetype</span>
        </div>
      </div>
    </section>
  );
}

ReportMilestones.propTypes = {
  summary: PropTypes.shape({
    current_streak_days: PropTypes.number,
    period_best_streak_days: PropTypes.number,
    peak_day: PropTypes.shape({
      date: PropTypes.string,
      count: PropTypes.number,
    }),
    heavy_rotation: PropTypes.shape({
      track_name: PropTypes.string,
      artist_name: PropTypes.string,
      count: PropTypes.number,
    }),
    persona: PropTypes.string,
  }),
};
