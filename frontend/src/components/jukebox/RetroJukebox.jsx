import { useRef, useState } from "react";
import styles from "./RetroJukebox.module.css";
import JukeboxFilters from "./JukeboxFilters";
import RetroArtwork from "./RetroArtwork";
import RetroResultCard from "./RetroResultCard";
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
            >
              <RetroArtwork src={tile.album?.artwork_url} className={styles.tileImage} />
            </div>
          ))}
        </div>
        <div className={styles.turntable} aria-hidden="true">
          <div className={styles.platter}>
            <div className={`${styles.vinyl} ${spinning ? styles.vinylSpinning : ""}`}>
              <div
                className={styles.vinylLabel}
                data-testid="vinyl-label"
                style={currentPick ? { background: coverBackground(currentPick) } : undefined}
              >
                <span>{currentPick ? coverInitials(currentPick.album_name) : "LP"}</span>
                <RetroArtwork src={currentPick?.artwork_url} className={styles.vinylImage} />
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

      <RetroResultCard
        currentPick={currentPick}
        sessionActive={sessionActive}
        sourceMode={sourceMode}
        mode={mode}
        rollsLeft={rollsLeft}
        busy={busy}
        outOfRolls={outOfRolls}
        spotifyLink={spotifyLink}
        onReroll={() => handleRoll(onReroll)}
        onCommit={onCommit}
        onToggle1001Completed={onToggle1001Completed}
        onToggleRoughTradeCompleted={onToggleRoughTradeCompleted}
      />

      <div className={styles.grille} aria-hidden="true" />
    </div>
  );
}
