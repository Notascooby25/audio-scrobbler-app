import { useSearchParams } from "react-router-dom";
import SetlistPagination from "./SetlistPagination";
import { computeTieRanks } from "./setlistUiUtils";

const PAGE_SIZES = [10, 15, 25, 50];
const DEFAULT_PAGE_SIZE = 15;

/**
 * Setlist.fm-style ranked table: rank (blank on ties) | name | proportional bar.
 * Rows with a `detail` node expand in place. Page, page size and the expanded
 * row live in the URL so returning with the browser Back button restores them.
 *
 * items: [{ key, label, sub?, count, detail? }]
 */
export default function RankedBarList({
  items = [],
  noun = "items",
  headings = null,
  emptyText = "Nothing recorded yet.",
  idPrefix = "ranked",
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const sizeParam = Number(searchParams.get("size"));
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageParam = Number(searchParams.get("page"));
  const currentPage =
    Number.isInteger(pageParam) && pageParam >= 1 ? Math.min(pageParam, totalPages) : 1;
  const openKey = searchParams.get("open");

  // Expanding rows and paging replace the history entry, so Back skips them
  const updateParams = (changes) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined) params.delete(key);
      else params.set(key, String(value));
    });
    setSearchParams(params, { replace: true });
  };

  if (items.length === 0) {
    return <p className="sfm-empty">{emptyText}</p>;
  }

  const maxCount = Math.max(...items.map((i) => i.count || 0), 1);
  const ranked = computeTieRanks(items, "count");
  const pageItems = ranked.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectId = `${idPrefix}-per-page`;

  return (
    <div>
      <label htmlFor={selectId} className="sfm-page-size">
        {noun.charAt(0).toUpperCase() + noun.slice(1)} shown per page
        <select
          id={selectId}
          value={pageSize}
          onChange={(e) => updateParams({ size: e.target.value, page: null, open: null })}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <div className="sfm-table-wrap">
        {headings && (
          <div className="sfm-table-head" aria-hidden="true">
            <span />
            <span>{headings[0]}</span>
            <span>{headings[1]}</span>
          </div>
        )}
        <div className="sfm-table">
          {pageItems.map(({ item, rank, showRank }) => {
            const isExpandable = Boolean(item.detail);
            const isOpen = isExpandable && openKey === item.key;
            const toggle = () => updateParams({ open: isOpen ? null : item.key });
            const width = Math.max(4, Math.round(((item.count || 0) / maxCount) * 100));

            return (
              <div key={item.key} className="sfm-row">
                <div
                  className={`sfm-row-main ${isExpandable ? "is-expandable" : ""}`}
                  onClick={isExpandable ? toggle : undefined}
                >
                  <span className="sfm-rank">{showRank ? rank : ""}</span>
                  <span className="sfm-name">
                    {isExpandable ? (
                      <button type="button" className="sfm-link" aria-expanded={isOpen}>
                        {item.label}
                      </button>
                    ) : (
                      item.label
                    )}
                    {item.sub && <span className="sfm-sub">{item.sub}</span>}
                  </span>
                  <span className="sfm-bar" style={{ width: `${width}%` }}>
                    {item.count}
                  </span>
                </div>
                {isOpen && <div className="sfm-row-detail">{item.detail}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <SetlistPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => updateParams({ page: page === 1 ? null : page, open: null })}
      />
    </div>
  );
}
