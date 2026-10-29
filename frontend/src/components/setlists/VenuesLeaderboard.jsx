import { useState } from "react";

export default function VenuesLeaderboard({ venues = [] }) {
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  if (venues.length === 0) {
    return <div className="card p-8 text-center text-muted">No venues recorded yet.</div>;
  }

  const maxCount = Math.max(...venues.map((v) => v.count || 1), 1);
  const totalPages = Math.ceil(venues.length / pageSize);
  const paginatedVenues = venues.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-3">
      {/* Description & Per Page Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border">
        <div>
          <h3 className="font-bold text-sm text-ink">Venues Visited</h3>
          <p className="text-xs text-muted">Ranked by concerts attended at each venue.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="venues-per-page" className="text-muted shrink-0">
            Show:
          </label>
          <select
            id="venues-per-page"
            className="input-field text-xs py-1 px-2 rounded"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Venue Rows */}
      <div className="space-y-1.5">
        {paginatedVenues.map((v, idx) => {
          const globalIdx = (currentPage - 1) * pageSize + idx;
          const barWidthPercent = Math.max(18, Math.round((v.count / maxCount) * 100));

          return (
            <div
              key={`${v.venue_name}-${v.city}`}
              className="card p-3 flex items-center justify-between gap-3"
              style={{ border: "0.5px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xs font-bold text-muted w-6 text-center shrink-0">
                  {globalIdx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-ink truncate">{v.venue_name}</div>
                  <div className="text-xs text-muted truncate">
                    {v.city}
                    {v.country ? `, ${v.country}` : ""}
                  </div>
                </div>
              </div>

              {/* Proportional Bar */}
              <div className="flex items-center gap-2 shrink-0 w-32 sm:w-44 justify-end">
                <div className="w-full bg-surface-hover rounded h-6 flex items-center justify-end p-0.5 overflow-hidden">
                  <div
                    className="bg-primary text-white text-[11px] font-bold h-full rounded flex items-center justify-end px-2 transition-all duration-300"
                    style={{ width: `${barWidthPercent}%` }}
                  >
                    {v.count}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            &lt; Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              type="button"
              className={`text-xs px-2.5 py-1 rounded font-semibold cursor-pointer transition-colors ${
                currentPage === pg
                  ? "bg-primary text-white"
                  : "bg-surface hover:bg-surface-hover text-ink border border-border"
              }`}
              onClick={() => setCurrentPage(pg)}
            >
              {pg}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next &gt;
          </button>
        </div>
      )}
    </div>
  );
}
