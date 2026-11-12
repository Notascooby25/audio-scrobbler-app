import React, { useState, useEffect } from "react";
import { fetchFollowing, sendRecommendation } from "../../api";

export default function RecommendModal({ token, item, onClose }) {
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchFollowing({ token })
      .then((res) => {
        if (!active) return;
        setFollowing(res.results || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load following list");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendRecommendation({
        token,
        payload: {
          receiver_id: selectedUserId,
          item_type: item.itemType || "track",
          title: item.title,
          artist_name: item.artist,
          album_name: item.album || null,
          image_url: item.imageUrl || null,
          spotify_uri: item.spotifyUri || null,
          spotify_url: item.spotifyUrl || null,
          note: note.trim() || null,
        },
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to send recommendation");
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recommend-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--color-bg, #1a1a1a)",
          border: "1px solid var(--color-border, #333)",
          borderRadius: "8px",
          width: "100%",
          maxWidth: "460px",
          padding: "20px",
          boxSizing: "border-box",
          color: "var(--color-text, #fff)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 id="recommend-modal-title" style={{ margin: 0, fontSize: "1.1rem" }}>
            Recommend to a Friend
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-meta, #888)",
              fontSize: "1.2rem",
              cursor: "pointer",
              padding: "4px 8px",
              textTransform: "none",
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div style={{ fontSize: "0.9rem", color: "var(--color-meta, #aaa)", marginBottom: "14px" }}>
          Sharing <strong>{item.title}</strong> by <strong>{item.artist}</strong>
        </div>

        {error && (
          <div style={{ color: "#e53935", fontSize: "0.85rem", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--color-meta, #888)", fontSize: "0.9rem" }}>Loading followed users...</p>
        ) : following.length === 0 ? (
          <p style={{ color: "var(--color-meta, #888)", fontSize: "0.9rem" }}>
            You aren&apos;t following anyone yet. Visit Profiles to find and follow friends first!
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
              Choose a friend:
            </label>
            <div
              style={{
                maxHeight: "150px",
                overflowY: "auto",
                border: "1px solid var(--color-border, #333)",
                borderRadius: "4px",
                marginBottom: "14px",
              }}
            >
              {following.map((u) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      background: isSelected ? "var(--color-primary-dim, #2a3b2a)" : "transparent",
                      borderBottom: "1px solid var(--color-border, #222)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{u.display_name || u.username}</span>
                    {isSelected && <span style={{ color: "var(--color-primary, #4caf50)" }}>✓</span>}
                  </div>
                );
              })}
            </div>

            <label htmlFor="recommend-note" style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
              Add a note (optional):
            </label>
            <textarea
              id="recommend-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for your friend..."
              maxLength={280}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px",
                borderRadius: "4px",
                background: "var(--color-surface, #222)",
                color: "var(--color-text, #fff)",
                border: "1px solid var(--color-border, #444)",
                marginBottom: "16px",
                resize: "vertical",
                fontSize: "0.9rem",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={onClose}
                className="button button-ghost"
                style={{ textTransform: "none" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedUserId || submitting}
                className="button button-primary"
                style={{ textTransform: "none" }}
              >
                {submitting ? "Sending..." : "Send Recommendation"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
