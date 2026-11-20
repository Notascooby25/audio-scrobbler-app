import { useRef, useState } from "react";
import styles from "./RetroJukebox.module.css";
import JukeboxFilters from "./JukeboxFilters";
import { buildRackTiles, coverBackground, coverInitials } from "./retroCovers";

const BULB_COUNT = 13;
const PICK_FROM_MODES = [
  { key: "any", label: "Any" },
  { key: "least", label: "Least played" },
  { key: "most", label: "Most played" },
  { key: "recent", label: "Recently added" },
];

export default function RetroJukebox({
  albums = [],
  filteredAlbums = [],
  pool = [],
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
  onToggleRoughTradeCompleted,
}) {
  const [spinning, setSpinning] = useState(false);
  const filtersRef = useRef(null);

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

  const matchCount = filteredAlbums.length;
  const isLibrary = sourceMode === "library";
  const rackTiles = buildRackTiles({ filteredAlbums, pool, currentPick });
  const poolMode = PICK_FROM_MODES.find((option) => option.key === mode);
  const poolNote =
    isLibrary && mode !== "any" && matchCount > 0 && poolMode
      ? `· picking from ${pool.length} ${poolMode.label.toLowerCase()}`
      : "";

  const lamps = [
    { key: "artist", label: "Artist", on: filters.artist.trim().length > 0 },
    { key: "year", label: "Year", on: filters.decade.size > 0 || (filters.year?.size ?? 0) > 0 },
    { key: "genre", label: "Genre", on: filters.genre.size > 0 },
    ...(isLibrary ? [{ key: "length", label: "Length", on: filters.length.size > 0 }] : []),
  ];

  const goToFilters = () => {
    const block = filtersRef.current;
    if (!block) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    block.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    block.querySelector(".jukebox-filters-toggle")?.focus({ preventScroll: true });
  };

  return (
    <div className={styles.jukebox}>
      <div className={styles.bulbs} aria-hidden="true">
        {Array.from({ length: BULB_COUNT }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className={styles.marquee}>JUKEBOX</div>

      <div className={styles.stage}>
        <div className={styles.rack} aria-hidden="true">
          {rackTiles.map((tile) => (
            <div
              key={tile.key}
              data-testid="rack-tile"
              data-state={tile.state}
              className={`${styles.tile} ${styles[`tile_${tile.state}`]}`}
              style={tile.album ? { background: coverBackground(tile.album) } : undefined}
              title={
                tile.album ? `${tile.album.artist_name} – ${tile.album.album_name}` : undefined
              }
            />
          ))}
        </div>
        <div className={styles.turntable} aria-hidden="true">
          <div className={styles.platter}>
            <div className={`${styles.vinyl} ${spinning ? styles.vinylSpinning : ""}`}>
              <div
                className={styles.vinylLabel}
                style={currentPick ? { background: coverBackground(currentPick) } : undefined}
              >
                <span>{currentPick ? coverInitials(currentPick.album_name) : "LP"}</span>
              </div>
            </div>
          </div>
          <div
            className={styles.toneArm}
            data-testid="tone-arm"
            data-on={currentPick ? "true" : "false"}
          />
        </div>
      </div>

      <div
        className={styles.lamps}
        role="group"
        aria-label="Filter selectors"
        style={{ "--lamp-count": lamps.length }}
      >
        {lamps.map((lamp) => (
          <button
            key={lamp.key}
            type="button"
            className={`${styles.lamp} ${lamp.on ? styles.lampOn : ""}`}
            data-on={lamp.on ? "true" : "false"}
            aria-label={`${lamp.label} filter ${lamp.on ? "on" : "off"}, go to filters`}
            onClick={goToFilters}
          >
            <span className={styles.lampBulb} aria-hidden="true" />
            <span className={styles.lampText}>{lamp.label}</span>
          </button>
        ))}
      </div>

      <p className={styles.counter} data-testid="rack-counter" style={{ color: "#24212b" }}>
        <strong>{matchCount}</strong> {matchCount === 1 ? "record" : "records"}
        {poolNote && <span className={styles.poolNote}> {poolNote}</span>}
      </p>

      {matchCount === 0 && (
        <div className={styles.emptyBox}>
          <p>No records match these filters.</p>
          <button type="button" className={styles.emptyBtn} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {isLibrary && (
        <fieldset className={styles.modes}>
          <legend className={styles.modesLegend}>Pick from</legend>
          <div className={styles.seg}>
            {PICK_FROM_MODES.map((option) => (
              <label key={option.key} className={styles.segOption}>
                <input
                  type="radio"
                  name="retro-pick-from"
                  value={option.key}
                  checked={mode === option.key}
                  onChange={() => setMode && setMode(option.key)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div ref={filtersRef}>
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
          hideModeSelector
        />
      </div>

      <button
        type="button"
        className={styles.dipBtn}
        disabled={busy || !canRoll}
        onClick={() => handleRoll(onLuckyDip)}
      >
        Lucky Dip
      </button>
      <p className={styles.dipHint}>
        {outOfRolls
          ? "No more rolls – give it a spin!"
          : matchCount === 0
            ? "Nothing to pick – loosen a filter."
            : ""}
      </p>

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
            ? `Lucky Dip Pick • ${sourceMode === "1001" ? "1001 Albums" : sourceMode === "rough_trade" ? "Rough Trade Top 100" : mode}`
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
            ? `${currentPick.artist_name} (${currentPick.year || currentPick.release_year || "Unknown"})`
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

        {currentPick && sourceMode === "rough_trade" && (
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
              {currentPick.rank ? `Rank #${currentPick.rank} • ` : ""}
              Rough Trade {currentPick.year}
            </div>
            <button
              type="button"
              onClick={() =>
                onToggleRoughTradeCompleted &&
                onToggleRoughTradeCompleted(currentPick.id, !currentPick.is_completed)
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

      <div className={styles.grille} aria-hidden="true" />
    </div>
  );
}
