import { getPaginationRange } from "./setlistUiUtils";

export default function SetlistPagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <nav className="sfm-pagination" aria-label="Pagination">
      <button
        type="button"
        className="sfm-page-btn"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        &lsaquo;
      </button>
      {pages.map((pg, idx) =>
        pg === "..." ? (
          <span key={`ellipsis-${idx}`} className="sfm-page-ellipsis">
            &hellip;
          </span>
        ) : (
          <button
            key={pg}
            type="button"
            className={`sfm-page-btn ${pg === currentPage ? "active" : ""}`}
            aria-current={pg === currentPage ? "page" : undefined}
            onClick={() => pg !== currentPage && onPageChange(pg)}
          >
            {pg}
          </button>
        )
      )}
      <button
        type="button"
        className="sfm-page-btn"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        &rsaquo;
      </button>
    </nav>
  );
}
