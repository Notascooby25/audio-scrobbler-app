import { useState } from "react";
import SetlistDateBadge, { isFutureDate } from "./SetlistDateBadge";
import SetlistTracklistDrawer from "./SetlistTracklistDrawer";

export default function GigCard({ setlist, token, onLogAttendance, onViewSetlist, isLogging }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const artistName = setlist?.artist?.name || "Unknown Artist";
  const venueName = setlist?.venue?.name || "Unknown Venue";
  const cityName = setlist?.venue?.city?.name || "";
  const countryName =
    setlist?.venue?.city?.country?.name || setlist?.venue?.city?.country?.code || "";
  const tourName = setlist?.tour?.name || "";
  const eventDateStr = setlist?.eventDate || "";
  const isFuture = isFutureDate(eventDateStr);

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
    if (onViewSetlist) {
      onViewSetlist(setlist);
    }
  };

  // Extract song names
  const sets = setlist?.sets?.set || [];
  const songList = [];
  if (Array.isArray(sets)) {
    sets.forEach((s) => {
      if (Array.isArray(s.song)) {
        s.song.forEach((sg) => {
          if (sg.name) songList.push(sg.name);
        });
      }
    });
  }

  return (
    <div
      className={`card p-4 mb-3 transition-colors hover:border-border-subtle ${
        isFuture ? "border-l-4" : ""
      }`}
      style={{
        border: "0.5px solid var(--color-border)",
        borderLeft: isFuture ? "4px solid var(--color-primary, #0066FF)" : undefined,
      }}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
          {/* Date Badge */}
          <SetlistDateBadge date={eventDateStr} />

          {/* Gig Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <button
                type="button"
                className="btn-text-link font-semibold text-base text-left truncate"
                onClick={toggleExpand}
                title="Click to view songs played inline"
              >
                {artistName} at {venueName}
              </button>
              {isFuture && (
                <span className="badge font-bold px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                  Upcoming
                </span>
              )}
            </div>

            <div className="text-xs text-muted mb-1 truncate">
              {cityName ? `${cityName}, ` : ""}
              {countryName}
              {tourName && (
                <span>
                  {" "}
                  &bull; Tour: <em>{tourName}</em>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              {songList.length > 0 ? (
                <p className="text-xs text-muted line-clamp-1 truncate">
                  Songs: {songList.slice(0, 5).join(", ")}
                  {songList.length > 5 ? `... (${songList.length} tracks)` : ""}
                </p>
              ) : (
                <p className="text-xs text-muted italic">
                  {isFuture
                    ? "Upcoming concert • No setlist yet"
                    : "No setlist tracks recorded yet"}
                </p>
              )}
              <button
                type="button"
                className="text-primary hover:underline font-semibold shrink-0 cursor-pointer bg-transparent border-0 p-0"
                onClick={toggleExpand}
              >
                {isExpanded ? "▲ Hide Songs" : "View Songs \u2192"}
              </button>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="self-end md:self-auto shrink-0 flex items-center gap-2">
          <button
            type="button"
            className="btn text-xs font-bold px-3.5 py-1.5 whitespace-nowrap"
            style={{
              backgroundColor: isFuture ? "var(--color-primary, #0066FF)" : "#16a34a",
              color: "#ffffff",
            }}
            onClick={() => onLogAttendance(setlist)}
            disabled={isLogging}
          >
            {isLogging ? "Saving..." : isFuture ? "+ I'M GOING" : "✓ I WAS THERE"}
          </button>
        </div>
      </div>

      {/* In-place Setlist Tracklist Drawer */}
      {isExpanded && (
        <SetlistTracklistDrawer
          setlistId={setlist.id}
          initialData={setlist}
          token={token}
          showNotesEditor={false}
          onCollapse={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}
