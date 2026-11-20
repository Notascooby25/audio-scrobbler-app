import { useState } from "react";
import PropTypes from "prop-types";
import styles from "./RetroResultCard.module.css";
import { coverBackground, coverInitials } from "./retroCovers";

const MODE_LABELS = {
  any: "Any",
  least: "Least played",
  most: "Most played",
  recent: "Recently added",
};

function RetroCover({ album }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(album?.artwork_url) && !failed;

  return (
    <div
      className={styles.cover}
      data-testid="retro-cover"
      style={album ? { background: coverBackground(album) } : undefined}
    >
      {showImage ? (
        <img
          className={styles.coverImage}
          src={album.artwork_url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{album ? coverInitials(album.album_name) : "LP"}</span>
      )}
    </div>
  );
}

RetroCover.propTypes = {
  album: PropTypes.shape({
    album_name: PropTypes.string,
    artist_name: PropTypes.string,
    artwork_url: PropTypes.string,
  }),
};

function tagFor({ sessionActive, sourceMode, mode }) {
  if (!sessionActive) return "Today's featured pick";
  if (sourceMode === "1001") return "Lucky dip · 1001 Albums";
  if (sourceMode === "rough_trade") return "Lucky dip · Rough Trade Top 100";
  return `Lucky dip · ${MODE_LABELS[mode] || MODE_LABELS.any}`;
}

export default function RetroResultCard({
  currentPick,
  sessionActive,
  sourceMode,
  mode,
  rollsLeft,
  busy,
  outOfRolls,
  spotifyLink,
  onReroll,
  onCommit,
  onToggle1001Completed,
  onToggleRoughTradeCompleted,
}) {
  const year = currentPick?.year || currentPick?.release_year;
  const markPlayed =
    currentPick && sourceMode === "1001"
      ? onToggle1001Completed
      : currentPick && sourceMode === "rough_trade"
        ? onToggleRoughTradeCompleted
        : null;

  const details = [];
  if (currentPick) {
    if (year) details.push(["Year", String(year)]);
    if (sourceMode === "1001") {
      const decade = currentPick.decade || (year ? Math.floor(Number(year) / 10) * 10 : null);
      details.push(["Decade", decade ? `${decade}s` : "Unknown"]);
      if (currentPick.genres?.length) details.push(["Genres", currentPick.genres.join(", ")]);
    } else if (sourceMode === "rough_trade") {
      if (currentPick.rank) details.push(["Rank", `#${currentPick.rank}`]);
      details.push(["List", `Rough Trade ${currentPick.year}`]);
    } else if (typeof currentPick.play_count === "number") {
      details.push(["Plays", String(currentPick.play_count)]);
    }
  }

  let status = "Hit Lucky Dip for a random record.";
  if (outOfRolls) status = "No more rolls – give it a spin!";
  else if (sessionActive) status = `Re-rolls left: ${rollsLeft}`;

  return (
    <div className={styles.card}>
      <p className={styles.tag}>{tagFor({ sessionActive, sourceMode, mode })}</p>

      <div className={styles.body}>
        <RetroCover key={currentPick?.id ?? "none"} album={currentPick} />
        <div className={styles.info}>
          <h3 className={styles.title} style={{ color: "#24212b" }}>
            {currentPick ? currentPick.album_name : "No Album Picked"}
          </h3>
          <p className={styles.artist} style={{ color: "#394651" }}>
            {currentPick ? `${currentPick.artist_name} (${year || "Unknown"})` : ""}
          </p>
          {details.length > 0 && (
            <dl className={styles.details}>
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {markPlayed && (
            <button
              type="button"
              className={`${styles.playedBtn} ${currentPick.is_completed ? styles.playedOn : ""}`}
              onClick={() => markPlayed(currentPick.id, !currentPick.is_completed)}
              aria-label={`Mark ${currentPick.album_name} as ${
                currentPick.is_completed ? "unplayed" : "played"
              }`}
            >
              {currentPick.is_completed ? "✓ Played" : "Mark Played"}
            </button>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.rerollBtn}
          disabled={busy || !sessionActive || outOfRolls}
          onClick={onReroll}
        >
          Re-roll ({rollsLeft})
        </button>
        <a
          className={styles.spotifyBtn}
          href={spotifyLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCommit}
        >
          Open in Spotify
        </a>
      </div>

      <p className={`${styles.status} ${outOfRolls ? styles.statusOut : ""}`}>{status}</p>
    </div>
  );
}

RetroResultCard.propTypes = {
  currentPick: PropTypes.object,
  sessionActive: PropTypes.bool,
  sourceMode: PropTypes.string,
  mode: PropTypes.string,
  rollsLeft: PropTypes.number,
  busy: PropTypes.bool,
  outOfRolls: PropTypes.bool,
  spotifyLink: PropTypes.string,
  onReroll: PropTypes.func,
  onCommit: PropTypes.func,
  onToggle1001Completed: PropTypes.func,
  onToggleRoughTradeCompleted: PropTypes.func,
};
