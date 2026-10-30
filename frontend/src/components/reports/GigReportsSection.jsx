import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchFurthestGigs,
  fetchGigBump,
  fetchGigsByPeriod,
  fetchLiveGap,
} from "../../api/setlists";
import BarTrendChart from "../charts/BarTrendChart";

const YEARS_SHOWN = 5;
const LIVE_GAP_SHOWN = 5;

function monthLabel(period) {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1).toLocaleString("en-GB", { month: "short", year: "2-digit" });
}

function formatChange(percent) {
  if (percent === null || percent === undefined) return "Not enough data yet";
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

/** Every calendar year from the first gig up to this year, with zero for years without gigs. */
function yearsSinceFirstGig(byYear) {
  const currentYear = new Date().getFullYear();
  const counts = new Map(byYear.map((year) => [Number(year.period), year]));
  const firstYear = byYear.length ? Number(byYear[0].period) : currentYear;
  const years = [];
  for (let year = Math.min(firstYear, currentYear); year <= currentYear; year += 1) {
    const found = counts.get(year);
    years.push({
      period: String(year),
      gigs: found?.gigs ?? 0,
      festivals: found?.festivals ?? 0,
    });
  }
  return years;
}

/** Gig stats for the Gigs tab on Reports. All-time, so the listening date range does not apply. */
export default function GigReportsSection({ token, userId }) {
  const [periods, setPeriods] = useState(null);
  const [liveGap, setLiveGap] = useState([]);
  const [bump, setBump] = useState(null);
  const [furthest, setFurthest] = useState(null);
  const [showAllYears, setShowAllYears] = useState(false);
  const [showAllLiveGap, setShowAllLiveGap] = useState(false);
  const [error, setError] = useState("");
  const isOwnReport = !userId;

  useEffect(() => {
    if (!token) return;
    setError("");
    Promise.all([
      fetchGigsByPeriod({ token, userId }),
      fetchLiveGap({ token, userId }),
      fetchGigBump({ token, userId }),
    ])
      .then(([byPeriod, gap, gigBump]) => {
        setPeriods(byPeriod);
        setLiveGap(gap);
        setBump(gigBump);
      })
      .catch((err) => setError(err.message || "Couldn't load gig reports."));
  }, [token, userId]);

  useEffect(() => {
    if (!token || !isOwnReport) return;
    fetchFurthestGigs({ token })
      .then(setFurthest)
      .catch(() => setFurthest(null));
  }, [token, isOwnReport]);

  if (error)
    return (
      <p className="notice notice-error" role="alert">
        {error}
      </p>
    );
  if (!periods)
    return (
      <p className="notice" role="status">
        Loading gig reports...
      </p>
    );
  if (periods.by_month.length === 0) {
    return <p className="notice">Log some gigs to see your gig reports.</p>;
  }

  const totalGigs = periods.by_year.reduce((sum, year) => sum + year.gigs, 0);
  const totalFestivals = periods.by_year.reduce((sum, year) => sum + year.festivals, 0);
  const years = yearsSinceFirstGig(periods.by_year);
  const shownYears = showAllYears ? years : years.slice(-YEARS_SHOWN);
  const shownLiveGap = showAllLiveGap ? liveGap : liveGap.slice(0, LIVE_GAP_SHOWN);

  return (
    <div className="gig-reports">
      <div className="report-facts">
        <div className="report-fact-card">
          <strong>{totalGigs.toLocaleString()}</strong>
          <span>Gigs logged</span>
        </div>
        <div className="report-fact-card">
          <strong>{totalFestivals.toLocaleString()}</strong>
          <span>Festivals</span>
        </div>
        <div className="report-fact-card">
          <strong>{periods.by_year.length}</strong>
          <span>Years of gigs</span>
        </div>
      </div>

      <div className="report-data-grid">
        <BarTrendChart
          title="Gigs per month"
          unit="gigs"
          points={periods.by_month.map((month) => ({
            label: monthLabel(month.period),
            count: month.gigs,
          }))}
        />
      </div>

      <div className="report-category-grid">
        <div className="chart-panel">
          <h2>Gigs per year</h2>
          <ol className="ranked-list">
            {shownYears.map((year) => (
              <li key={year.period}>
                <span className="rank-copy">
                  <strong>{year.period}</strong>
                  <small>
                    {year.festivals} festival{year.festivals === 1 ? "" : "s"}
                  </small>
                </span>
                <span className="rank-count">{year.gigs.toLocaleString()}</span>
              </li>
            ))}
          </ol>
          {years.length > YEARS_SHOWN && (
            <button
              type="button"
              className="sfm-link"
              onClick={() => setShowAllYears((prev) => !prev)}
            >
              {showAllYears ? "Show last 5 years" : `Show all ${years.length} years`}
            </button>
          )}
        </div>

        <div className="chart-panel">
          <h2>Live gap</h2>
          <p className="chart-caption">
            Artists you play a lot on Spotify but have never seen live.
          </p>
          {liveGap.length === 0 ? (
            <p className="notice">You have seen every artist in your top listening live.</p>
          ) : (
            <>
              <ol className="ranked-list">
                {shownLiveGap.map((artist, index) => (
                  <li key={artist.artist_name}>
                    <span className="rank-number">{index + 1}</span>
                    <span className="rank-copy">
                      <strong>{artist.artist_name}</strong>
                    </span>
                    <span className="rank-count">{artist.plays.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
              {liveGap.length > LIVE_GAP_SHOWN && (
                <button
                  type="button"
                  className="sfm-link"
                  onClick={() => setShowAllLiveGap((prev) => !prev)}
                >
                  {showAllLiveGap ? "Show top 5" : `Show more (${liveGap.length})`}
                </button>
              )}
            </>
          )}
        </div>

        {isOwnReport && furthest && (
          <div className="chart-panel">
            <h2>Furthest gigs</h2>
            {!furthest.home_set ? (
              <p className="notice">
                Add your home city in <Link to="/settings">Settings</Link> to see how far you&apos;ve
                travelled to gigs.
              </p>
            ) : (
              <>
                <p className="chart-caption">
                  Headline gigs furthest from your home city, as the crow flies.
                </p>
                {furthest.furthest.length === 0 ? (
                  <p className="notice">No gigs located yet.</p>
                ) : (
                  <ol className="ranked-list">
                    {furthest.furthest.map((gig, index) => (
                      <li key={gig.id}>
                        <span className="rank-number">{index + 1}</span>
                        <span className="rank-copy">
                          <strong>{gig.artist_name}</strong>
                          <small>
                            {gig.venue_name}, {gig.city} · {gig.date}
                          </small>
                        </span>
                        <span className="rank-count">{gig.distance_km.toLocaleString()} km</span>
                      </li>
                    ))}
                  </ol>
                )}
                {furthest.pending_gigs > 0 && (
                  <p className="chart-caption">
                    {furthest.pending_gigs} gig{furthest.pending_gigs === 1 ? " is" : "s are"} still
                    being located. Refresh the page to update.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {bump && (
        <div className="chart-panel">
          <h2>Gig bump</h2>
          <p className="chart-caption">
            Average Spotify plays in the {bump.window_days} days before and after each of your{" "}
            {bump.gigs_analysed} past headline gigs. Gigs too recent for a full after-window are
            left out.
          </p>
          <div className="report-facts">
            <div className="report-fact-card">
              <strong>{bump.average_plays_before}</strong>
              <span>Plays before a gig</span>
            </div>
            <div className="report-fact-card">
              <strong>{bump.average_plays_after}</strong>
              <span>Plays after a gig</span>
            </div>
            <div className="report-fact-card">
              <strong>{formatChange(bump.change_percent)}</strong>
              <span>Change after a gig</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
