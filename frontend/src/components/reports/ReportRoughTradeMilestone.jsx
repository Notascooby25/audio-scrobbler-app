import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import InfoHint from "../InfoHint";
import ReportViewAll from "./ReportViewAll";

const ROUGH_TRADE_TOTAL = 700;

export default function ReportRoughTradeMilestone({ challengeRoughTrade }) {
  const completedInPeriod = challengeRoughTrade?.completed_in_period || 0;
  const totalCompleted = challengeRoughTrade?.total_completed || 0;
  const recentAlbums = challengeRoughTrade?.recent_albums || [];
  const allAlbums = challengeRoughTrade?.all_albums?.length
    ? challengeRoughTrade.all_albums
    : recentAlbums;
  const pct = ((totalCompleted / ROUGH_TRADE_TOTAL) * 100).toFixed(1);

  return (
    <div
      className="report-crossover-card crossover-rough-trade"
      aria-label="Rough Trade Top 100 Milestone"
    >
      <div className="crossover-header">
        <span className="crossover-badge badge-rough-trade">Rough Trade Top 100</span>
        <span className="crossover-meta">
          {totalCompleted} / {ROUGH_TRADE_TOTAL} ({pct}%)
        </span>
      </div>
      <div className="crossover-title">
        {completedInPeriod} Completed This Period
        <InfoHint hintId="milestones.rough-trade" label="Rough Trade Top 100" />
      </div>
      <p className="crossover-desc">
        {completedInPeriod > 0
          ? `${completedInPeriod} albums from Rough Trade's Albums of the Year lists (2020 to 2026) tackled:`
          : "Work through Rough Trade's Albums of the Year lists (2020 to 2026) to see your progress here:"}
      </p>
      <div className="crossover-chips">
        {recentAlbums.length > 0 ? (
          recentAlbums.map((album, idx) => (
            <Link
              key={idx}
              to="/jukebox"
              className="crossover-chip chip-rough-trade"
              title="View the Rough Trade Top 100 in the jukebox"
            >
              🎸 {album}
            </Link>
          ))
        ) : (
          <Link to="/jukebox" className="crossover-chip chip-rough-trade">
            Browse in Jukebox →
          </Link>
        )}
      </div>
      <ReportViewAll title="Rough Trade Top 100 completed this period" items={allAlbums} />
    </div>
  );
}

ReportRoughTradeMilestone.propTypes = {
  challengeRoughTrade: PropTypes.shape({
    completed_in_period: PropTypes.number,
    total_completed: PropTypes.number,
    recent_albums: PropTypes.arrayOf(PropTypes.string),
    all_albums: PropTypes.arrayOf(PropTypes.string),
  }),
};
