import React, { useEffect, useState } from "react";
import { shareScrobbles } from "../../api";
import { readSession } from "../../session";

const fieldStyle = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  border: "0.5px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontSize: "0.9rem",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  fontSize: "0.85rem",
  color: "var(--color-ink)",
};

export default function ShareScrobblesModal({ userId, username, onClose }) {
  const token = readSession()?.accessToken;
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [errorMsg, setErrorMsg] = useState("");
  const [sharedCount, setSharedCount] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && status !== "loading") {
        event.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [status, onClose]);

  const handleShare = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      setStatus("error");
      setErrorMsg("The end time must be after the start time.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await shareScrobbles({
        token,
        userId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      if (res.shared_count === undefined) {
        throw new Error(res.error || "Failed to share scrobbles");
      }
      setSharedCount(res.shared_count);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "An error occurred");
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== "loading") onClose();
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-scrobbles-title"
      >
        <h3
          id="share-scrobbles-title"
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            margin: "0 0 0.75rem",
            color: "var(--color-ink)",
          }}
        >
          Share Scrobbles
        </h3>

        {status === "success" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {sharedCount > 0 ? (
              <p style={{ margin: 0, color: "var(--color-ink)" }}>
                Added <strong>{sharedCount}</strong> {sharedCount === 1 ? "scrobble" : "scrobbles"}{" "}
                to @{username}&apos;s history. They will get a notification.
              </p>
            ) : (
              <p style={{ margin: 0, color: "var(--color-ink)" }}>
                Nothing new to add. You have no scrobbles in that period, or @{username} already has
                them all.
              </p>
            )}
            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleShare}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-muted)" }}>
              Pick a time range when you were listening together. Your scrobbles from that period
              will be added to @{username}&apos;s history. Any they already have will be safely
              skipped.
            </p>

            <label htmlFor="share-start-date" style={labelStyle}>
              Start Time
              <input
                id="share-start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={fieldStyle}
              />
            </label>

            <label htmlFor="share-end-date" style={labelStyle}>
              End Time
              <input
                id="share-end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                style={fieldStyle}
              />
            </label>

            {status === "error" && (
              <div
                className="notice notice-error"
                role="alert"
                style={{
                  margin: 0,
                  padding: "0.75rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-danger-soft)",
                  color: "var(--color-danger)",
                  fontSize: "0.85rem",
                }}
              >
                {errorMsg}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                onClick={onClose}
                disabled={status === "loading"}
                className="modal-cancel-button"
              >
                Cancel
              </button>
              <button type="submit" disabled={status === "loading" || !startDate || !endDate}>
                {status === "loading" ? "Sharing..." : "Share Scrobbles"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
