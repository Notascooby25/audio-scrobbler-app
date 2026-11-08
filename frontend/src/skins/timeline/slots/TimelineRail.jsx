import React from "react";
import Artwork from "../../../components/Artwork";
import LikedHeart from "../../../components/LikedHeart";
import SourceBadge from "../../../components/SourceBadge";

export function formatTimelineTime(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  return d
    .toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(/\s+/g, "");
}

export default function TimelineRail({ scrobbles = [], nowPlaying = null, onToggleLike = null }) {
  if (scrobbles.length === 0 && !nowPlaying?.is_playing) {
    return (
      <div className="timeline-empty-rail" aria-live="polite">
        <div className="timeline-empty-rail-line" aria-hidden="true" />
        <p className="timeline-empty-rail-message">Nothing yet today</p>
      </div>
    );
  }

  // Pre-process items to calculate quiet gaps between consecutive plays.
  // Scrobbles are in reverse chronological order (newest first).
  // Between scrobble[i] and scrobble[i+1], diffMs = time[i] - time[i+1].
  // If diffMs >= 60 * 60 * 1000, insert a quiet gap between them.
  const itemsWithGaps = [];

  for (let i = 0; i < scrobbles.length; i++) {
    const current = scrobbles[i];
    itemsWithGaps.push({ type: "track", data: current, index: i });

    if (i < scrobbles.length - 1) {
      const next = scrobbles[i + 1];
      const tCurrent = new Date(current.played_at).getTime();
      const tNext = new Date(next.played_at).getTime();
      const diffMs = tCurrent - tNext;
      const hourMs = 60 * 60 * 1000;

      if (diffMs >= hourMs) {
        const quietHours = Math.floor(diffMs / hourMs);
        itemsWithGaps.push({
          type: "gap",
          key: `gap-${current.id || i}-${next.id || i + 1}`,
          hours: quietHours,
          label: `${quietHours} h quiet`,
        });
      }
    }
  }

  return (
    <div className="timeline-rail-container">
      {nowPlaying?.is_playing && (
        <div className="timeline-rail-item timeline-rail-now-playing">
          <div className="timeline-time-col">
            <span className="timeline-now-pulse-text">Now</span>
          </div>
          <div className="timeline-rail-col">
            <div className="timeline-rail-line" />
            <span
              className="timeline-rail-marker timeline-marker-now"
              role="img"
              aria-label="Playing now"
            >
              <span className="timeline-now-dot" />
            </span>
          </div>
          <div className="timeline-track-col">
            <div className="timeline-track-row">
              <div className="timeline-track-main">
                <span className="timeline-now-badge">Playing now</span>
                <span className="timeline-track-title">{nowPlaying.track_name}</span>
                <span className="timeline-track-artist">{nowPlaying.artist_name}</span>
              </div>
              <div className="timeline-track-side">
                {onToggleLike && (
                  <LikedHeart
                    liked={Boolean(nowPlaying.is_liked)}
                    interactive={true}
                    onToggle={() => onToggleLike(nowPlaying)}
                  />
                )}
                <div className="timeline-artwork-wrap">
                  <Artwork
                    src={nowPlaying.artwork_url}
                    label={`${nowPlaying.artist_name} - ${nowPlaying.track_name}`}
                    className="timeline-track-artwork"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemsWithGaps.map((item) => {
        if (item.type === "gap") {
          return (
            <div
              key={item.key}
              className="timeline-quiet-gap"
              role="separator"
              aria-label={item.label}
            >
              <div className="timeline-time-col" />
              <div className="timeline-rail-col">
                <div className="timeline-rail-gap-line" />
              </div>
              <div className="timeline-track-col">
                <span className="timeline-quiet-gap-badge">{item.label}</span>
              </div>
            </div>
          );
        }

        const track = item.data;
        const timeStr = formatTimelineTime(track.played_at);
        const key = track.id || `${track.track_name}-${track.played_at}-${item.index}`;

        return (
          <div key={key} className="timeline-rail-item">
            <div className="timeline-time-col">
              <span className="timeline-time-text">{timeStr}</span>
            </div>
            <div className="timeline-rail-col">
              <div className="timeline-rail-line" />
              <SourceBadge
                source={track.source || "spotify"}
                size="sm"
                className="timeline-rail-marker"
              />
            </div>
            <div className="timeline-track-col">
              <div className="timeline-track-row">
                <div className="timeline-track-main">
                  <span className="timeline-track-title">{track.track_name}</span>
                  <span className="timeline-track-artist">{track.artist_name}</span>
                </div>
                <div className="timeline-track-side">
                  {onToggleLike && (
                    <LikedHeart
                      liked={Boolean(track.is_liked)}
                      interactive={true}
                      onToggle={() => onToggleLike(track)}
                    />
                  )}
                  <div className="timeline-artwork-wrap">
                    <Artwork
                      src={track.artwork_url}
                      label={`${track.artist_name} - ${track.track_name}`}
                      className="timeline-track-artwork"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
