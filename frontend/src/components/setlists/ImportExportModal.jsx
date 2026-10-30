import { useEffect, useState } from "react";
import {
  cancelImportJob,
  cleanSetlistUsername,
  downloadProfileExport,
  fetchImportJob,
  importSetlistsFromFile,
  previewSetlistsImport,
} from "../../api/setlists";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const JOB_LABELS = {
  profile: "Setlist.fm import",
  selected: "Setlist.fm import",
  file_songs: "Fetching songs for imported gigs",
};

function pausedJobText(job) {
  const progress =
    job.kind === "file_songs"
      ? `${job.imported_count} of ${job.total} gigs done`
      : `${job.imported_count}${job.total ? ` of ${job.total}` : ""} gigs imported`;
  return `${JOB_LABELS[job.kind] || "Import"} paused at the daily Setlist.fm limit (${progress}). It'll carry on automatically after midnight UTC.`;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsText(file);
  });
}

function fileImportSummary(result) {
  const parts = [`${result.imported} imported`];
  if (result.updated) parts.push(`${result.updated} updated`);
  if (result.skipped_existing) parts.push(`${result.skipped_existing} already logged (skipped)`);
  if (result.invalid_count) {
    parts.push(`${result.invalid_count} invalid ${result.invalid_count === 1 ? "row" : "rows"}`);
  }
  return parts.join(", ");
}

export default function ImportExportModal({
  isOpen,
  onClose,
  onImport,
  onFileImported = null,
  isImporting,
  token,
}) {
  const [username, setUsername] = useState("");
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [importFile, setImportFile] = useState(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [isFileImporting, setIsFileImporting] = useState(false);
  const [isDownloadingProfile, setIsDownloadingProfile] = useState(false);
  const [fileError, setFileError] = useState("");
  const [fileResult, setFileResult] = useState(null);
  const [pausedJob, setPausedJob] = useState(null);

  useEffect(() => {
    if (!isOpen || !token) return undefined;
    let isMounted = true;
    fetchImportJob({ token })
      .then((data) => isMounted && setPausedJob(data?.job || null))
      .catch(() => isMounted && setPausedJob(null));
    return () => {
      isMounted = false;
    };
  }, [isOpen, token, fileResult]);

  if (!isOpen) return null;

  const handleCancelJob = async () => {
    try {
      await cancelImportJob({ token });
    } finally {
      setPausedJob(null);
    }
  };

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

  const handleDownloadProfile = async () => {
    const cleaned = cleanSetlistUsername(username);
    setIsDownloadingProfile(true);
    setPreviewError("");
    try {
      const blob = await downloadProfileExport({ token, username: cleaned });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `setlist-${cleaned}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setPreviewError(err?.message || "Couldn't download these gigs.");
    } finally {
      setIsDownloadingProfile(false);
    }
  };

  const handleImportSelected = () => {
    if (selectedIds.size === 0) return;
    onImport(cleanSetlistUsername(username), Array.from(selectedIds));
  };

  const handleImportAll = () => {
    onImport(cleanSetlistUsername(username), null);
  };

  const handleFileImport = async () => {
    if (!importFile || !token) return;
    setFileError("");
    setFileResult(null);
    const extension = importFile.name.split(".").pop().toLowerCase();
    if (!["csv", "json"].includes(extension)) {
      setFileError("Choose a .csv or .json file exported from Set Lists.");
      return;
    }
    if (importFile.size > MAX_FILE_BYTES) {
      setFileError("That file is larger than 2 MB.");
      return;
    }
    setIsFileImporting(true);
    try {
      const result = await importSetlistsFromFile({
        token,
        format: extension,
        content: await readFileText(importFile),
        updateExisting,
      });
      setFileResult(result);
      if (onFileImported) onFileImported(result);
    } catch (err) {
      setFileError(err?.detail && typeof err.detail === "string" ? err.detail : err.message);
    } finally {
      setIsFileImporting(false);
    }
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

        {pausedJob && (
          <p className="sfm-paused-job" role="status">
            {pausedJobText(pausedJob)}{" "}
            <button type="button" className="sfm-link is-muted" onClick={handleCancelJob}>
              Cancel
            </button>
          </p>
        )}

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
                  <button
                    type="button"
                    className="sfm-link"
                    onClick={handleDownloadProfile}
                    disabled={isDownloadingProfile || isImporting}
                  >
                    {isDownloadingProfile ? "Preparing file..." : "Download these gigs"}
                  </button>
                  <button type="button" className="sfm-link" onClick={handleSelectAll}>
                    Select All
                  </button>
                  <button type="button" className="sfm-link is-muted" onClick={handleDeselectAll}>
                    Deselect All
                  </button>
                  <strong>{selectedIds.size} selected</strong>
                </div>
              </div>

              <p className="sfm-gig-meta">
                Download saves every show on this profile to a file. Import the file later with
                Import from file and it uses no Setlist.fm calls.
              </p>

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
          <h4>Import from a File</h4>
          <p>
            Import a .csv or .json file made with Export below (for example, a backup or another
            account&apos;s gigs). Gigs you&apos;ve already logged are skipped.
          </p>
          <label className="sfm-check">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              disabled={isFileImporting}
            />
            <span>Update festival names and ticks on gigs I already have</span>
          </label>
          <div className="sfm-inline-form">
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              aria-label="Gigs file (CSV or JSON)"
              onChange={(e) => {
                setImportFile(e.target.files?.[0] || null);
                setFileResult(null);
                setFileError("");
              }}
              disabled={isFileImporting}
            />
            <button
              type="button"
              onClick={handleFileImport}
              disabled={!importFile || isFileImporting}
            >
              {isFileImporting ? "Importing..." : "Import File"}
            </button>
          </div>
          {fileError && (
            <p className="sfm-error" role="alert">
              {fileError}
            </p>
          )}
          {fileResult && (
            <div className="sfm-file-result" role="status">
              <p>
                <strong>{fileImportSummary(fileResult)}.</strong>
              </p>
              {fileResult.without_songs > 0 && (
                <p className="sfm-gig-meta">
                  {fileResult.without_songs} gig{fileResult.without_songs === 1 ? "" : "s"} imported
                  without songs
                  {fileResult.quota_reached ? " (Setlist.fm daily limit reached)" : ""}.{" "}
                  {fileResult.resumes_automatically
                    ? "Their songs will be added automatically after midnight UTC."
                    : "Open a gig and use Refresh from Setlist.fm to add them later."}
                </p>
              )}
              {fileResult.invalid.length > 0 && (
                <ul className="sfm-gig-meta">
                  {fileResult.invalid.map((row) => (
                    <li key={row.line}>
                      Line {row.line}: {row.error}
                    </li>
                  ))}
                </ul>
              )}
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
