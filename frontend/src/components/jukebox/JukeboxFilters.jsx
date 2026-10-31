import { useState, useMemo } from "react";

export default function JukeboxFilters({
  albums = [],
  filters,
  toggleFilter,
  clearFilters,
  mode,
  setMode,
}) {
  const [expanded, setExpanded] = useState(false);

  // Extract available decades dynamically from loaded albums
  const availableDecades = useMemo(() => {
    const set = new Set();
    albums.forEach((a) => {
      if (a.release_year) {
        set.add(Math.floor(a.release_year / 10) * 10);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [albums]);

  // Extract top genres dynamically
  const availableGenres = useMemo(() => {
    const counts = {};
    albums.forEach((a) => {
      (a.genres || []).forEach((g) => {
        counts[g] = (counts[g] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([g]) => g);
  }, [albums]);

  const activeFilterCount =
    (filters.artist.trim() ? 1 : 0) +
    filters.decade.size +
    filters.genre.size +
    filters.length.size +
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

  return (
    <div style={{ marginTop: "12px", marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            fontSize: "12px",
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid var(--color-border, #E5E5E5)",
            background: activeFilterCount > 0 ? "var(--color-primary, #0066FF)" : "var(--color-surface, #FFFFFF)",
            color: activeFilterCount > 0 ? "#FFFFFF" : "var(--color-text-primary, #111111)",
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
            }}
            style={{
              fontSize: "11px",
              color: "#E11D48",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {expanded && (
        <div
          style={{
            marginTop: "10px",
            padding: "14px",
            background: "var(--color-neutral-bg, #F7F7F7)",
            borderRadius: "8px",
            border: "1px solid var(--color-border, #E5E5E5)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            fontSize: "12px",
          }}
        >
          {/* Mode Selector */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--color-text-secondary, #888888)" }}>
              POOL SELECTION MODE
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {MODES.map((m) => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode && setMode(m.key)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      border: active ? "1px solid var(--color-primary, #0066FF)" : "1px solid var(--color-border, #E5E5E5)",
                      background: active ? "var(--color-primary, #0066FF)" : "var(--color-surface, #FFFFFF)",
                      color: active ? "#FFFFFF" : "var(--color-text-primary, #111111)",
                      cursor: "pointer",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Artist Search */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--color-text-secondary, #888888)" }}>
              ARTIST SEARCH
            </div>
            <input
              type="text"
              placeholder="Filter by artist name..."
              value={filters.artist}
              onChange={(e) => toggleFilter("artist", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid var(--color-border, #E5E5E5)",
                fontSize: "12px",
                background: "var(--color-surface, #FFFFFF)",
                color: "var(--color-text-primary, #111111)",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Decade Filters */}
          {availableDecades.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--color-text-secondary, #888888)" }}>
                DECADE
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {availableDecades.map((dec) => {
                  const decStr = String(dec);
                  const active = filters.decade.has(decStr);
                  return (
                    <button
                      key={dec}
                      type="button"
                      onClick={() => toggleFilter("decade", decStr)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        border: active ? "1px solid var(--color-primary, #0066FF)" : "1px solid var(--color-border, #E5E5E5)",
                        background: active ? "var(--color-primary, #0066FF)" : "var(--color-surface, #FFFFFF)",
                        color: active ? "#FFFFFF" : "var(--color-text-primary, #111111)",
                        cursor: "pointer",
                      }}
                    >
                      {dec}s
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Length Filters */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--color-text-secondary, #888888)" }}>
              ALBUM LENGTH
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {LENGTHS.map((len) => {
                const active = filters.length.has(len.key);
                return (
                  <button
                    key={len.key}
                    type="button"
                    onClick={() => toggleFilter("length", len.key)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      border: active ? "1px solid var(--color-primary, #0066FF)" : "1px solid var(--color-border, #E5E5E5)",
                      background: active ? "var(--color-primary, #0066FF)" : "var(--color-surface, #FFFFFF)",
                      color: active ? "#FFFFFF" : "var(--color-text-primary, #111111)",
                      cursor: "pointer",
                    }}
                  >
                    {len.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Top Genres (if available) */}
          {availableGenres.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--color-text-secondary, #888888)" }}>
                GENRE
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {availableGenres.map((g) => {
                  const active = filters.genre.has(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleFilter("genre", g)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        border: active ? "1px solid var(--color-primary, #0066FF)" : "1px solid var(--color-border, #E5E5E5)",
                        background: active ? "var(--color-primary, #0066FF)" : "var(--color-surface, #FFFFFF)",
                        color: active ? "#FFFFFF" : "var(--color-text-primary, #111111)",
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
