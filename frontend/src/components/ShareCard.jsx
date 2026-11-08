import Artwork from "./Artwork";

const KIND_LABELS = { artists: "Artists", albums: "Albums", tracks: "Tracks" };

function countWidth(count, maximum) {
  return { width: `${Math.max(8, (count / maximum) * 100)}%` };
}

function formatMinutes(mins) {
  if (!mins || mins <= 0) return "0m";
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours > 0 && remainder > 0) return `${hours}h ${remainder}m`;
  if (hours > 0) return `${hours}h`;
  return `${remainder}m`;
}

function formatSourceTitle(sourceKey) {
  const k = String(sourceKey).toLowerCase();
  if (k === "spotify" || k.startsWith("spotify")) return "Spotify";
  if (k.includes("bbc")) return "BBC Sounds";
  if (k.includes("apple") || k === "itunes") return "Apple Music";
  if (k.includes("youtube")) return "YouTube Music";
  if (k.includes("setlist") || k === "gig") return "Live Gigs";
  if (k.includes("import")) return "Imports";
  return sourceKey.charAt(0).toUpperCase() + sourceKey.slice(1);
}

export default function ShareCard({
  entries = [],
  kind,
  layout,
  dimension = "3x3",
  dateRangeLabel,
  stats,
  enabledStats = {},
}) {
  const maximum = Math.max(...entries.map((entry) => entry.play_count), 1);
  const kindLabel = KIND_LABELS[kind] || "Entries";

  const hasAnyStats =
    (enabledStats.listeningTime && stats?.listeningMinutes != null) ||
    (enabledStats.sources && stats?.sourceBreakdown && stats.sourceBreakdown.length > 0) ||
    (enabledStats.discoveries && stats?.newDiscoveries != null);

  const activeSources = (stats?.sourceBreakdown || []).filter((s) => s.count > 0 || s.percent > 0);

  return (
    <div className={`share-card share-card-${layout} share-card-dim-${dimension}`}>
      <div className="share-card-header">
        <div className="share-card-header-main">
          <span className="share-card-title">Top {kindLabel}</span>
          <span className="share-card-subtitle">{dateRangeLabel}</span>
        </div>
        <div className="share-card-brand">Audio Scrobbler</div>
      </div>

      {hasAnyStats && (
        <div className="share-card-stats-banner">
          {enabledStats.listeningTime && stats?.listeningMinutes != null && (
            <div className="share-stat-col">
              <span className="share-stat-label">Listening Time</span>
              <div className="share-stat-val">
                <span>{formatMinutes(stats.listeningMinutes)}</span>
                {stats.listeningMinutesComparisonPercent != null &&
                  stats.listeningMinutesComparisonPercent !== 0 && (
                    <span
                      className={`share-stat-diff ${
                        stats.listeningMinutesComparisonPercent > 0 ? "diff-up" : "diff-down"
                      }`}
                    >
                      {stats.listeningMinutesComparisonPercent > 0
                        ? `▲ +${Math.round(stats.listeningMinutesComparisonPercent)}%`
                        : `▼ ${Math.round(stats.listeningMinutesComparisonPercent)}%`}
                    </span>
                  )}
              </div>
            </div>
          )}

          {enabledStats.sources && activeSources.length > 0 && (
            <div className="share-stat-col">
              <span className="share-stat-label">Active Sources</span>
              <div className="share-source-pills">
                {activeSources.map((item) => (
                  <span className="share-source-pill" key={item.source}>
                    {formatSourceTitle(item.source)} {Math.round(item.percent)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {enabledStats.discoveries && stats?.newDiscoveries != null && (
            <div className="share-stat-col">
              <span className="share-stat-label">Discoveries</span>
              <div className="share-stat-val">
                <span>
                  {kind === "albums"
                    ? `${stats.newDiscoveries.albums || 0} new albums`
                    : kind === "tracks"
                      ? `${stats.newDiscoveries.tracks || 0} new tracks`
                      : `${stats.newDiscoveries.artists || 0} new artists`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {layout === "grid" ? (
        <div
          className={`library-rank-panel library-rank-panel-grid share-card-grid-layout share-grid-${dimension}`}
        >
          <ol className="library-rank-list">
            {entries.map((entry, index) => {
              const relativePercent = maximum > 0 ? (entry.play_count / maximum) * 100 : 0;
              return (
                <li
                  className="library-rank-row library-grid-card"
                  key={`${entry.label}-${entry.secondary || ""}`}
                >
                  <div className="grid-card-artwork-wrap">
                    <Artwork
                      className="grid-card-artwork"
                      src={entry.artwork_url}
                      label={entry.label}
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div className="grid-card-body">
                    <div className="grid-card-heading">
                      <span className="grid-card-rank">{index + 1}.</span>
                      <span className="grid-card-title">{entry.label}</span>
                    </div>
                    {entry.secondary && <span className="grid-card-artist">{entry.secondary}</span>}
                    <div className="grid-card-footer">
                      <span className="grid-card-count">
                        {entry.play_count.toLocaleString()} scrobbles
                      </span>
                      <div className="grid-card-bar-track" aria-hidden="true">
                        <div
                          className="grid-card-bar-fill"
                          style={{ width: `${relativePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <ol className="library-rank-list share-card-list">
          {entries.map((entry, index) => (
            <li className="library-rank-row" key={`${entry.label}-${entry.secondary || ""}`}>
              <div className="library-rank-media">
                <span className="library-rank-number">{index + 1}</span>
                <Artwork
                  className="library-row-artwork"
                  src={entry.artwork_url}
                  label={entry.label}
                  crossOrigin="anonymous"
                />
              </div>
              <span className="library-row-copy">
                <strong>{entry.label}</strong>
                {entry.secondary && (
                  <span className="library-row-subtitle">
                    <small>{entry.secondary}</small>
                  </span>
                )}
              </span>
              <div className="library-rank-actions">
                <div className="library-bar-track">
                  <div className="library-count-bar" style={countWidth(entry.play_count, maximum)}>
                    <span>{entry.play_count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="share-card-footer">audio-scrobbler.uk</div>
    </div>
  );
}
