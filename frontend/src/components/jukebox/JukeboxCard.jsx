import { useEffect, useState } from "react";
import { fetchJukeboxAlbums, recordJukeboxPick } from "../../api";
import FlatJukebox from "./FlatJukebox";
import RetroJukebox from "./RetroJukebox";
import { useJukeboxEngine } from "./useJukeboxEngine";

export default function JukeboxCard({ token }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem("jukebox_theme_mode") || "flat"
  );
  const [error, setError] = useState("");

  const engine = useJukeboxEngine(albums);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchJukeboxAlbums({ token })
      .then((data) => {
        setAlbums(data.albums || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load albums");
        setLoading(false);
      });
  }, [token]);

  const toggleThemeMode = () => {
    const next = themeMode === "flat" ? "arcade" : "flat";
    setThemeMode(next);
    localStorage.setItem("jukebox_theme_mode", next);
  };

  const handleRollCommit = () => {
    engine.commitSession();
    if (engine.currentPick) {
      recordJukeboxPick({ token, albumId: engine.currentPick.id, mode: engine.mode }).catch(
        () => {}
      );
    }
  };

  if (loading) {
    return (
      <div
        style={{
          border: "1px solid var(--color-border, #E5E5E5)",
          borderRadius: "12px",
          padding: "16px",
          background: "var(--color-surface, #FFFFFF)",
          color: "var(--color-text-secondary, #888888)",
          fontSize: "13px",
        }}
      >
        Loading Album Jukebox...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          border: "1px solid var(--color-border, #E5E5E5)",
          borderRadius: "12px",
          padding: "16px",
          background: "var(--color-surface, #FFFFFF)",
          color: "var(--color-text-secondary, #888888)",
          fontSize: "13px",
          marginBottom: "24px",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--color-text-primary, #111111)" }}>Album Jukebox: </span>
        {error}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
        <button
          type="button"
          onClick={toggleThemeMode}
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: "999px",
            border: "1px solid var(--color-border, #E5E5E5)",
            background: themeMode === "arcade" ? "#ff9a83" : "var(--color-surface, #FFFFFF)",
            color: themeMode === "arcade" ? "#394651" : "var(--color-text-primary, #111111)",
            cursor: "pointer",
          }}
        >
          {themeMode === "flat" ? "🕹️ Switch to Arcade View" : "⚡ Switch to Flat View"}
        </button>
      </div>

      {themeMode === "flat" ? (
        <FlatJukebox
          filteredAlbums={engine.filteredAlbums}
          pool={engine.pool}
          currentPick={engine.currentPick}
          rollsLeft={engine.rollsLeft}
          sessionActive={engine.sessionActive}
          canRoll={engine.canRoll}
          busy={engine.busy}
          mode={engine.mode}
          setMode={engine.setMode}
          onLuckyDip={engine.luckyDip}
          onReroll={engine.reroll}
          onCommit={handleRollCommit}
        />
      ) : (
        <RetroJukebox
          filteredAlbums={engine.filteredAlbums}
          pool={engine.pool}
          currentPick={engine.currentPick}
          rollsLeft={engine.rollsLeft}
          sessionActive={engine.sessionActive}
          canRoll={engine.canRoll}
          busy={engine.busy}
          mode={engine.mode}
          setMode={engine.setMode}
          onLuckyDip={engine.luckyDip}
          onReroll={engine.reroll}
          onCommit={handleRollCommit}
        />
      )}
    </div>
  );
}
