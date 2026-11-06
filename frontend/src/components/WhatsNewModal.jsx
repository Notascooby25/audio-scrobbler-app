import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CHANGELOG } from "../changelogData";

export default function WhatsNewModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const latestRelease = CHANGELOG[0] || { version: "0.32.0", date: "", changes: [] };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div className="modal-backdrop" data-testid="whats-new-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal-dialog whats-new-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        <div className="whats-new-header">
          <div className="whats-new-title-group">
            <h3 id="whats-new-title" className="whats-new-title">
              What's New in v{latestRelease.version}
            </h3>
            {latestRelease.date && <span className="whats-new-date">{latestRelease.date}</span>}
          </div>
          <button
            type="button"
            className="whats-new-close-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="whats-new-body">
          <ul className="whats-new-list">
            {latestRelease.changes.map((change, index) => (
              <li key={index} className="whats-new-item">
                {change}
              </li>
            ))}
          </ul>
        </div>

        <div className="modal-actions whats-new-actions">
          <Link to="/changelog" className="btn-secondary whats-new-view-all-link" onClick={onClose}>
            View all changes
          </Link>
          <button type="button" className="modal-cancel-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
