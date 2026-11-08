import React from "react";
import SourceBadge from "../../../components/SourceBadge";

export const SOURCE_MARKERS = [
  { id: "spotify", name: "Spotify", source: "spotify" },
  { id: "youtube", name: "YouTube", source: "youtube" },
  { id: "apple", name: "Apple", source: "apple" },
  { id: "bbc", name: "BBC", source: "bbc_sounds" },
  { id: "gig", name: "Gigs", source: "setlistfm" },
];

export default function TimelineHourlyChart({ scrobbles = [] }) {
  const currentHour = new Date().getHours();
  // Bucket today's scrobbles by hour (0 to currentHour)
  const hourlyCounts = Array.from({ length: currentHour + 1 }, () => 0);

  scrobbles.forEach((s) => {
    if (!s.played_at) return;
    const date = new Date(s.played_at);
    const hour = date.getHours();
    if (hour <= currentHour) {
      hourlyCounts[hour] += 1;
    }
  });

  const maxCount = Math.max(...hourlyCounts, 1);
  const totalPlays = hourlyCounts.reduce((a, b) => a + b, 0);

  // Find peak hour(s) for accessible summary
  let peakHour = 0;
  let peakVal = 0;
  hourlyCounts.forEach((cnt, h) => {
    if (cnt > peakVal) {
      peakVal = cnt;
      peakHour = h;
    }
  });

  const formatHourLabel = (h) => {
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h > 12 ? `${h - 12}pm` : `${h}am`;
  };

  const peakText =
    peakVal > 0
      ? `, peak at ${formatHourLabel(peakHour)} (${peakVal} play${peakVal === 1 ? "" : "s"})`
      : "";
  const ariaLabel = `Hourly listening distribution: ${totalPlays} play${totalPlays === 1 ? "" : "s"} today${peakText}`;

  // Key axis hours to display below the chart
  const axisHours = [
    { hour: 0, label: "12am" },
    ...(currentHour >= 6 ? [{ hour: 6, label: "6am" }] : []),
    ...(currentHour >= 12 && currentHour !== 12 ? [{ hour: 12, label: "12pm" }] : []),
    { hour: currentHour, label: "Now" },
  ];

  return (
    <div className="timeline-chart-section">
      <div className="timeline-chart-container" role="img" aria-label={ariaLabel}>
        <div className="timeline-chart-bars">
          {hourlyCounts.map((count, hour) => {
            const isCurrent = hour === currentHour;
            const isEmpty = count === 0;
            const barHeight = isEmpty ? 3 : Math.max(6, Math.round((count / maxCount) * 44));

            return (
              <div
                key={hour}
                className={`timeline-chart-bar-col ${isCurrent ? "current" : ""} ${isEmpty ? "empty" : ""}`}
                title={`${formatHourLabel(hour)}: ${count} play${count === 1 ? "" : "s"}${isCurrent ? " (Now)" : ""}`}
              >
                <div className="timeline-chart-bar" style={{ height: `${barHeight}px` }} />
              </div>
            );
          })}
        </div>
        <div className="timeline-chart-axis">
          {axisHours.map(({ hour, label }) => {
            const pct = currentHour > 0 ? (hour / currentHour) * 100 : 0;
            return (
              <span
                key={`${hour}-${label}`}
                className="timeline-axis-label"
                style={{
                  left: `${pct}%`,
                  transform:
                    hour === 0
                      ? "none"
                      : hour === currentHour
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="timeline-source-legend" aria-label="Source marker shapes">
        {SOURCE_MARKERS.map((m) => (
          <span key={m.id} className="timeline-legend-item">
            <SourceBadge source={m.source} size="sm" />
            <span>{m.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
