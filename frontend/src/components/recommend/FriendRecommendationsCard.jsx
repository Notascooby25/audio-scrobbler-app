import React, { useState, useEffect } from "react";
import { fetchActiveRecommendations, updateRecommendationStatus } from "../../api";

export default function FriendRecommendationsCard({ token }) {
  const [recommendations, setRecommendations] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadRecommendations = () => {
    if (!token) return;
    fetchActiveRecommendations({ token })
      .then((data) => {
        setRecommendations(data || []);
        setCurrentIndex(0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadRecommendations();
  }, [token]);

  if (loading || !recommendations || recommendations.length === 0) {
    return null;
  }

  const current = recommendations[currentIndex] || recommendations[0];

  const handlePlayOnSpotify = async () => {
    const targetUrl = current.spotify_url || (current.spotify_uri ? `https://open.spotify.com/track/${current.spotify_uri.split(":").pop()}` : null);
    if (targetUrl) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
    try {
      await updateRecommendationStatus({
        token,
        recommendationId: current.id,
        status: "listened",
      });
      setRecommendations((prev) => prev.filter((r) => r.id !== current.id));
      if (currentIndex >= recommendations.length - 1) {
        setCurrentIndex(Math.max(0, recommendations.length - 2));
      }
    } catch {
      // Ignore failure to update
    }
  };

  const handleDismiss = async () => {
    try {
      await updateRecommendationStatus({
        token,
        recommendationId: current.id,
        status: "dismissed",
      });
      setRecommendations((prev) => prev.filter((r) => r.id !== current.id));
      if (currentIndex >= recommendations.length - 1) {
        setCurrentIndex(Math.max(0, recommendations.length - 2));
      }
    } catch {
      // Ignore failure
    }
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % recommendations.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + recommendations.length) % recommendations.length);
  };

  return (
    <section
      className="friend-recommendations-card"
      aria-label="Recommended by Friends"
      style={{
        background: "var(--color-surface, #1e1e1e)",
        border: "1px solid var(--color-border, #333)",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "1.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, textTransform: "none", color: "var(--color-text, #fff)" }}>
            Recommended by Friends
          </h2>
          <span
            style={{
              fontSize: "0.75rem",
              background: "var(--color-primary, #1db954)",
              color: "#000",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "12px",
            }}
          >
            {recommendations.length} New
          </span>
        </div>

        {recommendations.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", color: "var(--color-meta, #888)" }}>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous recommendation"
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "2px 4px" }}
            >
              &lt;
            </button>
            <span>
              {currentIndex + 1} of {recommendations.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next recommendation"
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "2px 4px" }}
            >
              &gt;
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "14px",
          alignItems: "center",
          background: "var(--color-surface-dim, rgba(255, 255, 255, 0.04))",
          padding: "12px",
          borderRadius: "6px",
        }}
      >
        {current.image_url ? (
          <img
            src={current.image_url}
            alt=""
            style={{ width: "56px", height: "56px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: "56px",
              height: "56px",
              background: "#333",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              color: "#aaa",
              flexShrink: 0,
            }}
          >
            MUSIC
          </div>
        )}

        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--color-primary, #1db954)", fontWeight: 600 }}>
            {current.sender_name || "A friend"} recommended:
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "var(--color-text, #fff)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {current.title}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--color-meta, #aaa)" }}>
            {current.artist_name} {current.album_name && current.album_name !== current.title && `• ${current.album_name}`}
          </div>
          {current.note && (
            <div style={{ fontSize: "0.8rem", color: "var(--color-meta-light, #ddd)", fontStyle: "italic", marginTop: "2px" }}>
              &ldquo;{current.note}&rdquo;
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handlePlayOnSpotify}
            className="button button-primary"
            style={{
              textTransform: "none",
              fontSize: "0.8rem",
              padding: "6px 12px",
              borderRadius: "20px",
            }}
          >
            Play on Spotify
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss recommendation"
            title="Dismiss"
            style={{
              background: "none",
              border: "none",
              color: "var(--color-meta, #777)",
              cursor: "pointer",
              fontSize: "1.2rem",
              padding: "4px 8px",
              lineHeight: 1,
              textTransform: "none",
            }}
          >
            &times;
          </button>
        </div>
      </div>
    </section>
  );
}
