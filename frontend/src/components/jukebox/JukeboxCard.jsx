import { useEffect, useState } from "react";
import { fetchJukeboxAlbums, likeAlbum, recordJukeboxPick, unlikeAlbum } from "../../api";
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
  const [liking, setLiking] = useState(false);

  const engine = useJukeboxEngine(albums);

  const handleToggleLike = async (pick) => {
    if (!token || !pick) return;
    const wasLiked = Boolean(pick.is_liked);
    const nextLiked = !wasLiked;
    const albumIdentifier = pick.spotify_album_id || pick.album_name;

    setLiking(true);
    if (engine.setCurrentPick) {
      engine.setCurrentPick((prev) => (prev ? { ...prev, is_liked: nextLiked } : prev));
    }
    setAlbums((prev) => prev.map((a) => (a.id === pick.id ? { ...a, is_liked: nextLiked } : a)));

    try {
      if (wasLiked) {
        await unlikeAlbum({ token, albumId: albumIdentifier });
      } else {
        await likeAlbum({
          token,
          albumId: albumIdentifier,
          payload: {
            album_name: pick.album_name,
            artist_name: pick.artist_name,
            artwork_url: pick.artwork_url || undefined,
          },
        });
      }
    } catch {
      if (engine.setCurrentPick) {
        engine.setCurrentPick((prev) => (prev ? { ...prev, is_liked: wasLiked } : prev));
      }
      setAlbums((prev) => prev.map((a) => (a.id === pick.id ? { ...a, is_liked: wasLiked } : a)));
    } finally {
      setLiking(false);
    }
  };

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
        <span style={{ fontWeight: 600, color: "var(--color-text-primary, #111111)" }}>
          Album Jukebox:{" "}
        </span>
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
            fontSize: "12px",
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: "999px",
            border: "1px solid var(--color-border)",
            background: themeMode === "arcade" ? "#ff9a83" : "var(--color-surface)",
            color: themeMode === "arcade" ? "#394651" : "var(--color-ink)",
            cursor: "pointer",
          }}
        >
          {themeMode === "flat" ? "🕹️ Switch to Arcade View" : "⚡ Switch to Flat View"}
        </button>
      </div>

      {themeMode === "flat" ? (
        <FlatJukebox
          albums={albums}
          filteredAlbums={engine.filteredAlbums}
          pool={engine.pool}
          currentPick={engine.currentPick}
          rollsLeft={engine.rollsLeft}
          sessionActive={engine.sessionActive}
          canRoll={engine.canRoll}
          busy={engine.busy}
          mode={engine.mode}
          setMode={engine.setMode}
          filters={engine.filters}
          toggleFilter={engine.toggleFilter}
          clearFilters={engine.clearFilters}
          onLuckyDip={engine.luckyDip}
          onReroll={engine.reroll}
          onCommit={handleRollCommit}
          onToggleLike={handleToggleLike}
          liking={liking}
        />
      ) : (
        <RetroJukebox
          albums={albums}
          filteredAlbums={engine.filteredAlbums}
          pool={engine.pool}
          currentPick={engine.currentPick}
          rollsLeft={engine.rollsLeft}
          sessionActive={engine.sessionActive}
          canRoll={engine.canRoll}
          busy={engine.busy}
          mode={engine.mode}
          setMode={engine.setMode}
          filters={engine.filters}
          toggleFilter={engine.toggleFilter}
          clearFilters={engine.clearFilters}
          onLuckyDip={engine.luckyDip}
          onReroll={engine.reroll}
          onCommit={handleRollCommit}
        />
      )}
    </div>
  );
}
