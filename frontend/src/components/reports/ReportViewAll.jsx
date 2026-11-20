import { useState } from "react";
import PropTypes from "prop-types";
import ReportViewAllModal from "./ReportViewAllModal";

export const VIEW_ALL_PREVIEW_COUNT = 5;

// A "View all N" button plus its pop-up. Renders nothing unless the card is
// hiding some items (more than the first few chips it already shows).
export default function ReportViewAll({ title, items }) {
  const [isOpen, setIsOpen] = useState(false);

  if (items.length <= VIEW_ALL_PREVIEW_COUNT) return null;

  return (
    <>
      <button
        type="button"
        className="crossover-viewall-btn"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        View all {items.length}
      </button>
      <ReportViewAllModal
        isOpen={isOpen}
        title={`${title} (${items.length})`}
        items={items}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

ReportViewAll.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
};
