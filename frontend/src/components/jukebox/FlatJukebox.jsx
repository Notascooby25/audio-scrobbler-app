import { useEffect, useState } from "react";
import LikedHeart from "../LikedHeart";
import JukeboxFilters from "./JukeboxFilters";

export default function FlatJukebox({
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
  onToggleLike,
  liking = false,
  sourceMode = "library",
  excludeCompleted = false,
  setExcludeCompleted,
  onToggle1001Completed,
}) {
  const [spinning, setSpinning] = useState(false);
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    setArtFailed(false);
  }, [currentPick?.id, currentPick?.artwork_url]);

  const handleRoll = (actionFn) => {
    if (busy || !canRoll) return;
    setSpinning(true);
    setTimeout(() => {
      setSpinning(false);
      actionFn();
    }, 450);
  };

  const outOfRolls = sessionActive && rollsLeft === 0;
  const spotifyLink =
    currentPick?.spotify_url ||
    (currentPick
      ? `https://open.spotify.com/search/${encodeURIComponent(currentPick.artist_name + " " + currentPick.album_name)}`
      : "#");

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        background: "var(--color-surface)",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "12px",
          marginBottom: "16px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              background: "var(--color-primary)",
              color: "#FFFFFF",
              padding: "3px 8px",
              borderRadius: "4px",
            }}
          >
            {sourceMode === "1001" ? "1001 Albums" : "Album Jukebox"}
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-ink)",
              marginLeft: "10px",
            }}
          >
            Lucky Dip Mode
          </span>
        </div>
        <span style={{ fontSize: "12px", color: "var(--color-muted)" }}>
          <strong>{filteredAlbums.length}</strong> records available{" "}
          {mode !== "any" && sourceMode !== "1001" && `(pool: ${pool.length})`}
        </span>
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
      />

      <div
        className="flat-jukebox-pick-card"
        style={{
          background: "var(--color-surface-hover, var(--color-canvas))",
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "88px",
            height: "88px",
            borderRadius: "50%",
            background: "#111111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "2px solid var(--color-border)",
            transform: spinning ? "rotate(720deg)" : "none",
            transition: "transform 0.45s cubic-bezier(0.2, 0.8, 0.3, 1)",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              border: "1px dashed #333333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {currentPick?.artwork_url && !artFailed ? (
              <img
                src={currentPick.artwork_url}
                alt={currentPick.album_name}
                onError={() => setArtFailed(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "var(--color-primary)",
                  color: "#FFFFFF",
                  fontSize: "9px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                LP
              </div>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              background: "#FFFFFF",
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-muted)",
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {sessionActive
              ? `Lucky Dip Pick • ${sourceMode === "1001" ? "1001 Albums" : mode}`
              : "Today's Featured Pick"}
          </div>

          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--color-ink)",
              wordBreak: "break-word",
              lineHeight: 1.25,
              marginTop: "2px",
            }}
          >
            {currentPick ? currentPick.album_name : "No Album Picked Yet"}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "6px",
              marginTop: "4px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                color: "var(--color-muted)",
                wordBreak: "break-word",
                lineHeight: 1.3,
              }}
            >
              {currentPick
                ? `${currentPick.artist_name} • ${currentPick.release_year || "Unknown Year"}`
                : "Select Lucky Dip to spin"}
            </div>

            {sourceMode === "1001" && currentPick && (
              <button
                type="button"
                onClick={() =>
                  onToggle1001Completed &&
                  onToggle1001Completed(currentPick.id, !currentPick.is_completed)
                }
                style={{
                  background: currentPick.is_completed
                    ? "var(--color-primary)"
                    : "var(--color-surface)",
                  color: currentPick.is_completed ? "#FFFFFF" : "var(--color-ink)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "4px",
                  padding: "3px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                aria-label={`Mark ${currentPick.album_name} as ${
                  currentPick.is_completed ? "unplayed" : "played"
                }`}
              >
                {currentPick.is_completed ? "✓ Played" : "Mark Played"}
              </button>
            )}

            {sourceMode !== "1001" && currentPick && (
              <LikedHeart
                liked={Boolean(currentPick.is_liked)}
                interactive={Boolean(onToggleLike)}
                label={currentPick.album_name}
                busy={liking}
                onToggle={onToggleLike ? () => onToggleLike(currentPick) : undefined}
              />
            )}
          </div>
          {currentPick && sourceMode !== "1001" && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                marginTop: "4px",
              }}
            >
              {currentPick.play_count || 0} plays • Last picked:{" "}
              {currentPick.last_picked_at
                ? new Date(currentPick.last_picked_at).toLocaleDateString()
                : "Never"}
            </div>
          )}
          {currentPick && sourceMode === "1001" && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-muted)",
                marginTop: "4px",
              }}
            >
              Decade: {currentPick.decade ? `${currentPick.decade}s` : "Unknown"}
              {currentPick.genres &&
                currentPick.genres.length > 0 &&
                ` • ${currentPick.genres.join(", ")}`}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="jukebox-action-primary"
          disabled={busy || !canRoll}
          onClick={() => handleRoll(onLuckyDip)}
          style={{
            flex: 2,
            padding: "10px 16px",
            background: "var(--color-primary)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: busy || !canRoll ? "not-allowed" : "pointer",
            opacity: busy || !canRoll ? 0.5 : 1,
          }}
        >
          🎲 Lucky Dip (Spin)
        </button>
        <button
          type="button"
          className="jukebox-action-reroll"
          disabled={busy || !sessionActive || outOfRolls}
          onClick={() => handleRoll(onReroll)}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-border)",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "13px",
            cursor: busy || !sessionActive || outOfRolls ? "not-allowed" : "pointer",
            opacity: busy || !sessionActive || outOfRolls ? 0.5 : 1,
          }}
        >
          Re-roll ({rollsLeft} left)
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
            padding: "10px 14px",
            background: "#1DB954",
            color: "#FFFFFF",
            textDecoration: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          Open in Spotify ↗
        </a>
      </div>

      {outOfRolls && (
        <div
          style={{
            marginTop: "10px",
            fontSize: "12px",
            color: "#E11D48",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          No more rolls – give it a spin on Spotify!
        </div>
      )}
    </div>
  );
}
