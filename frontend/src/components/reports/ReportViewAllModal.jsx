import { useEffect, useId } from "react";
import PropTypes from "prop-types";

export default function ReportViewAllModal({ isOpen, title, items, onClose }) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

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
        className="modal-dialog report-viewall-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
        <ul className="report-viewall-list">
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
