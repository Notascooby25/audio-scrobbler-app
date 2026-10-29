import { useState } from "react";

export default function DeleteGigConfirmModal({ isOpen, onClose, gig, onConfirm, isDeleting }) {
  const [includeSupportActs, setIncludeSupportActs] = useState(true);

  if (!isOpen || !gig) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose?.();
      }}
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-gig-title"
      >
        <h3 id="delete-gig-title" className="modal-title">
          Delete Attended Gig
        </h3>
        <p className="modal-description">
          Are you sure you want to remove <strong>{gig.artist_name}</strong> at{" "}
          <strong>{gig.venue_name}</strong>? This also removes its songs from your scrobble library
          and live stats.
        </p>

        <label className="sfm-check">
          <input
            type="checkbox"
            checked={includeSupportActs}
            onChange={(e) => setIncludeSupportActs(e.target.checked)}
            aria-label="Also delete support acts"
          />
          <span>Also delete support acts logged with this show</span>
        </label>

        <div className="modal-actions">
          <button
            type="button"
            className="modal-cancel-button"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="danger-button modal-confirm-button"
            onClick={() => onConfirm(gig.id, includeSupportActs)}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Gig"}
          </button>
        </div>
      </div>
    </div>
  );
}
