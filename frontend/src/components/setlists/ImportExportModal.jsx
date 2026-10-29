import { useState } from "react";
import { cleanSetlistUsername, previewSetlistsImport } from "../../api/setlists";

export default function ImportExportModal({ isOpen, onClose, onImport, isImporting, token }) {
  const [username, setUsername] = useState("");
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  if (!isOpen) return null;

  const handleFetchPreview = async (pageToFetch = 1) => {
    const raw = username.trim();
    if (!raw || !token) return;
    const cleaned = cleanSetlistUsername(raw);
    setIsFetchingPreview(true);
    setPreviewError("");
    try {
      const data = await previewSetlistsImport({
        token,
        username: cleaned,
        page: pageToFetch,
      });
      setPreviewData(data);
      setCurrentPage(pageToFetch);

      if (data.total === 0) {
        setPreviewError(`No attended concerts found on Setlist.fm for "${cleaned}".`);
      }

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
    onImport(cleanSetlistUsername(username), Array.from(selectedIds));
  };

  const handleImportAll = () => {
    onImport(cleanSetlistUsername(username), null);
  };

  const handleExport = (format) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
    const url = `${API_BASE_URL}/setlists/export?format=${format}`;
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
    <div className="modal-backdrop">
      <div
        className="modal-dialog sfm-modal sfm-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-export-title"
      >
        <div className="sfm-modal-head">
          <h3 id="import-export-title">Import & Export Set Lists</h3>
          <button type="button" className="sfm-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <section className="sfm-modal-section">
          <h4>Import from Setlist.fm Profile</h4>
          <p>
            Enter a Setlist.fm username (or profile URL) to preview shows and select the exact
            concerts you attended:
          </p>
          <div className="sfm-inline-form">
            <input
              type="text"
              placeholder="Setlist.fm username or URL (e.g. crispylettuce)"
              aria-label="Setlist.fm username or URL"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isImporting || isFetchingPreview}
            />
            <button
              type="button"
              onClick={() => handleFetchPreview(1)}
              disabled={isImporting || isFetchingPreview || !username.trim()}
            >
              {isFetchingPreview ? "Fetching..." : "Fetch Gigs"}
            </button>
          </div>

          {previewError && (
            <p className="sfm-error" role="alert">
              {previewError}
            </p>
          )}

          {previewData && (
            <div>
              <div className="sfm-preview-bar">
                <span className="sfm-gig-meta">
                  Found {previewData.total} shows (Page {previewData.page} of{" "}
                  {previewData.total_pages})
                </span>
                <div>
                  <button type="button" className="sfm-link" onClick={handleSelectAll}>
                    Select All
                  </button>
                  <button type="button" className="sfm-link is-muted" onClick={handleDeselectAll}>
                    Deselect All
                  </button>
                  <strong>{selectedIds.size} selected</strong>
                </div>
              </div>

              <div className="sfm-check-list">
                {previewData.items.map((item) => (
                  <label
                    key={item.setlist_id}
                    className={`sfm-check-row ${item.already_logged ? "is-disabled" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.setlist_id)}
                      disabled={item.already_logged || isImporting}
                      onChange={() => handleToggleGig(item.setlist_id)}
                    />
                    <span className="sfm-check-body">
                      <span className="sfm-check-title">
                        <strong>{item.artist_name}</strong>
                        <span className="sfm-sub">{item.event_date}</span>
                      </span>
                      <span className="sfm-sub">
                        {item.venue_name}
                        {item.city ? `, ${item.city}` : ""}
                        {item.tour_name ? ` • ${item.tour_name}` : ""}
                      </span>
                    </span>
                    <span className={`sfm-tag ${item.already_logged ? "is-muted" : ""}`}>
                      {item.already_logged ? "Added" : `${item.song_count} songs`}
                    </span>
                  </label>
                ))}
              </div>

              {previewData.total_pages > 1 && (
                <div className="sfm-preview-bar">
                  <button
                    type="button"
                    className="sfm-link"
                    disabled={currentPage <= 1 || isFetchingPreview}
                    onClick={() => handleFetchPreview(currentPage - 1)}
                  >
                    &larr; Prev Page
                  </button>
                  <span className="sfm-gig-meta">
                    Page {currentPage} of {previewData.total_pages}
                  </span>
                  <button
                    type="button"
                    className="sfm-link"
                    disabled={currentPage >= previewData.total_pages || isFetchingPreview}
                    onClick={() => handleFetchPreview(currentPage + 1)}
                  >
                    Next Page &rarr;
                  </button>
                </div>
              )}

              <div className="sfm-form-actions">
                <button
                  type="button"
                  className="sfm-action"
                  onClick={handleImportAll}
                  disabled={isImporting}
                >
                  Import All {previewData.total} Shows
                </button>
                <button
                  type="button"
                  disabled={selectedIds.size === 0 || isImporting}
                  onClick={handleImportSelected}
                >
                  {isImporting ? "Importing..." : `Import Selected (${selectedIds.size})`}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="sfm-modal-section">
          <h4>Export Attended Gigs</h4>
          <p>Download a portable backup of all your attended concerts and tracklists:</p>
          <div className="sfm-gig-actions">
            <button type="button" className="sfm-action" onClick={() => handleExport("json")}>
              Download JSON
            </button>
            <button type="button" className="sfm-action" onClick={() => handleExport("csv")}>
              Download CSV
            </button>
          </div>
        </section>

        <div className="modal-actions">
          <button type="button" className="modal-cancel-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
