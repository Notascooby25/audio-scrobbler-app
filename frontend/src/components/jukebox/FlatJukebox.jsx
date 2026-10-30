import { useState } from "react";

export default function FlatJukebox({
  filteredAlbums = [],
  pool = [],
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
        border: "1px solid var(--color-border, #E5E5E5)",
        borderRadius: "12px",
        background: "var(--color-surface, #FFFFFF)",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--color-border, #E5E5E5)",
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
              background: "var(--color-primary, #0066FF)",
              color: "#FFFFFF",
              padding: "3px 8px",
              borderRadius: "4px",
            }}
          >
            Album Jukebox
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-primary, #111111)",
              marginLeft: "10px",
            }}
          >
            Lucky Dip Mode
          </span>
        </div>
        <span style={{ fontSize: "12px", color: "var(--color-text-secondary, #888888)" }}>
          <strong>{filteredAlbums.length}</strong> records available{" "}
          {mode !== "any" && `(pool: ${pool.length})`}
        </span>
      </div>

      <div
        style={{
          background: "var(--color-neutral-bg, #F7F7F7)",
          border: "1px solid var(--color-border, #E5E5E5)",
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
            border: "2px solid var(--color-border, #E5E5E5)",
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
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "var(--color-primary, #0066FF)",
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
              color: "var(--color-text-secondary, #888888)",
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {sessionActive ? `Lucky Dip Pick • ${mode}` : "Today's Featured Pick"}
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--color-text-primary, #111111)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: "2px",
            }}
          >
            {currentPick ? currentPick.album_name : "No Album Picked Yet"}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary, #666666)",
              marginTop: "2px",
            }}
          >
            {currentPick
              ? `${currentPick.artist_name} • ${currentPick.release_year || "Unknown Year"}`
              : "Select Lucky Dip to spin"}
          </div>
          {currentPick && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary, #888888)",
                marginTop: "4px",
              }}
            >
              {currentPick.play_count || 0} plays • Last picked:{" "}
              {currentPick.last_picked_at
                ? new Date(currentPick.last_picked_at).toLocaleDateString()
                : "Never"}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy || !canRoll}
          onClick={() => handleRoll(onLuckyDip)}
          style={{
            flex: 2,
            padding: "10px 16px",
            background: "var(--color-primary, #0066FF)",
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
          disabled={busy || !sessionActive || outOfRolls}
          onClick={() => handleRoll(onReroll)}
          style={{
            flex: 1,
            padding: "10px 12px",
            background: "var(--color-surface, #FFFFFF)",
            color: "var(--color-text-primary, #111111)",
            border: "1px solid var(--color-border, #E5E5E5)",
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
