import PageSizeSelect from "./PageSizeSelect";
import SetlistPagination from "./SetlistPagination";
import { computeTieRanks } from "./setlistUiUtils";
import useListPaging from "./useListPaging";

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
  const { searchParams, pageSize, currentPage, totalPages, updateParams, pageSlice } =
    useListPaging(items.length);
  const openKey = searchParams.get("open");

  if (items.length === 0) {
    return <p className="sfm-empty">{emptyText}</p>;
  }

  const maxCount = Math.max(...items.map((i) => i.count || 0), 1);
  const ranked = computeTieRanks(items, "count");
  const pageItems = pageSlice(ranked);

  return (
    <div>
      <PageSizeSelect
        id={`${idPrefix}-per-page`}
        noun={noun}
        value={pageSize}
        onChange={(size) => updateParams({ size, page: null, open: null })}
      />

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
