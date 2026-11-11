import { useState, useMemo } from "react";
import { PARENT_GENRES } from "./useJukeboxEngine";

export default function JukeboxFilters({
  albums = [],
  filters,
  toggleFilter,
  clearFilters,
  mode,
  setMode,
  sourceMode = "library",
  excludeCompleted = false,
  setExcludeCompleted,
  variant = "flat",
}) {
  const [expanded, setExpanded] = useState(false);
  const isRetro = variant === "retro";

  // Extract available decades dynamically from loaded albums
  const availableDecades = useMemo(() => {
    if (sourceMode === "rough_trade") return [];
    const set = new Set();
    albums.forEach((a) => {
      const year = a.release_year || a.decade;
      if (year) {
        set.add(Math.floor(year / 10) * 10);
      }
    });
    // In 1001 mode, guarantee decades from 1950 to 2020 if none or few present
    if (sourceMode === "1001" && set.size === 0) {
      [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].forEach((d) => set.add(d));
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [albums, sourceMode]);

  // Extract available years for Rough Trade mode
  const availableYears = useMemo(() => {
    if (sourceMode !== "rough_trade") return [];
    const set = new Set();
    albums.forEach((a) => {
      const yr = a.year || a.release_year;
      if (yr) set.add(Number(yr));
    });
    if (set.size === 0) {
      [2026, 2025, 2024, 2023, 2022, 2021, 2020].forEach((y) => set.add(y));
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [albums, sourceMode]);

  const activeFilterCount =
    (filters.artist.trim() ? 1 : 0) +
    filters.decade.size +
    (filters.year ? filters.year.size : 0) +
    filters.genre.size +
    filters.length.size +
    (excludeCompleted ? 1 : 0) +
    (mode !== "any" ? 1 : 0);

  const MODES = [
    { key: "any", label: "🎲 Any Record" },
    { key: "least", label: "⏳ Least Played" },
    { key: "most", label: "🔥 Most Played" },
    { key: "recent", label: "✨ Recently Added" },
  ];

  const LENGTHS = [
    { key: "short", label: "Short (< 35m)" },
    { key: "mid", label: "Standard (35-50m)" },
    { key: "long", label: "Epic (> 50m)" },
  ];

  const sectionHeadingStyle = {
    fontWeight: isRetro ? 800 : 600,
    marginBottom: "6px",
    color: isRetro ? "#394651" : "var(--color-muted)",
    letterSpacing: isRetro ? "0.03em" : "normal",
  };

  const getChipStyle = (active, isLarge = false) => ({
    padding: isLarge ? "6px 10px" : "4px 8px",
    minHeight: isLarge ? "32px" : "auto",
    borderRadius: isRetro ? "6px" : "4px",
    fontSize: "11px",
    fontWeight: isRetro ? (active ? 700 : 600) : 600,
    border: isRetro
      ? "2px solid #394651"
      : active
        ? "1px solid var(--color-primary)"
        : "1px solid var(--color-border)",
    background: isRetro
      ? active
        ? "#3cc8b4"
        : "#FFFFFF"
      : active
        ? "var(--color-primary)"
        : "var(--color-surface)",
    color: isRetro ? (active ? "#FFFFFF" : "#24212b") : active ? "#FFFFFF" : "var(--color-ink)",
    boxShadow: isRetro ? "0 1px 0 #394651" : "none",
    cursor: "pointer",
  });

  return (
    <div style={{ marginTop: "12px", marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            fontSize: "12px",
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: "6px",
            border: isRetro ? "2px solid #394651" : "1px solid var(--color-border)",
            background: isRetro
              ? activeFilterCount > 0
                ? "#3cc8b4"
                : "#fffdf8"
              : activeFilterCount > 0
                ? "var(--color-primary)"
                : "var(--color-surface)",
            color: isRetro
              ? activeFilterCount > 0
                ? "#FFFFFF"
                : "#24212b"
              : activeFilterCount > 0
                ? "#FFFFFF"
                : "var(--color-ink)",
            boxShadow: isRetro ? "0 2px 0 #394651" : "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>🔍 Filters {activeFilterCount > 0 ? `(${activeFilterCount} active)` : ""}</span>
          <span>{expanded ? "▲" : "▼"}</span>
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              clearFilters();
              if (setMode) setMode("any");
              if (setExcludeCompleted) setExcludeCompleted(false);
            }}
            style={{
              fontSize: "11px",
              color: isRetro ? "#c94032" : "var(--color-danger, #E11D48)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {expanded && (
        <div
          data-testid="jukebox-filters-drawer"
          style={{
            marginTop: "10px",
            padding: "14px",
            background: isRetro ? "#fffdf8" : "var(--color-surface-hover, var(--color-canvas))",
            borderRadius: isRetro ? "10px" : "8px",
            border: isRetro ? "2px solid #394651" : "1px solid var(--color-border)",
            boxShadow: isRetro ? "0 4px 0 #394651" : "none",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            fontSize: "12px",
            color: isRetro ? "#24212b" : "var(--color-ink)",
          }}
        >
          {/* Exclude Played Checkbox (1001 Albums & Rough Trade mode) */}
          {(sourceMode === "1001" || sourceMode === "rough_trade") && (
            <div
              style={{
                paddingBottom: "4px",
                borderBottom: isRetro ? "2px solid #394651" : "1px solid var(--color-border)",
              }}
            >
              <label
                htmlFor="exclude-completed-checkbox"
                style={{
                  display: "inline-flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  color: isRetro ? "#24212b" : "var(--color-ink)",
                }}
              >
                <input
                  id="exclude-completed-checkbox"
                  type="checkbox"
                  checked={excludeCompleted}
                  onChange={(e) => setExcludeCompleted && setExcludeCompleted(e.target.checked)}
                  style={{ cursor: "pointer", width: "16px", height: "16px" }}
                />
                <span>Exclude previously played albums</span>
              </label>
            </div>
          )}

          {/* Mode Selector (in Library mode) */}
          {sourceMode === "library" && (
            <div>
              <div style={sectionHeadingStyle}>POOL SELECTION MODE</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {MODES.map((m) => {
                  const active = mode === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMode && setMode(m.key)}
                      style={getChipStyle(active, false)}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Artist Search */}
          <div>
            <div style={sectionHeadingStyle}>ARTIST SEARCH</div>
            <input
              type="text"
              placeholder="Filter by artist name..."
              value={filters.artist}
              onChange={(e) => toggleFilter("artist", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: isRetro ? "2px solid #394651" : "1px solid var(--color-border)",
                fontSize: "12px",
                background: isRetro ? "#FFFFFF" : "var(--color-surface)",
                color: isRetro ? "#24212b" : "var(--color-ink)",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Year Filters (Rough Trade mode) */}
          {sourceMode === "rough_trade" && availableYears.length > 0 && (
            <div>
              <div style={sectionHeadingStyle}>YEAR</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {availableYears.map((yr) => {
                  const active =
                    filters.year && (filters.year.has(yr) || filters.year.has(String(yr)));
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => toggleFilter("year", yr)}
                      style={getChipStyle(active, true)}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Decade Filters */}
          {availableDecades.length > 0 && (
            <div>
              <div style={sectionHeadingStyle}>DECADE</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {availableDecades.map((dec) => {
                  const decStr = String(dec);
                  const active = filters.decade.has(decStr) || filters.decade.has(`${decStr}s`);
                  return (
                    <button
                      key={dec}
                      type="button"
                      onClick={() => toggleFilter("decade", decStr)}
                      style={getChipStyle(active, true)}
                    >
                      {dec}s
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Length Filters (Library mode) */}
          {sourceMode === "library" && (
            <div>
              <div style={sectionHeadingStyle}>ALBUM LENGTH</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {LENGTHS.map((len) => {
                  const active = filters.length.has(len.key);
                  return (
                    <button
                      key={len.key}
                      type="button"
                      onClick={() => toggleFilter("length", len.key)}
                      style={getChipStyle(active, false)}
                    >
                      {len.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unified Top 10 Parent Genres */}
          <div>
            <div style={sectionHeadingStyle}>GENRE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {PARENT_GENRES.map((g) => {
                const active = filters.genre.has(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleFilter("genre", g)}
                    style={getChipStyle(active, true)}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
