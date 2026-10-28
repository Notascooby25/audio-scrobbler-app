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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div
        className="card w-full max-w-lg p-6"
        style={{
          border: "0.5px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <h3 className="text-lg font-bold mb-1">Did you catch any support bands?</h3>
        <p className="text-xs text-muted mb-4">
          We found other acts who performed at <strong>{venueName}</strong> on{" "}
          <strong>{eventDate}</strong>. Select any you watched so we can add them to your gig
          history and scrobbles:
        </p>

        {supportActs.length === 0 ? (
          <p className="text-sm text-muted my-4 italic">
            No other acts were listed for this venue and date. Only {mainSetlist?.artist?.name} will
            be logged.
          </p>
        ) : (
          <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
            {supportActs.map((act) => {
              const isChecked = selectedIds.includes(act.id);
              const actName = act?.artist?.name || "Support Act";
              return (
                <label
                  key={act.id}
                  className="flex items-center gap-3 p-3 rounded cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isChecked ? "var(--color-surface-hover)" : "transparent",
                    border: "0.5px solid var(--color-border)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(act.id)}
                    className="rounded text-primary focus:ring-0"
                  />
                  <div>
                    <div className="font-semibold text-sm">{actName}</div>
                    <div className="text-xs text-muted">Support Act</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
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
