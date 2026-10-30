import { useState } from "react";
import styles from "./RetroJukebox.module.css";

export default function RetroJukebox({
  filteredAlbums = [],
  _pool = [],
  currentPick = null,
  rollsLeft = 3,
  sessionActive = false,
  canRoll = true,
  busy = false,
  mode = "any",
  _setMode,
  onLuckyDip,
  onReroll,
  onCommit,
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

      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <strong>{filteredAlbums.length}</strong> records match filters
      </div>

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
          {sessionActive ? `Lucky Dip Pick • ${mode}` : "Today's Featured Pick"}
        </div>
        <h3 style={{ margin: "4px 0 2px", fontSize: "16px" }}>
          {currentPick ? currentPick.album_name : "No Album Picked"}
        </h3>
        <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
          {currentPick
            ? `${currentPick.artist_name} (${currentPick.release_year || "Unknown"})`
            : ""}
        </p>

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
