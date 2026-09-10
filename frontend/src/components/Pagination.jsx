import { buildPageItems } from '../pagination'

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  const items = buildPageItems(page, totalPages)

  return (
    <nav className="pagination" aria-label="Pagination">
      <ol className="pagination-list">
        {items.map((item, index) => (
          item === '...' ? (
            <li key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">&hellip;</li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={item === page ? 'pagination-page pagination-page-active' : 'pagination-page'}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            </li>
          )
        ))}
      </ol>
      <button
        type="button"
        className="pagination-next"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  )
}
