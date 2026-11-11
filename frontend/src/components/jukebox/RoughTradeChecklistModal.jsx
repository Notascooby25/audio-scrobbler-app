import { useEffect, useState, useMemo } from "react";
import Artwork from "../Artwork";

export default function RoughTradeChecklistModal({
  isOpen,
  onClose,
  albums = [],
  completedCount = 0,
  totalCount = 700,
  onToggleCompleted,
}) {
  const [selectedYear, setSelectedYear] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Extract years present in dataset, sorted descending (e.g. 2026 down to 2020)
  const years = useMemo(() => {
    const set = new Set();
    albums.forEach((a) => {
      const yr = a.year || a.release_year;
      if (yr) {
        set.add(Number(yr));
      }
    });
    const sorted = Array.from(set).sort((a, b) => b - a);
    return sorted.length > 0 ? sorted : [2026, 2025, 2024, 2023, 2022, 2021, 2020];
  }, [albums]);

  // Default selected year to "all" or most recent year
  useEffect(() => {
    if (selectedYear === null) {
      setSelectedYear("all");
    }
  }, [selectedYear]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const yearStats = useMemo(() => {
    const stats = {};
    years.forEach((yr) => {
      const inYear = albums.filter((a) => Number(a.year || a.release_year) === yr);
      const completed = inYear.filter((a) => a.is_completed).length;
      stats[yr] = {
        total: inYear.length,
        completed,
      };
    });
    return stats;
  }, [albums, years]);

  const displayedAlbums = useMemo(() => {
    return albums.filter((a) => {
      const yr = Number(a.year || a.release_year);
      if (selectedYear !== "all" && yr !== selectedYear) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = a.album_name && a.album_name.toLowerCase().includes(q);
        const matchesArtist = a.artist_name && a.artist_name.toLowerCase().includes(q);
        return matchesName || matchesArtist;
      }
      return true;
    });
  }, [albums, selectedYear, searchQuery]);

  if (!isOpen) return null;

  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-rough-trade-title"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "10px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "min(85vh, 90dvh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>🎸</span>
              <h2
                id="modal-rough-trade-title"
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Rough Trade Top 100 Progress
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "transparent",
                border: "none",
                fontSize: "18px",
                lineHeight: 1,
                cursor: "pointer",
                color: "var(--color-muted)",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Progress bar & stats */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-muted)",
                marginBottom: "6px",
              }}
            >
              <span>Total Completed</span>
              <span style={{ color: "var(--color-ink)" }}>
                {completedCount} / {totalCount} ({pct}%)
              </span>
            </div>
            <div
              style={{
                height: "8px",
                width: "100%",
                background: "var(--color-border)",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "var(--color-primary)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* Year Selector Tabs */}
        <div
          style={{
            padding: "10px 16px",
            background: "var(--color-surface-hover, var(--color-canvas))",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedYear("all")}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              border:
                selectedYear === "all"
                  ? "1px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
              background: selectedYear === "all" ? "var(--color-primary)" : "var(--color-surface)",
              color: selectedYear === "all" ? "#FFFFFF" : "var(--color-ink)",
              cursor: "pointer",
            }}
          >
            All Years ({completedCount}/{totalCount})
          </button>
          {years.map((yr) => {
            const active = selectedYear === yr;
            const stats = yearStats[yr] || { completed: 0, total: 0 };
            const label = `${yr} (${stats.completed}/${stats.total})`;
            return (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: active
                    ? "1px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                  background: active ? "var(--color-primary)" : "var(--color-surface)",
                  color: active ? "#FFFFFF" : "var(--color-ink)",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search Input Filter */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)" }}>
          <input
            type="text"
            placeholder={
              selectedYear === "all"
                ? "Search all Rough Trade albums..."
                : `Search albums in ${selectedYear}...`
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              fontSize: "12px",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Album List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {displayedAlbums.length === 0 ? (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                color: "var(--color-muted)",
                fontSize: "13px",
              }}
            >
              No albums match the search.
            </div>
          ) : (
            displayedAlbums.map((album) => (
              <div
                key={album.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  background: album.is_completed
                    ? "var(--color-surface-hover, var(--color-canvas))"
                    : "transparent",
                  border: "1px solid var(--color-border)",
                }}
              >
                <input
                  type="checkbox"
                  id={`rt-album-chk-${album.id}`}
                  aria-label={album.album_name}
                  checked={Boolean(album.is_completed)}
                  onChange={(e) => onToggleCompleted?.(album.id, e.target.checked)}
                  style={{
                    cursor: "pointer",
                    width: "16px",
                    height: "16px",
                    flexShrink: 0,
                  }}
                />

                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    flexShrink: 0,
                    overflow: "hidden",
                    borderRadius: "4px",
                  }}
                >
                  <Artwork
                    src={album.artwork_url}
                    label={album.album_name}
                    className="jukebox-checklist-thumb"
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <label
                    htmlFor={`rt-album-chk-${album.id}`}
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--color-ink)",
                      cursor: "pointer",
                      textDecoration: album.is_completed ? "line-through" : "none",
                      wordBreak: "break-word",
                      lineHeight: 1.3,
                    }}
                  >
                    {album.rank ? `#${album.rank} • ` : ""}
                    {album.album_name}
                  </label>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--color-muted)",
                      wordBreak: "break-word",
                      lineHeight: 1.3,
                      marginTop: "2px",
                    }}
                  >
                    {album.artist_name} • {album.year}
                  </div>
                </div>

                {album.spotify_url && (
                  <a
                    href={album.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--color-primary)",
                      textDecoration: "none",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      flexShrink: 0,
                    }}
                  >
                    Open ↗
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
