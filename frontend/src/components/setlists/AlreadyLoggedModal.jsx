import { parseDateParts } from "./SetlistDateBadge";

/** Asks before logging a gig that matches one already logged. `info` is the 409 detail. */
export default function AlreadyLoggedModal({ info, onCancel, onConfirm, isSubmitting }) {
  if (!info) return null;

  const { existing, same_show: sameShow } = info;
  const { day, month, year } = parseDateParts(existing.event_date);
  const date = `${day} ${month.charAt(0)}${month.slice(1).toLowerCase()} ${year}`;
  const venue = [existing.venue_name, existing.city].filter(Boolean).join(", ");

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <div
        className="modal-dialog sfm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="already-logged-title"
        aria-describedby="already-logged-desc"
      >
        <div className="sfm-modal-head">
          <h3 id="already-logged-title">Gig already logged</h3>
        </div>
        <p id="already-logged-desc" className="modal-description">
          You&apos;ve already logged <strong>{existing.artist_name}</strong> at{" "}
          <strong>{venue}</strong> on <strong>{date}</strong>. Are you sure you want to log it
          again?
        </p>
        <p className="sfm-gig-meta">
          {sameShow
            ? "This is the same Setlist.fm show, so logging it again refreshes its songs instead of adding a second copy."
            : "Logging it again adds a second gig for this artist on this date."}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-cancel-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-confirm-button"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Log again"}
          </button>
        </div>
      </div>
    </div>
  );
}
