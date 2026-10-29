import { useState } from "react";
import { computeTieRanks, getPaginationRange } from "./setlistUiUtils";

export default function SongsHeardLeaderboard({ songs = [] }) {
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  if (songs.length === 0) {
    return <div className="card p-8 text-center text-muted">No songs heard live recorded yet.</div>;
  }

  const maxCount = Math.max(...songs.map((s) => s.count || 1), 1);
  const totalPages = Math.ceil(songs.length / pageSize);

  // Tie-aware ranking across full dataset
  const rankedSongs = computeTieRanks(songs, "count");
  const paginatedRanked = rankedSongs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const paginationPages = getPaginationRange(currentPage, totalPages);

  return (
    <div className="space-y-3">
      {/* Setlist.fm Header & Page Size Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">Songs Heard Live</h2>
          <p className="text-xs text-muted">Ranked by total times witnessed live in concert.</p>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          <label htmlFor="songs-per-page" className="text-muted shrink-0">
            Songs shown per page:
          </label>
          <select
            id="songs-per-page"
            className="input-field text-xs py-1 px-2 rounded bg-surface border border-border"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Striped Dense Table */}
      <div
        className="rounded border border-border overflow-hidden bg-surface"
        style={{ border: "0.5px solid var(--color-border)" }}
      >
        <div className="divide-y divide-border">
          {paginatedRanked.map(({ item: song, rank, showRank }) => {
            const barWidthPercent = Math.max(12, Math.round((song.count / maxCount) * 100));

            return (
              <div
                key={`${song.track_name}-${song.artist_name}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-surface-hover transition-colors"
              >
                {/* Left: Tie-aware Rank & Song Title / Artist */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-xs font-bold text-muted w-7 text-right shrink-0">
                    {showRank ? `${rank}.` : ""}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-ink truncate">{song.track_name}</div>
                    <div className="text-xs text-muted truncate">{song.artist_name}</div>
                  </div>
                </div>

                {/* Right: Inner-left bar count */}
                <div className="flex items-center gap-2 shrink-0 w-32 sm:w-44 justify-end">
                  <div className="w-full bg-surface-hover rounded h-5 flex items-center justify-start overflow-hidden">
                    <div
                      className="bg-primary text-white text-[11px] font-bold h-full rounded flex items-center justify-start pl-2 transition-all duration-300"
                      style={{ width: `${barWidthPercent}%` }}
                    >
                      {song.count}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Numbered Pagination with Ellipsis */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="Previous page"
          >
            &lsaquo;
          </button>
          {paginationPages.map((pg, pIdx) => {
            if (pg === "...") {
              return (
                <span key={`ellipsis-${pIdx}`} className="text-xs px-1 text-muted">
                  &hellip;
                </span>
              );
            }
            return (
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
            );
          })}
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1 disabled:opacity-40"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            title="Next page"
          >
            &rsaquo;
          </button>
        </div>
      )}
    </div>
  );
}
