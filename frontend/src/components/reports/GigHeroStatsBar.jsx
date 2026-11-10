import { Link } from "react-router-dom";

const KM_TO_MILES = 0.621371;

function getFlightComparison(miles) {
  if (miles >= 24900) return "🌍 Circled the globe (> 24,900 mi)";
  if (miles >= 10500) return "✈️ Equal to London → Sydney";
  if (miles >= 5900) return "✈️ Equal to London → Tokyo";
  if (miles >= 3950) return "✈️ Equal to London → Chicago";
  if (miles >= 3450) return "✈️ Equal to London → New York";
  if (miles >= 1100) return "✈️ Equal to London → Rome";
  if (miles >= 600) return "🚗 Equal to London → Edinburgh";
  if (miles >= 200) return "🚗 London → Manchester trip";
  return "📍 Local gig explorer";
}

export default function GigHeroStatsBar({
  totalGigs = 0,
  totalFestivals = 0,
  yearsActive = 0,
  travelStats = null,
  badgeCount = 0,
  useMiles = true,
}) {
  const km = travelStats?.total_distance_km || 0;
  const miles = Math.round(km * KM_TO_MILES);
  const displayDist = useMiles ? miles : km;
  const unit = useMiles ? "mi" : "km";
  const streak = travelStats?.active_streak_months || 0;

  return (
    <div className="report-facts gig-hero-facts" data-testid="gig-hero-stats">
      <div className="report-fact-card">
        <strong>{totalGigs.toLocaleString()}</strong>
        <span>Gigs logged</span>
        {streak > 0 ? (
          <span className="stat-comparison stat-comparison-positive">
            🔥 {streak}-mo active streak
          </span>
        ) : (
          <span className="stat-comparison stat-comparison-neutral">
            {yearsActive} year{yearsActive === 1 ? "" : "s"} of gigs
          </span>
        )}
      </div>

      <div className="report-fact-card">
        {travelStats?.home_set ? (
          <>
            <strong>
              {displayDist.toLocaleString()}{" "}
              <small
                style={{ fontSize: "16px", fontWeight: "normal", color: "var(--color-muted)" }}
              >
                {unit}
              </small>
            </strong>
            <span>Total travel logged</span>
            <span className="stat-comparison stat-comparison-positive" style={{ fontSize: "11px" }}>
              {getFlightComparison(miles)}
            </span>
          </>
        ) : (
          <>
            <strong style={{ fontSize: "18px" }}>Set home city</strong>
            <span>Total travel logged</span>
            <span className="stat-comparison stat-comparison-neutral" style={{ fontSize: "11px" }}>
              <Link to="/settings">Add in Settings &rarr;</Link>
            </span>
          </>
        )}
      </div>

      <div className="report-fact-card">
        <strong>{totalFestivals.toLocaleString()}</strong>
        <span>Festivals</span>
        <span className="stat-comparison stat-comparison-neutral">
          {totalFestivals >= 3 ? "🎪 Mud Survivor unlocked" : "Multi-day events"}
        </span>
      </div>

      <div className="report-fact-card">
        <strong>{badgeCount}</strong>
        <span>Badges unlocked</span>
        <span className="stat-comparison stat-comparison-positive">🏆 Milestone rewards</span>
      </div>
    </div>
  );
}
