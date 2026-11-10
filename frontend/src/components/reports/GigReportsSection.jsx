import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchArtistsSeenLeaderboard,
  fetchFurthestGigs,
  fetchGigBadges,
  fetchGigBump,
  fetchGigCadenceMatrix,
  fetchGigDayOfWeek,
  fetchGigMapPins,
  fetchGigsByPeriod,
  fetchGigSurgeLeaderboard,
  fetchGigTravelAndVenues,
  fetchLiveGap,
  fetchSongsHeardLeaderboard,
} from "../../api/setlists";
import BarTrendChart from "../charts/BarTrendChart";
import FurthestVenues from "./FurthestVenues";
import GigBadgesCatalog from "./GigBadgesCatalog";
import GigCadenceHeatmap from "./GigCadenceHeatmap";
import GigDayOfWeekChart from "./GigDayOfWeekChart";
import GigHeroStatsBar from "./GigHeroStatsBar";
import GigOdysseyMap from "./GigOdysseyMap";
import LiveArtistsSeenList from "./LiveArtistsSeenList";
import SetlistReplayHighlights from "./SetlistReplayHighlights";
import VenueRoyaltyList from "./VenueRoyaltyList";

const YEARS_SHOWN = 5;
const LIVE_GAP_SHOWN = 5;
const WIDGET_STORAGE_KEY = "audio_scrobbler_gig_report_widgets";

const DEFAULT_WIDGETS = {
  map: true,
  badges: true,
  artists: true,
  cadenceGrid: true,
  venues: true,
  bump: true,
  replays: true,
  cadence: true,
  furthest: true,
  periods: true,
  liveGap: true,
};

function monthLabel(period) {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1).toLocaleString("en-GB", { month: "short", year: "2-digit" });
}

function formatChange(percent) {
  if (percent === null || percent === undefined) return "Not enough data yet";
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

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

export default function GigReportsSection({ token, userId }) {
  const [periods, setPeriods] = useState(null);
  const [liveGap, setLiveGap] = useState([]);
  const [bump, setBump] = useState(null);
  const [furthest, setFurthest] = useState(null);
  const [travelStats, setTravelStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [liveArtists, setLiveArtists] = useState([]);
  const [cadenceMatrix, setCadenceMatrix] = useState(null);
  const [setlistSongs, setSetlistSongs] = useState([]);
  const [surge, setSurge] = useState([]);
  const [cadence, setCadence] = useState([]);
  const [mapPins, setMapPins] = useState([]);

  const [activeTab, setActiveTab] = useState("all");
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem(WIDGET_STORAGE_KEY);
      return saved ? { ...DEFAULT_WIDGETS, ...JSON.parse(saved) } : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  const [showAllYears, setShowAllYears] = useState(false);
  const [showAllLiveGap, setShowAllLiveGap] = useState(false);
  const [error, setError] = useState("");
  const isOwnReport = !userId;

  const toggleWidget = (key) => {
    setWidgets((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

  useEffect(() => {
    if (!token) return;
    setError("");

    Promise.all([
      fetchGigsByPeriod({ token, userId }),
      fetchLiveGap({ token, userId }),
      fetchGigBump({ token, userId }),
      fetchGigTravelAndVenues({ token, userId }),
      fetchGigBadges({ token, userId }),
      fetchArtistsSeenLeaderboard({ token, userId }),
      fetchGigCadenceMatrix({ token, userId }),
      fetchSongsHeardLeaderboard({ token, limit: 100, userId }),
      fetchGigSurgeLeaderboard({ token, userId }),
      fetchGigDayOfWeek({ token, userId }),
      fetchGigMapPins({ token, userId }),
    ])
      .then(
        ([
          byPeriod,
          gap,
          gigBump,
          travel,
          badgeList,
          artistsList,
          cadenceMat,
          songsList,
          surgeList,
          dayCadence,
          pins,
        ]) => {
          setPeriods(byPeriod);
          setLiveGap(gap);
          setBump(gigBump);
          setTravelStats(travel);
          setBadges(badgeList);
          setLiveArtists(artistsList || []);
          setCadenceMatrix(cadenceMat || null);
          setSetlistSongs(songsList || []);
          setSurge(surgeList || []);
          setCadence(dayCadence || []);
          setMapPins(pins || []);
        }
      )
      .catch((err) => setError(err.message || "Couldn't load gig reports."));
  }, [token, userId]);

  useEffect(() => {
    if (!token || !isOwnReport) return;
    fetchFurthestGigs({ token })
      .then(setFurthest)
      .catch(() => setFurthest(null));
  }, [token, isOwnReport]);

  if (error) {
    return (
      <p className="notice notice-error" role="alert">
        {error}
      </p>
    );
  }
  if (!periods) {
    return (
      <p className="notice" role="status">
        Loading gig reports...
      </p>
    );
  }
  if (periods.by_month.length === 0) {
    return <p className="notice">Log some gigs to see your gig reports.</p>;
  }

  const totalGigs = periods.by_year.reduce((sum, year) => sum + year.gigs, 0);
  const totalFestivals = periods.by_year.reduce((sum, year) => sum + year.festivals, 0);
  const years = yearsSinceFirstGig(periods.by_year);
  const shownYears = showAllYears ? years : years.slice(-YEARS_SHOWN);
  const shownLiveGap = showAllLiveGap ? liveGap : liveGap.slice(0, LIVE_GAP_SHOWN);
  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="gig-reports">
      {/* 1. Core Hero Metrics Bar */}
      <GigHeroStatsBar
        totalGigs={totalGigs}
        totalFestivals={totalFestivals}
        yearsActive={periods.by_year.length}
        travelStats={travelStats}
        badgeCount={unlockedBadgesCount}
      />

      {/* 2. Sub-Tabs & Customizer Bar */}
      <div
        className="gig-reports-toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "20px",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "10px",
        }}
      >
        <div className="sfm-filter" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Intelligence" },
            { id: "travel", label: "📍 Travel & Map" },
            { id: "badges", label: "🏆 Badges & Streaks" },
            { id: "discovery", label: "⚡ Discoveries & Bump" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`sfm-link ${activeTab === tab.id ? "is-current" : ""}`}
              style={{
                padding: "4px 12px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--color-border)",
                background: activeTab === tab.id ? "var(--color-primary)" : "var(--color-surface)",
                color: activeTab === tab.id ? "#ffffff" : "var(--color-ink)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
                textTransform: "none",
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="sfm-link"
          style={{
            fontSize: "12px",
            border: "1px dashed var(--color-border)",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            background: "transparent",
            textTransform: "none",
          }}
          onClick={() => setShowCustomizer((prev) => !prev)}
        >
          ⚙️ Customise widgets {showCustomizer ? "▴" : "▾"}
        </button>
      </div>

      {/* 3. Customizer Dropdown Panel */}
      {showCustomizer && (
        <div
          className="widget-customizer-panel"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px",
          }}
        >
          <div
            style={{
              gridColumn: "1 / -1",
              fontWeight: 700,
              fontSize: "12px",
              color: "var(--color-muted)",
              textTransform: "uppercase",
            }}
          >
            Toggle modules on your Gigs report:
          </div>
          {[
            { id: "map", label: "🗺️ Gig Odyssey Map" },
            { id: "artists", label: "👑 Live Artist Rankings" },
            { id: "cadenceGrid", label: "📅 Annual Gig Cadence" },
            { id: "venues", label: "🏛️ Venue Stomping Grounds" },
            { id: "badges", label: "🏆 Badges & Streaks" },
            { id: "bump", label: "📈 Post-Gig Surge" },
            { id: "replays", label: "🔁 Setlist Replay Tracker" },
            { id: "cadence", label: "📊 Day of Week Rhythm" },
            { id: "furthest", label: "📍 Furthest Gigs" },
            { id: "periods", label: "📈 Gigs by Month & Year" },
            { id: "liveGap", label: "🎧 Live Gap" },
          ].map((item) => (
            <label
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={widgets[item.id] ?? true}
                onChange={() => toggleWidget(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* 4. Modular Dashboard Content */}
      <div
        className="report-data-grid"
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        {/* TRAVEL & MAP SECTION */}
        {(activeTab === "all" || activeTab === "travel") && (
          <>
            {widgets.map && travelStats?.home_set && (
              <GigOdysseyMap homeSet={travelStats.home_set} pins={mapPins} />
            )}

            {widgets.venues && travelStats?.venue_royalty?.length > 0 && (
              <VenueRoyaltyList venues={travelStats.venue_royalty} />
            )}

            {widgets.furthest && isOwnReport && furthest && (
              <div className="chart-panel">
                <div
                  className="panel-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <h2>Furthest gigs</h2>
                  <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>
                    As the crow flies
                  </span>
                </div>
                {!furthest.home_set ? (
                  <p className="notice">
                    Add your home city in <Link to="/settings">Settings</Link> to see how far
                    you&apos;ve travelled to gigs.
                  </p>
                ) : (
                  <>
                    <p className="chart-caption">Headline gigs furthest from your home city.</p>
                    {furthest.furthest.length === 0 ? (
                      <p className="notice">No gigs located yet.</p>
                    ) : (
                      <FurthestVenues venues={furthest.furthest} />
                    )}
                    {furthest.pending_gigs > 0 && (
                      <p className="chart-caption" style={{ marginTop: "10px" }}>
                        {furthest.pending_gigs} gig{furthest.pending_gigs === 1 ? " is" : "s are"}{" "}
                        still being located. Refresh the page to update.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* BADGES & ACHIEVEMENTS SECTION */}
        {(activeTab === "all" || activeTab === "badges") && (
          <>
            {widgets.badges && badges.length > 0 && (
              <div className="chart-panel">
                <GigBadgesCatalog badges={badges} />
              </div>
            )}

            {widgets.cadence && cadence.length > 0 && <GigDayOfWeekChart cadence={cadence} />}
          </>
        )}

        {/* ARTISTS & LIVE ARCHIVE SECTION */}
        {(activeTab === "all" || activeTab === "discovery") && (
          <>
            {/* Side-by-side compact card grid for Live Artists and Setlist Replays */}
            {((widgets.artists && liveArtists.length > 0) ||
              (widgets.replays && setlistSongs.length > 0)) && (
              <div
                className="live-highlights-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "1rem",
                  alignItems: "start",
                }}
              >
                {widgets.artists && liveArtists.length > 0 && (
                  <LiveArtistsSeenList artists={liveArtists} />
                )}
                {widgets.replays && setlistSongs.length > 0 && (
                  <SetlistReplayHighlights songs={setlistSongs} />
                )}
              </div>
            )}

            {widgets.cadenceGrid && cadenceMatrix && <GigCadenceHeatmap matrix={cadenceMatrix} />}
          </>
        )}

        {/* POST-GIG SURGE SECTION */}
        {(activeTab === "all" || activeTab === "discovery") && (
          <>
            {widgets.bump && (
              <div className="chart-panel">
                <div
                  className="panel-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <h2>Post-Gig Listening Surge</h2>
                  {bump && (
                    <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 700 }}>
                      {formatChange(bump.change_percent)} Surge
                    </span>
                  )}
                </div>
                <p className="chart-caption">
                  Average plays in the 14 days before and after past gigs.
                </p>

                {bump && (
                  <div className="report-facts" style={{ marginBottom: "16px" }}>
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
                )}

                {surge.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                      Top Artist Surges:
                    </h3>
                    <ol
                      className="ranked-list"
                      style={{ listStyle: "none", padding: 0, margin: 0 }}
                    >
                      {surge.map((s, idx) => (
                        <li
                          key={s.artist_name}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "8px 0",
                            borderBottom: "1px solid var(--color-border-subtle)",
                          }}
                        >
                          <div>
                            <strong>
                              {idx + 1}. {s.artist_name}
                            </strong>
                            <small
                              style={{
                                display: "block",
                                color: "var(--color-muted)",
                                fontSize: "11px",
                              }}
                            >
                              Seen {s.gig_date} at {s.venue_name} · {s.plays_before} →{" "}
                              {s.plays_after} plays
                            </small>
                          </div>
                          <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "13px" }}>
                            +{s.change_percent}%
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {widgets.liveGap && (
              <div className="chart-panel">
                <div
                  className="panel-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <h2>Live gap</h2>
                  <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>
                    Spotify vs Gigs
                  </span>
                </div>
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
                          <span className="rank-count">{artist.plays.toLocaleString()} plays</span>
                        </li>
                      ))}
                    </ol>
                    {liveGap.length > LIVE_GAP_SHOWN && (
                      <button
                        type="button"
                        className="sfm-link"
                        onClick={() => setShowAllLiveGap((prev) => !prev)}
                        style={{
                          marginTop: "10px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {showAllLiveGap ? "Show top 5" : `Show more (${liveGap.length})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* PERIODS / HISTORICAL CADENCE SECTION */}
        {(activeTab === "all" || activeTab === "travel") && widgets.periods && (
          <div className="report-category-grid">
            <div className="chart-panel">
              <BarTrendChart
                title="Gigs per month"
                unit="gigs"
                points={periods.by_month.map((month) => ({
                  label: monthLabel(month.period),
                  count: month.gigs,
                }))}
              />
            </div>

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
                  style={{
                    marginTop: "10px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {showAllYears ? "Show last 5 years" : `Show all ${years.length} years`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
