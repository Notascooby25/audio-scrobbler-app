import { useState } from "react";
import styles from "./RetroJukebox.module.css";
import JukeboxFilters from "./JukeboxFilters";

export default function RetroJukebox({
  albums = [],
  filteredAlbums = [],
  _pool = [],
  currentPick = null,
  rollsLeft = 3,
  sessionActive = false,
  canRoll = true,
  busy = false,
  mode = "any",
  setMode,
  filters = { artist: "", decade: new Set(), genre: new Set(), length: new Set() },
  toggleFilter = () => {},
  clearFilters = () => {},
  onLuckyDip,
  onReroll,
  onCommit,
  sourceMode = "library",
  excludeCompleted = false,
  setExcludeCompleted,
  onToggle1001Completed,
}) {
  const [spinning, setSpinning] = useState(false);

  const handleRoll = (actionFn) => {
    if (busy || !canRoll) return;
    setSpinning(true);
    setTimeout(() => {
      setSpinning(false);
      actionFn();
    }, 600);
  };

  const outOfRolls = sessionActive && rollsLeft === 0;
  const spotifyLink =
    currentPick?.spotify_url ||
    (currentPick
      ? `https://open.spotify.com/search/${encodeURIComponent(currentPick.artist_name + " " + currentPick.album_name)}`
      : "#");

  return (
    <div className={styles.jukebox}>
      <div className={styles.marquee}>JUKEBOX</div>

      <div className={styles.stage}>
        <div className={styles.turntable}>
          <div className={styles.platter}>
            <div className={`${styles.vinyl} ${spinning ? styles.vinylSpinning : ""}`}>
              <div className={styles.vinylLabel}>
                {currentPick ? currentPick.album_name.slice(0, 2).toUpperCase() : "LP"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "10px", color: "#24212b", fontWeight: 600 }}>
        <strong>{filteredAlbums.length}</strong> records match filters
      </div>

      <JukeboxFilters
        albums={albums}
        filters={filters}
        toggleFilter={toggleFilter}
        clearFilters={clearFilters}
        mode={mode}
        setMode={setMode}
        sourceMode={sourceMode}
        excludeCompleted={excludeCompleted}
        setExcludeCompleted={setExcludeCompleted}
        variant="retro"
      />

      <button
        type="button"
        className={styles.dipBtn}
        disabled={busy || !canRoll}
        onClick={() => handleRoll(onLuckyDip)}
      >
        Lucky Dip
      </button>

      <div className={styles.card}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#c94032",
            textTransform: "uppercase",
          }}
        >
          {sessionActive
            ? `Lucky Dip Pick • ${sourceMode === "1001" ? "1001 Albums" : mode}`
            : "Today's Featured Pick"}
        </div>
        <h3
          style={{
            margin: "4px 0 2px",
            fontSize: "16px",
            fontWeight: 800,
            color: "#24212b",
            wordBreak: "break-word",
            lineHeight: 1.25,
          }}
        >
          {currentPick ? currentPick.album_name : "No Album Picked"}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "#394651",
            wordBreak: "break-word",
            lineHeight: 1.3,
          }}
        >
          {currentPick
            ? `${currentPick.artist_name} (${currentPick.release_year || "Unknown"})`
            : ""}
        </p>

        {currentPick && sourceMode === "1001" && (
          <div
            style={{
              marginTop: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#555555", fontWeight: 600 }}>
              Decade: {currentPick.decade ? `${currentPick.decade}s` : "Unknown"}
              {currentPick.genres &&
                currentPick.genres.length > 0 &&
                ` • ${currentPick.genres.join(", ")}`}
            </div>
            <button
              type="button"
              onClick={() =>
                onToggle1001Completed &&
                onToggle1001Completed(currentPick.id, !currentPick.is_completed)
              }
              style={{
                border: "2px solid #394651",
                borderRadius: "6px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 700,
                background: currentPick.is_completed ? "#3cc8b4" : "#fff",
                color: currentPick.is_completed ? "#fff" : "#394651",
                cursor: "pointer",
              }}
              aria-label={`Mark ${currentPick.album_name} as ${
                currentPick.is_completed ? "unplayed" : "played"
              }`}
            >
              {currentPick.is_completed ? "✓ Played" : "Mark Played"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button
            type="button"
            disabled={busy || !sessionActive || outOfRolls}
            onClick={() => handleRoll(onReroll)}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "6px",
              border: "2px solid #394651",
              background: "#fff",
              fontWeight: 700,
              cursor: busy || !sessionActive || outOfRolls ? "not-allowed" : "pointer",
            }}
          >
            Re-roll ({rollsLeft})
          </button>
          <a
            href={spotifyLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onCommit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 12px",
              background: "#3cc8b4",
              color: "#fff",
              border: "2px solid #394651",
              borderRadius: "6px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Open in Spotify
          </a>
        </div>
      </div>
    </div>
  );
}
