import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
          receiver_id: Number(selectedUserId),
          item_type: item.itemType || "track",
          title: String(item.title || "").slice(0, 255),
          artist_name: String(item.artist || item.title || "").slice(0, 255),
          album_name: item.album ? String(item.album).slice(0, 255) : null,
          image_url: item.imageUrl || null,
          spotify_uri: item.spotifyUri || null,
          spotify_url: item.spotifyUrl || null,
          note: note.trim() ? note.trim().slice(0, 280) : null,
        },
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to send recommendation");
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recommend-modal-title"
      className="modal-backdrop"
      style={{ zIndex: 10000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog" style={{ maxWidth: "460px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2
            id="recommend-modal-title"
            style={{ margin: 0, fontSize: "1.15rem", color: "var(--color-ink)" }}
          >
            Recommend to a Friend
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-muted)",
              fontSize: "1.4rem",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
              textTransform: "none",
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div style={{ fontSize: "0.9rem", color: "var(--color-muted)", marginBottom: "14px" }}>
          Sharing <strong>{item.title}</strong>
          {item.artist && item.artist !== item.title ? ` by ${item.artist}` : ""}
        </div>

        {error && (
          <div
            style={{
              color: "var(--color-danger, #d32f2f)",
              background: "var(--color-danger-soft, #fde8e8)",
              padding: "8px 12px",
              borderRadius: "4px",
              fontSize: "0.85rem",
              marginBottom: "12px",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
            Loading followed users...
          </p>
        ) : following.length === 0 ? (
          <p style={{ color: "var(--color-muted)", fontSize: "0.9rem" }}>
            You aren&apos;t following anyone yet. Visit Profiles to find and follow friends first!
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-ink)",
                marginBottom: "6px",
              }}
            >
              Choose a friend:
            </label>
            <div
              style={{
                maxHeight: "150px",
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                marginBottom: "14px",
                background: "var(--color-canvas)",
              }}
            >
              {following.map((u) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    style={{
                      padding: "10px 12px",
                      cursor: "pointer",
                      background: isSelected
                        ? "var(--color-accent-soft, rgba(0, 102, 255, 0.1))"
                        : "transparent",
                      borderBottom: "1px solid var(--color-border-subtle, #eee)",
                      color: "var(--color-ink)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: isSelected ? 600 : 400, color: "var(--color-ink)" }}>
                      {u.display_name || u.username}
                    </span>
                    {isSelected && (
                      <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            <label
              htmlFor="recommend-note"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-ink)",
                marginBottom: "6px",
              }}
            >
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
                borderRadius: "6px",
                background: "var(--color-canvas)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-border)",
                marginBottom: "16px",
                resize: "vertical",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            />

            <div className="modal-actions" style={{ marginTop: 0 }}>
              <button type="button" onClick={onClose} className="modal-cancel-button">
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

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
