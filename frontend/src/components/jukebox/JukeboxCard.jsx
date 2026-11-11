import { useEffect, useState } from "react";
import {
  fetch1001Albums,
  fetchJukeboxAlbums,
  fetchRoughTradeAlbums,
  likeAlbum,
  record1001PendingPlay,
  dismiss1001PendingPlay,
  recordRoughTradePendingPlay,
  dismissRoughTradePendingPlay,
  recordJukeboxPick,
  toggle1001AlbumCompleted,
  toggleRoughTradeAlbumCompleted,
  unlikeAlbum,
} from "../../api";
import Albums1001ChecklistModal from "./1001AlbumsChecklistModal";
import RoughTradeChecklistModal from "./RoughTradeChecklistModal";
import FlatJukebox from "./FlatJukebox";
import RetroJukebox from "./RetroJukebox";
import { useJukeboxEngine } from "./useJukeboxEngine";

export default function JukeboxCard({ token }) {
  const [sourceMode, setSourceMode] = useState("library"); // "library" | "1001" | "rough_trade"
  const [libraryAlbums, setLibraryAlbums] = useState([]);
  const [albums1001, setAlbums1001] = useState([]);
  const [completed1001Count, setCompleted1001Count] = useState(0);
  const [total1001Count, setTotal1001Count] = useState(1001);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  // Rough Trade state
  const [roughTradeAlbums, setRoughTradeAlbums] = useState([]);
  const [completedRoughTradeCount, setCompletedRoughTradeCount] = useState(0);
  const [totalRoughTradeCount, setTotalRoughTradeCount] = useState(700);
  const [roughTradePendingConfirmation, setRoughTradePendingConfirmation] = useState(null);
  const [isRoughTradeChecklistOpen, setIsRoughTradeChecklistOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem("jukebox_theme_mode") || "flat"
  );
  const [error, setError] = useState("");
  const [liking, setLiking] = useState(false);

  const activeAlbums =
    sourceMode === "1001"
      ? albums1001
      : sourceMode === "rough_trade"
        ? roughTradeAlbums
        : libraryAlbums;
  const engine = useJukeboxEngine(activeAlbums);

  const handleToggleLike = async (pick) => {
    if (!token || !pick) return;
    const wasLiked = Boolean(pick.is_liked);
    const nextLiked = !wasLiked;
    const albumIdentifier = pick.spotify_album_id || pick.album_name;

    setLiking(true);
    if (engine.setCurrentPick) {
      engine.setCurrentPick((prev) => (prev ? { ...prev, is_liked: nextLiked } : prev));
    }
    setLibraryAlbums((prev) =>
      prev.map((a) => (a.id === pick.id ? { ...a, is_liked: nextLiked } : a))
    );

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
      setLibraryAlbums((prev) =>
        prev.map((a) => (a.id === pick.id ? { ...a, is_liked: wasLiked } : a))
      );
    } finally {
      setLiking(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchJukeboxAlbums({ token })
      .then((data) => {
        setLibraryAlbums(data.albums || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load albums");
        setLoading(false);
      });
  }, [token]);

  const handleSwitchSource = async (nextMode) => {
    if (nextMode === sourceMode) return;
    setSourceMode(nextMode);
    if (engine.setSourceMode) {
      engine.setSourceMode(nextMode);
    }
    if (nextMode === "1001" && albums1001.length === 0) {
      setLoading(true);
      try {
        const data = await fetch1001Albums({ token });
        setAlbums1001(data.albums || []);
        setCompleted1001Count(data.completed_count || 0);
        setTotal1001Count(data.total_albums || 1001);
        if (data.pending_confirmation) {
          setPendingConfirmation(data.pending_confirmation);
        }
      } catch (err) {
        setError(err.message || "Failed to load 1001 albums");
      } finally {
        setLoading(false);
      }
    } else if (nextMode === "rough_trade" && roughTradeAlbums.length === 0) {
      setLoading(true);
      try {
        const data = await fetchRoughTradeAlbums({ token });
        setRoughTradeAlbums(data.albums || []);
        setCompletedRoughTradeCount(data.completed_count || 0);
        setTotalRoughTradeCount(data.total_albums || 700);
        if (data.pending_confirmation) {
          setRoughTradePendingConfirmation(data.pending_confirmation);
        }
      } catch (err) {
        setError(err.message || "Failed to load Rough Trade albums");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleConfirmPendingPlay = async () => {
    if (!pendingConfirmation) return;
    const albumId = pendingConfirmation.album_id;
    try {
      await toggle1001AlbumCompleted({
        token,
        albumId,
        isCompleted: true,
        source: "confirmation_prompt",
      });
      setAlbums1001((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, is_completed: true } : a))
      );
      setCompleted1001Count((c) => c + 1);
      setPendingConfirmation(null);
    } catch {
      // ignore
    }
  };

  const handleDismissPendingPlay = async () => {
    if (!pendingConfirmation) return;
    try {
      await dismiss1001PendingPlay({ token, albumId: pendingConfirmation.album_id });
      setPendingConfirmation(null);
    } catch {
      // ignore
    }
  };

  const handleToggle1001Completed = async (albumId, isCompleted) => {
    try {
      const res = await toggle1001AlbumCompleted({
        token,
        albumId,
        isCompleted,
        source: isCompleted ? "manual" : "manual_unmark",
      });
      setAlbums1001((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, is_completed: isCompleted } : a))
      );
      if (typeof res.completed_count === "number") {
        setCompleted1001Count(res.completed_count);
      } else {
        setCompleted1001Count((c) => (isCompleted ? c + 1 : Math.max(0, c - 1)));
      }
      if (pendingConfirmation && pendingConfirmation.album_id === albumId) {
        setPendingConfirmation(null);
      }
    } catch {
      // ignore
    }
  };

  const handleConfirmRoughTradePendingPlay = async () => {
    if (!roughTradePendingConfirmation) return;
    const albumId = roughTradePendingConfirmation.album_id;
    try {
      await toggleRoughTradeAlbumCompleted({
        token,
        albumId,
        isCompleted: true,
        source: "confirmation_prompt",
      });
      setRoughTradeAlbums((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, is_completed: true } : a))
      );
      setCompletedRoughTradeCount((c) => c + 1);
      setRoughTradePendingConfirmation(null);
    } catch {
      // ignore
    }
  };

  const handleDismissRoughTradePendingPlay = async () => {
    if (!roughTradePendingConfirmation) return;
    try {
      await dismissRoughTradePendingPlay({
        token,
        albumId: roughTradePendingConfirmation.album_id,
      });
      setRoughTradePendingConfirmation(null);
    } catch {
      // ignore
    }
  };

  const handleToggleRoughTradeCompleted = async (albumId, isCompleted) => {
    try {
      const res = await toggleRoughTradeAlbumCompleted({
        token,
        albumId,
        isCompleted,
        source: isCompleted ? "manual" : "manual_unmark",
      });
      setRoughTradeAlbums((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, is_completed: isCompleted } : a))
      );
      if (typeof res.completed_count === "number") {
        setCompletedRoughTradeCount(res.completed_count);
      } else {
        setCompletedRoughTradeCount((c) => (isCompleted ? c + 1 : Math.max(0, c - 1)));
      }
      if (roughTradePendingConfirmation && roughTradePendingConfirmation.album_id === albumId) {
        setRoughTradePendingConfirmation(null);
      }
    } catch {
      // ignore
    }
  };

  const toggleThemeMode = () => {
    const next = themeMode === "flat" ? "arcade" : "flat";
    setThemeMode(next);
    localStorage.setItem("jukebox_theme_mode", next);
  };

  const handleRollCommit = () => {
    engine.commitSession();
    if (engine.currentPick) {
      if (sourceMode === "1001") {
        record1001PendingPlay({ token, albumId: engine.currentPick.id }).catch(() => {});
      } else if (sourceMode === "rough_trade") {
        recordRoughTradePendingPlay({ token, albumId: engine.currentPick.id }).catch(() => {});
      } else {
        recordJukeboxPick({ token, albumId: engine.currentPick.id, mode: engine.mode }).catch(
          () => {}
        );
      }
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

  const completionPct =
    total1001Count > 0 ? Math.round((completed1001Count / total1001Count) * 100) : 0;

  const roughTradeCompletionPct =
    totalRoughTradeCount > 0
      ? Math.round((completedRoughTradeCount / totalRoughTradeCount) * 100)
      : 0;

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Top Header Bar: Source Selector & Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {/* Source Switcher */}
        <div
          className="jukebox-source-tabs"
          style={{
            display: "inline-flex",
            background: "var(--color-surface-hover, var(--color-canvas))",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "3px",
          }}
        >
          <button
            type="button"
            className={`jukebox-source-tab-btn ${sourceMode === "library" ? "active" : ""}`}
            onClick={() => handleSwitchSource("library")}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              background: sourceMode === "library" ? "var(--color-surface)" : "transparent",
              color: sourceMode === "library" ? "var(--color-ink)" : "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            🎧 My Library
          </button>
          <button
            type="button"
            className={`jukebox-source-tab-btn ${sourceMode === "1001" ? "active" : ""}`}
            onClick={() => handleSwitchSource("1001")}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              background: sourceMode === "1001" ? "var(--color-surface)" : "transparent",
              color: sourceMode === "1001" ? "var(--color-ink)" : "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            📖 1001 Albums
          </button>
          <button
            type="button"
            className={`jukebox-source-tab-btn ${sourceMode === "rough_trade" ? "active" : ""}`}
            onClick={() => handleSwitchSource("rough_trade")}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              background: sourceMode === "rough_trade" ? "var(--color-surface)" : "transparent",
              color: sourceMode === "rough_trade" ? "var(--color-ink)" : "var(--color-muted)",
              cursor: "pointer",
            }}
          >
            🎸 Rough Trade Top 100
          </button>
        </div>

        {/* Right side controls: Progress bar button (1001 & Rough Trade mode) and Theme view switch */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {sourceMode === "1001" && (
            <button
              type="button"
              onClick={() => setIsChecklistOpen(true)}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>
                Progress: {completed1001Count} / {total1001Count} ({completionPct}%)
              </span>
              <span style={{ color: "var(--color-primary)" }}>↗</span>
            </button>
          )}

          {sourceMode === "rough_trade" && (
            <button
              type="button"
              onClick={() => setIsRoughTradeChecklistOpen(true)}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>
                Progress: {completedRoughTradeCount} / {totalRoughTradeCount} (
                {roughTradeCompletionPct}%)
              </span>
              <span style={{ color: "var(--color-primary)" }}>↗</span>
            </button>
          )}

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
      </div>

      {/* Confirmation prompt banner (1001 Albums mode) */}
      {sourceMode === "1001" && pendingConfirmation && (
        <div
          role="region"
          aria-label="Album listen confirmation"
          style={{
            background: "var(--color-surface-hover, var(--color-canvas))",
            border: "1px solid var(--color-primary)",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-primary)" }}>
              🎧 DID YOU LISTEN TO THIS ALBUM?
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-ink)",
                marginTop: "2px",
              }}
            >
              {pendingConfirmation.album_name}{" "}
              <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>
                by {pendingConfirmation.artist_name}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleConfirmPendingPlay}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "var(--color-primary)",
                color: "#FFFFFF",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✓ Yes, mark played
            </button>
            <button
              type="button"
              onClick={handleDismissPendingPlay}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "transparent",
                color: "var(--color-muted)",
                border: "1px solid var(--color-border)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ Not yet
            </button>
          </div>
        </div>
      )}

      {/* Confirmation prompt banner (Rough Trade mode) */}
      {sourceMode === "rough_trade" && roughTradePendingConfirmation && (
        <div
          role="region"
          aria-label="Rough Trade album listen confirmation"
          style={{
            background: "var(--color-surface-hover, var(--color-canvas))",
            border: "1px solid var(--color-primary)",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--color-primary)" }}>
              🎧 DID YOU LISTEN TO THIS ALBUM?
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-ink)",
                marginTop: "2px",
              }}
            >
              {roughTradePendingConfirmation.album_name}{" "}
              <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>
                by {roughTradePendingConfirmation.artist_name}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleConfirmRoughTradePendingPlay}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "var(--color-primary)",
                color: "#FFFFFF",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✓ Yes, mark played
            </button>
            <button
              type="button"
              onClick={handleDismissRoughTradePendingPlay}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "transparent",
                color: "var(--color-muted)",
                border: "1px solid var(--color-border)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ Not yet
            </button>
          </div>
        </div>
      )}

      {/* Jukebox Display */}
      {themeMode === "flat" ? (
        <FlatJukebox
          albums={activeAlbums}
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
          sourceMode={sourceMode}
          excludeCompleted={engine.excludeCompleted}
          setExcludeCompleted={engine.setExcludeCompleted}
          onToggle1001Completed={handleToggle1001Completed}
          onToggleRoughTradeCompleted={handleToggleRoughTradeCompleted}
        />
      ) : (
        <RetroJukebox
          albums={activeAlbums}
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
          sourceMode={sourceMode}
          excludeCompleted={engine.excludeCompleted}
          setExcludeCompleted={engine.setExcludeCompleted}
          onToggle1001Completed={handleToggle1001Completed}
          onToggleRoughTradeCompleted={handleToggleRoughTradeCompleted}
        />
      )}

      {/* 1001 Checklist Modal */}
      <Albums1001ChecklistModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        albums={albums1001}
        completedCount={completed1001Count}
        totalCount={total1001Count}
        onToggleCompleted={handleToggle1001Completed}
      />

      {/* Rough Trade Checklist Modal */}
      <RoughTradeChecklistModal
        isOpen={isRoughTradeChecklistOpen}
        onClose={() => setIsRoughTradeChecklistOpen(false)}
        albums={roughTradeAlbums}
        completedCount={completedRoughTradeCount}
        totalCount={totalRoughTradeCount}
        onToggleCompleted={handleToggleRoughTradeCompleted}
      />
    </div>
  );
}
