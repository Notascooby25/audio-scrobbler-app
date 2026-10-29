import { useState, useEffect } from "react";

export default function SupportActsPromptModal({
  isOpen,
  onClose,
  mainSetlist,
  supportActs,
  onConfirm,
  isSubmitting,
}) {
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    // Default all support acts to checked
    if (supportActs && supportActs.length > 0) {
      setSelectedIds(supportActs.map((act) => act.id));
    } else {
      setSelectedIds([]);
    }
  }, [supportActs]);

  if (!isOpen || !mainSetlist) return null;

  const handleToggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    onConfirm(selectedIds);
  };

  const venueName = mainSetlist?.venue?.name || "this venue";
  const eventDate = mainSetlist?.eventDate || "";

  return (
    <div className="modal-backdrop">
      <div
        className="modal-dialog sfm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-acts-title"
      >
        <div className="sfm-modal-head">
          <div>
            <h3 id="support-acts-title">Did you catch any support bands?</h3>
            <p>
              We found other acts who performed at <strong>{venueName}</strong> on{" "}
              <strong>{eventDate}</strong>. Select any you watched so we can add them to your gig
              history and scrobbles:
            </p>
          </div>
        </div>

        {supportActs.length === 0 ? (
          <p className="sfm-gig-meta">
            No other acts were listed for this venue and date. Only {mainSetlist?.artist?.name} will
            be logged.
          </p>
        ) : (
          <div className="sfm-check-list">
            {supportActs.map((act) => (
              <label key={act.id} className="sfm-check-row">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(act.id)}
                  onChange={() => handleToggle(act.id)}
                />
                <span className="sfm-check-body">
                  <strong>{act?.artist?.name || "Support Act"}</strong>
                  <span className="sfm-sub">Support act</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="modal-cancel-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-confirm-button"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save & Add to Scrobbles"}
          </button>
        </div>
      </div>
    </div>
  );
}
