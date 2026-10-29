import { useState } from "react";
import { previewSetlistsImport } from "../../api/setlists";

export default function ImportExportModal({ isOpen, onClose, onImport, isImporting, token }) {
  const [username, setUsername] = useState("");
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  if (!isOpen) return null;

  const handleFetchPreview = async (pageToFetch = 1) => {
    if (!username.trim() || !token) return;
    setIsFetchingPreview(true);
    setPreviewError("");
    try {
      const data = await previewSetlistsImport({
        token,
        username: username.trim(),
        page: pageToFetch,
      });
      setPreviewData(data);
      setCurrentPage(pageToFetch);

      // Pre-select non-logged gigs on first fetch
      if (pageToFetch === 1 && selectedIds.size === 0) {
        const initialSelected = new Set();
        data.items.forEach((item) => {
          if (!item.already_logged) {
            initialSelected.add(item.setlist_id);
          }
        });
        setSelectedIds(initialSelected);
      }
    } catch (err) {
      setPreviewError(err?.message || "Failed to fetch concerts from Setlist.fm");
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const handleToggleGig = (setlistId) => {
    const next = new Set(selectedIds);
    if (next.has(setlistId)) {
      next.delete(setlistId);
    } else {
      next.add(setlistId);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (!previewData?.items) return;
    const next = new Set(selectedIds);
    previewData.items.forEach((item) => {
      if (!item.already_logged) {
        next.add(item.setlist_id);
      }
    });
    setSelectedIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleImportSelected = () => {
    if (selectedIds.size === 0) return;
    onImport(username.trim(), Array.from(selectedIds));
  };

  const handleImportAll = () => {
    onImport(username.trim(), null);
  };

  const handleExport = (format) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
    const url = `${API_BASE_URL}/api/setlists/export?format=${format}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `attended_gigs.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert(`Export failed: ${err.message}`));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div
        className="card w-full max-w-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto"
        style={{
          border: "0.5px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <h3 className="text-lg font-bold">Import & Export Set Lists</h3>
          <button
            type="button"
            className="text-muted hover:text-ink text-xl font-bold cursor-pointer"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* 1. Historical Setlist.fm Import */}
        <div>
          <h4 className="font-semibold text-sm mb-1">Import from Setlist.fm Profile</h4>
          <p className="text-xs text-muted mb-3">
            Enter a Setlist.fm username to preview shows and select the exact concerts you attended:
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="input-field flex-1 text-sm"
              placeholder="Setlist.fm username (e.g. crispylettuce)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isImporting || isFetchingPreview}
            />
            <button
              type="button"
              className="btn btn-primary text-xs"
              onClick={() => handleFetchPreview(1)}
              disabled={isImporting || isFetchingPreview || !username.trim()}
            >
              {isFetchingPreview ? "Fetching..." : "Fetch Gigs"}
            </button>
          </div>

          {previewError && (
            <div className="notice notice-error text-xs mb-3" role="alert">
              {previewError}
            </div>
          )}

          {/* Interactive Gig Preview List */}
          {previewData && (
            <div
              className="p-3 rounded mb-3 space-y-3"
              style={{
                border: "0.5px solid var(--color-border)",
                backgroundColor: "var(--color-canvas, #f9fafb)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-muted">
                  Found {previewData.total} shows (Page {previewData.page} of{" "}
                  {previewData.total_pages})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs text-primary underline cursor-pointer bg-transparent border-0 p-0"
                    onClick={handleSelectAll}
                  >
                    Select All
                  </button>
                  <span className="text-muted">|</span>
                  <button
                    type="button"
                    className="text-xs text-muted underline cursor-pointer bg-transparent border-0 p-0"
                    onClick={handleDeselectAll}
                  >
                    Deselect All
                  </button>
                  <span className="font-semibold ml-2">{selectedIds.size} selected</span>
                </div>
              </div>

              {/* Scrollable List */}
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {previewData.items.map((item) => (
                  <label
                    key={item.setlist_id}
                    className={`flex items-start gap-3 p-2.5 rounded text-xs transition-colors cursor-pointer ${
                      item.already_logged
                        ? "opacity-60 bg-surface-hover cursor-not-allowed"
                        : "bg-surface hover:bg-surface-hover"
                    }`}
                    style={{ border: "0.5px solid var(--color-border)" }}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded cursor-pointer"
                      checked={selectedIds.has(item.setlist_id)}
                      disabled={item.already_logged || isImporting}
                      onChange={() => handleToggleGig(item.setlist_id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-ink truncate">{item.artist_name}</span>
                        <span className="text-muted shrink-0 text-[11px]">{item.event_date}</span>
                      </div>
                      <div className="text-muted text-[11px] truncate">
                        {item.venue_name}
                        {item.city ? `, ${item.city}` : ""}
                        {item.tour_name ? ` • ${item.tour_name}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {item.already_logged ? (
                        <span className="badge text-[10px] bg-surface-hover text-muted px-1.5 py-0.5 rounded">
                          Added
                        </span>
                      ) : (
                        <span className="badge text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {item.song_count} songs
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Pagination Controls */}
              {previewData.total_pages > 1 && (
                <div className="flex justify-between items-center pt-2 border-t border-border text-xs">
                  <button
                    type="button"
                    className="btn btn-secondary text-xs px-2 py-1"
                    disabled={currentPage <= 1 || isFetchingPreview}
                    onClick={() => handleFetchPreview(currentPage - 1)}
                  >
                    &larr; Prev Page
                  </button>
                  <span className="text-muted">
                    Page {currentPage} of {previewData.total_pages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary text-xs px-2 py-1"
                    disabled={currentPage >= previewData.total_pages || isFetchingPreview}
                    onClick={() => handleFetchPreview(currentPage + 1)}
                  >
                    Next Page &rarr;
                  </button>
                </div>
              )}

              {/* Import Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  onClick={handleImportAll}
                  disabled={isImporting}
                >
                  Import All {previewData.total} Shows
                </button>
                <button
                  type="button"
                  className="btn btn-primary text-xs font-semibold px-4 py-2"
                  disabled={selectedIds.size === 0 || isImporting}
                  onClick={handleImportSelected}
                >
                  {isImporting ? "Importing..." : `Import Selected (${selectedIds.size})`}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. Data Export */}
        <div className="pt-2 border-t border-border">
          <h4 className="font-semibold text-sm mb-1">Export Attended Gigs</h4>
          <p className="text-xs text-muted mb-3">
            Download a portable backup of all your attended concerts and tracklists:
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => handleExport("json")}
            >
              Download JSON
            </button>
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => handleExport("csv")}
            >
              Download CSV
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="button" className="btn btn-secondary text-xs" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
