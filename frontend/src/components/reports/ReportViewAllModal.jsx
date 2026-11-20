import { useEffect, useId, useRef } from "react";
import PropTypes from "prop-types";

export default function ReportViewAllModal({ isOpen, title, items, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  // Move focus into the dialog while it is open and give it back to whatever
  // opened it (the View all button) when it closes.
  useEffect(() => {
    if (!isOpen) return undefined;

    const opener = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      // Keep Tab inside the dialog: the close button and the scrollable list.
      const stops = dialogRef.current.querySelectorAll('button, [tabindex="0"]');
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div
      className="modal-backdrop"
      data-testid="report-viewall-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="modal-dialog report-viewall-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="report-viewall-header">
          <h3 id={titleId} className="report-viewall-title">
            {title}
          </h3>
          <button
            type="button"
            className="report-viewall-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <ul className="report-viewall-list" tabIndex={0} aria-labelledby={titleId}>
          {items.map((item, index) => (
            <li key={`${index}-${item}`} className="report-viewall-item">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

ReportViewAllModal.propTypes = {
  isOpen: PropTypes.bool,
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  onClose: PropTypes.func,
};
