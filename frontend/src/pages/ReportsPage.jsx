import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AnalyticsPage from "../components/AnalyticsPage";
import DateRangeSelector from "../components/DateRangeSelector";
import LibraryRankList from "../components/LibraryRankList";
import BarTrendChart from "../components/charts/BarTrendChart";
import ListeningHeatmap from "../components/charts/ListeningHeatmap";
import ListeningClockChart from "../components/charts/ListeningClockChart";
import GenreBarList from "../components/charts/GenreBarList";
import FriendsComparisonSection from "../components/reports/FriendsComparisonSection";
import GigReportsSection from "../components/reports/GigReportsSection";
import ReportMilestones from "../components/reports/ReportMilestones";
import Report1001Milestone from "../components/reports/Report1001Milestone";
import ReportLiveConnection from "../components/reports/ReportLiveConnection";
import ReportRatios from "../components/reports/ReportRatios";
import ReportCustomiseModal, {
  DEFAULT_WIDGET_PREFERENCES,
} from "../components/reports/ReportCustomiseModal";
import {
  fetchReportsCharts,
  fetchReportsEntity,
  fetchReportsSummary,
  fetchUserProfile,
} from "../api";
import { createDefaultDateRange, DATE_RANGE_PRESETS, isValidDateRange } from "../dateRange";
import { readSession } from "../session";

const WIDGET_STORAGE_KEY = "audio_scrobbler_reports_widgets_v1";

function loadWidgetPreferences() {
  try {
    const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET_PREFERENCES;
    return { ...DEFAULT_WIDGET_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WIDGET_PREFERENCES;
  }
}

function dateRangeFromParams(searchParams) {
  const range = searchParams.get("range");
  if (range && range !== "custom" && DATE_RANGE_PRESETS.includes(range)) {
    return { range, start_date: null, end_date: null, compare_to_previous: false };
  }
  return createDefaultDateRange();
}

function getComparisonClass(percent) {
  const val = Number(percent) || 0;
  if (val > 0) return "stat-comparison stat-comparison-positive";
  if (val < 0) return "stat-comparison stat-comparison-negative";
  return "stat-comparison stat-comparison-neutral";
}

export default function ReportsPage() {
  const session = readSession();
  const [searchParams] = useSearchParams();
  const routeUserId = searchParams.get("userId");
  const targetUserId = routeUserId ? Number(routeUserId) : undefined;
  const isOwnReport = !routeUserId || Number(routeUserId) === session?.userId;
  const [targetProfile, setTargetProfile] = useState(null);
  const [dateRange, setDateRange] = useState(() => dateRangeFromParams(searchParams));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showFriendsComparison, setShowFriendsComparison] = useState(false);
  const [error, setError] = useState("");
  const [reportView, setReportView] = useState("listening");
  const [widgetPreferences, setWidgetPreferences] = useState(() => loadWidgetPreferences());
  const [isCustomiseOpen, setIsCustomiseOpen] = useState(false);

  const handleSaveWidgetPreferences = (newPrefs) => {
    setWidgetPreferences(newPrefs);
    try {
      localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(newPrefs));
    } catch {
      // Storage unavailable or quota exceeded
    }
  };

  useEffect(() => {
    if (!session?.accessToken || isOwnReport) {
      setTargetProfile(null);
      return;
    }
    fetchUserProfile({ token: session.accessToken, userId: targetUserId })
      .then(setTargetProfile)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeUserId]);

  useEffect(() => {
    if (!session?.accessToken) return;
    if (!isValidDateRange(dateRange)) return;
    setError("");
    setLoading(true);
    Promise.all([
      fetchReportsSummary({ token: session.accessToken, dateRange, userId: targetUserId }),
      fetchReportsCharts({ token: session.accessToken, dateRange, userId: targetUserId }),
      fetchReportsEntity({
        token: session.accessToken,
        entity: "artists",
        dateRange,
        userId: targetUserId,
      }),
      fetchReportsEntity({
        token: session.accessToken,
        entity: "albums",
        dateRange,
        userId: targetUserId,
      }),
      fetchReportsEntity({
        token: session.accessToken,
        entity: "tracks",
        dateRange,
        userId: targetUserId,
      }),
      fetchReportsEntity({
        token: session.accessToken,
        entity: "genres",
        dateRange,
        userId: targetUserId,
      }),
    ])
      .then(([summary, charts, artists, albums, tracks, genres]) => {
        setReport({ summary, charts, artists, albums, tracks, genres });
        setLoading(false);
      })
      .catch((requestError) => {
        setError(
          requestError.status === 403
            ? "Follow this user to see their reports."
            : requestError.message
        );
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, routeUserId]);

  return (
    <AnalyticsPage
      eyebrow="Listening report"
      title={isOwnReport ? "Reports" : `@${targetProfile?.username || "..."}'s Reports`}
    >
      {!session?.accessToken && (
        <p className="notice">
          Connect Spotify from the <Link to="/connect">connection page</Link> to see your listening
          report.
        </p>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="sfm-tabs" role="tablist" aria-label="Report sections">
        {[
          { id: "listening", label: "Listening" },
          { id: "gigs", label: "Gigs" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={reportView === tab.id}
            className={`sfm-tab ${reportView === tab.id ? "active" : ""}`}
            onClick={() => setReportView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {reportView === "gigs" && session?.accessToken && (
        <GigReportsSection token={session.accessToken} userId={targetUserId} />
      )}
      {reportView === "listening" && (
        <>
          <div className="reports-toolbar">
            <DateRangeSelector value={dateRange} onChange={setDateRange} showCompare={false} />
            <div className="reports-toolbar-actions">
              <label
                className={`compare-toggle-btn ${dateRange.compare_to_previous ? "active" : ""}`}
              >
                <input
                  type="checkbox"
                  className="visually-hidden-accessible"
                  aria-label="Compare to previous period"
                  checked={Boolean(dateRange.compare_to_previous)}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, compare_to_previous: e.target.checked }))
                  }
                />
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                <span>
                  {dateRange.compare_to_previous
                    ? "Comparing previous period"
                    : "Compare previous period"}
                </span>
              </label>
              {isOwnReport && (
                <button
                  type="button"
                  className="compare-toggle-btn reports-customise-btn"
                  onClick={() => setIsCustomiseOpen(true)}
                  aria-label="Customise report widgets"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Customise Widgets</span>
                </button>
              )}
              {isOwnReport && (
                <button
                  type="button"
                  className={`compare-toggle-btn compare-friends-btn ${showFriendsComparison ? "active" : ""}`}
                  onClick={() => setShowFriendsComparison((prev) => !prev)}
                  aria-expanded={showFriendsComparison}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>
                    {showFriendsComparison ? "Hide Friends Comparison" : "Compare with Friends"}
                  </span>
                </button>
              )}
              <Link
                to={isOwnReport ? "/library" : `/library?userId=${targetUserId}`}
                className="reports-library-link"
              >
                Browse library history →
              </Link>
            </div>
          </div>
          {loading && (
            <div className="reports-loading-indicator" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>Updating listening report for selected period...</span>
            </div>
          )}
          {showFriendsComparison && session?.accessToken && (
            <FriendsComparisonSection token={session.accessToken} dateRange={dateRange} />
          )}
          {report && (
            <div className="report-facts">
              <div className="report-fact-card">
                <strong>{Number(report.summary.period_scrobbles || 0).toLocaleString()}</strong>
                <span>Scrobbles this period</span>
                {dateRange.compare_to_previous && (
                  <span className={getComparisonClass(report.summary.comparison_percent)}>
                    {report.summary.comparison_percent > 0
                      ? `+${report.summary.comparison_percent}%`
                      : `${report.summary.comparison_percent}%`}{" "}
                    vs previous (
                    {Number(report.summary.previous_period_scrobbles || 0).toLocaleString()})
                  </span>
                )}
              </div>
              <div className="report-fact-card">
                <strong>{Number(report.summary.listening_minutes || 0).toLocaleString()}</strong>
                <span>Listening minutes</span>
                {dateRange.compare_to_previous && (
                  <span
                    className={getComparisonClass(
                      report.summary.listening_minutes_comparison_percent
                    )}
                  >
                    {(report.summary.listening_minutes_comparison_percent || 0) > 0
                      ? `+${report.summary.listening_minutes_comparison_percent}%`
                      : `${report.summary.listening_minutes_comparison_percent || 0}%`}{" "}
                    vs previous (
                    {Number(report.summary.previous_listening_minutes || 0).toLocaleString()})
                  </span>
                )}
              </div>
              <div className="report-fact-card">
                <strong>{Number(report.summary.average_per_day || 0)}</strong>
                <span>Average per day</span>
                {dateRange.compare_to_previous && (
                  <span
                    className={getComparisonClass(
                      report.summary.average_per_day_comparison_percent
                    )}
                  >
                    {(report.summary.average_per_day_comparison_percent || 0) > 0
                      ? `+${report.summary.average_per_day_comparison_percent}%`
                      : `${report.summary.average_per_day_comparison_percent || 0}%`}{" "}
                    vs previous ({Number(report.summary.previous_average_per_day || 0)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 2. Streaks & Listening Milestones */}
          {report && widgetPreferences.showMilestones && (
            <ReportMilestones summary={report.summary} />
          )}

          {/* 3. Challenge 1001 & Live Concert Cross-Overs */}
          {report &&
            (widgetPreferences.showChallenge1001 || widgetPreferences.showLiveConnection) && (
              <div className="report-crossover-grid">
                {widgetPreferences.showChallenge1001 && (
                  <Report1001Milestone challenge1001={report.summary.challenge_1001} />
                )}
                {widgetPreferences.showLiveConnection && (
                  <ReportLiveConnection liveArtists={report.summary.live_artists} />
                )}
              </div>
            )}

          {/* 4. Scrobbles over time */}
          {report && widgetPreferences.showScrobblesOverTime && (
            <div className="report-data-grid">
              <BarTrendChart title="Scrobbles over time" points={report.charts.weekly_scrobbles} />
            </div>
          )}

          {/* 5. Listening routines & Listening Clock */}
          {report &&
            (widgetPreferences.showListeningRoutines || widgetPreferences.showListeningClock) && (
              <div className="report-time-grid">
                {widgetPreferences.showListeningRoutines && (
                  <div className="chart-panel">
                    <h2>Listening routines</h2>
                    <div style={{ overflowX: "auto", paddingBottom: "8px" }}>
                      <ListeningHeatmap points={report.charts.listening_heatmap} />
                    </div>
                    <div className="chart-caption">
                      Your listening activity mapped by hour and day of the week.
                    </div>
                  </div>
                )}
                {widgetPreferences.showListeningClock && (
                  <ListeningClockChart points={report.charts.listening_clock} />
                )}
              </div>
            )}

          {/* 6. Music by decade & Top genres */}
          {report && (widgetPreferences.showDecades || widgetPreferences.showGenres) && (
            <div className="report-character-grid">
              {widgetPreferences.showDecades && (
                <div className="chart-panel">
                  <h2>Music by decade</h2>
                  <BarTrendChart
                    title="Releases by decade"
                    points={report.charts.music_by_decade}
                  />
                </div>
              )}
              {widgetPreferences.showGenres && (
                <div className="chart-panel">
                  <h2>Top genres</h2>
                  <GenreBarList
                    genres={
                      report.genres?.entries?.map((e) => ({
                        label: e.label,
                        count: e.play_count,
                      })) || []
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* 7. Music ratios & Discovery velocity */}
          {report && widgetPreferences.showRatios && <ReportRatios summary={report.summary} />}

          {/* 8. Top Leaderboards */}
          {report && widgetPreferences.showLeaderboards && (
            <div className="report-category-grid">
              <LibraryRankList
                entries={report.artists.entries}
                kind="artists"
                token={session.accessToken}
                page={1}
                pageSize={widgetPreferences.leaderboardLimit || 5}
                totalCount={report.artists.entries.length}
                view="list"
                userId={targetUserId}
              />
              <LibraryRankList
                entries={report.albums.entries}
                kind="albums"
                token={session.accessToken}
                page={1}
                pageSize={widgetPreferences.leaderboardLimit || 5}
                totalCount={report.albums.entries.length}
                view="list"
                userId={targetUserId}
              />
              <LibraryRankList
                entries={report.tracks.entries}
                kind="tracks"
                token={session.accessToken}
                page={1}
                pageSize={widgetPreferences.leaderboardLimit || 5}
                totalCount={report.tracks.entries.length}
                view="list"
                userId={targetUserId}
              />
            </div>
          )}

          <ReportCustomiseModal
            isOpen={isCustomiseOpen}
            preferences={widgetPreferences}
            onSave={handleSaveWidgetPreferences}
            onClose={() => setIsCustomiseOpen(false)}
          />
        </>
      )}
    </AnalyticsPage>
  );
}
