import { useState } from "react";
import SetlistDateBadge, { isFutureDate } from "./SetlistDateBadge";
import SetlistSongs from "./SetlistSongs";
import { processSetlistSets, safeExternalUrl } from "./setlistUiUtils";

/** One Setlist.fm search result, styled as a setlist.fm row with its log action. */
export default function GigCard({ setlist, onLogAttendance, isLogging }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const artistName = setlist?.artist?.name || "Unknown Artist";
  const venueName = setlist?.venue?.name || "Unknown Venue";
  const cityName = setlist?.venue?.city?.name || "";
  const countryName =
    setlist?.venue?.city?.country?.name || setlist?.venue?.city?.country?.code || "";
  const tourName = setlist?.tour?.name || "";
  const eventDateStr = setlist?.eventDate || "";
  const isFuture = isFutureDate(eventDateStr);

  const sets = processSetlistSets(setlist);
  const songNames = sets.flatMap((set) => set.songs.filter((s) => !s.tape).map((s) => s.name));

  return (
    <div className="sfm-result">
      <div className="sfm-gig has-action">
        <SetlistDateBadge date={eventDateStr} />
        <div className="sfm-gig-body">
          <div className="sfm-gig-title">
            <button
              type="button"
              className="sfm-link"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
            >
              {artistName} at {venueName}
            </button>
            {isFuture && <span className="sfm-tag">Upcoming</span>}
          </div>
          <div className="sfm-gig-meta">
            {[cityName, countryName].filter(Boolean).join(", ")}
            {tourName && ` · Tour: ${tourName}`}
          </div>
          <div className="sfm-gig-meta">
            {songNames.length > 0
              ? `${songNames.length} ${songNames.length === 1 ? "song" : "songs"}: ${songNames
                  .slice(0, 4)
                  .join(", ")}${songNames.length > 4 ? "…" : ""}`
              : isFuture
                ? "Upcoming concert • No setlist yet"
                : "No setlist tracks recorded yet"}
          </div>
        </div>
        <div className="sfm-gig-action">
          <button
            type="button"
            className="sfm-action"
            onClick={() => onLogAttendance(setlist)}
            disabled={isLogging}
          >
            {isLogging ? "Saving..." : isFuture ? "+ I'm going" : "✓ I was there"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="sfm-result-songs">
          {songNames.length > 0 ? (
            <SetlistSongs sets={sets} />
          ) : (
            <p className="sfm-gig-meta">No songs on Setlist.fm for this show yet.</p>
          )}
          <div className="sfm-gig-actions">
            {safeExternalUrl(setlist?.url) && (
              <a
                className="sfm-link"
                href={safeExternalUrl(setlist.url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Setlist.fm &#8599;
              </a>
            )}
            <button
              type="button"
              className="sfm-link is-muted"
              onClick={() => setIsExpanded(false)}
            >
              Hide songs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
