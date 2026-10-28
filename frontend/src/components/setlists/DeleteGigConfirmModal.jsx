import { useState } from "react";

export default function DeleteGigConfirmModal({ isOpen, onClose, gig, onConfirm, isDeleting }) {
  const [includeSupportActs, setIncludeSupportActs] = useState(true);

  if (!isOpen || !gig) return null;

  const handleDelete = () => {
    onConfirm(gig.id, includeSupportActs);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div
        className="card w-full max-w-md p-6"
        style={{
          border: "0.5px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <h3 className="text-lg font-bold text-danger mb-2">Delete Attended Gig</h3>
        <p className="text-sm mb-3">
          Are you sure you want to remove <strong>{gig.artist_name}</strong> at{" "}
          <strong>{gig.venue_name}</strong>?
        </p>
        <p className="text-xs text-muted mb-4">
          This will also remove all associated concert songs from your scrobble library and update
          your live stats.
        </p>

        <label className="flex items-center gap-2 mb-6 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={includeSupportActs}
            onChange={(e) => setIncludeSupportActs(e.target.checked)}
            className="rounded text-primary focus:ring-0"
            aria-label="Also delete support acts"
          />
          <span>Also delete support acts logged with this show</span>
        </label>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: "#dc2626", color: "#ffffff", fontWeight: 600 }}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Gig"}
          </button>
        </div>
      </div>
    </div>
  );
}
