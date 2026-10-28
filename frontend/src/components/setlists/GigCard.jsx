export default function GigCard({ setlist, onLogAttendance, isLogging }) {
  const artistName = setlist?.artist?.name || "Unknown Artist";
  const venueName = setlist?.venue?.name || "Unknown Venue";
  const cityName = setlist?.venue?.city?.name || "";
  const countryName = setlist?.venue?.city?.country?.name || "";
  const tourName = setlist?.tour?.name || "";
  const eventDateStr = setlist?.eventDate || ""; // "dd-MM-yyyy"

  // Parse date into Day, Month, Year
  let day = "";
  let month = "";
  let year = "";
  if (eventDateStr && eventDateStr.includes("-")) {
    const parts = eventDateStr.split("-");
    if (parts.length === 3) {
      day = parts[0];
      const monthNum = parseInt(parts[1], 10);
      year = parts[2];
      const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];
      month = months[monthNum - 1] || "";
    }
  }

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
      className="card p-4 mb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      style={{ border: "0.5px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-4">
        {/* Date Badge */}
        <div
          className="flex flex-col items-center justify-center rounded px-3 py-2 text-center"
          style={{
            minWidth: "60px",
            backgroundColor: "var(--color-surface-hover)",
            border: "0.5px solid var(--color-border)",
          }}
        >
          <span className="text-xs font-bold text-muted">{month}</span>
          <span className="text-xl font-extrabold leading-none my-0.5">{day}</span>
          <span className="text-xs text-muted">{year}</span>
        </div>

        {/* Gig Info */}
        <div>
          <h3 className="font-semibold text-base mb-0.5">
            {artistName} at {venueName}
            {cityName ? `, ${cityName}` : ""}
            {countryName ? `, ${countryName}` : ""}
          </h3>
          <div className="text-xs text-muted mb-1">
            {tourName && (
              <span className="mr-2">
                Tour: <em>{tourName}</em>
              </span>
            )}
          </div>
          {songList.length > 0 ? (
            <p className="text-xs text-muted line-clamp-1">
              Songs: {songList.slice(0, 6).join(", ")}
              {songList.length > 6
                ? `... (${songList.length} tracks)`
                : ` (${songList.length} tracks)`}
            </p>
          ) : (
            <p className="text-xs text-muted italic">No setlist tracks recorded yet.</p>
          )}
        </div>
      </div>

      {/* "I WAS THERE" action button */}
      <button
        type="button"
        className="btn"
        style={{
          backgroundColor: "#16a34a",
          color: "#ffffff",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
        onClick={() => onLogAttendance(setlist)}
        disabled={isLogging}
      >
        &#10003; I WAS THERE
      </button>
    </div>
  );
}
