import { useState } from "react";

export default function ImportExportModal({ isOpen, onClose, onImport, isImporting, token }) {
  const [username, setUsername] = useState("");

  if (!isOpen) return null;

  const handleImportSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    onImport(username.trim());
  };

  const handleExport = (format) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
    const url = `${API_BASE_URL}/api/setlists/export?format=${format}`;
    // Fetch with auth token and trigger download
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
        className="card w-full max-w-lg p-6 space-y-6"
        style={{
          border: "0.5px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <h3 className="text-lg font-bold">Import & Export Set Lists</h3>
          <button
            type="button"
            className="text-muted hover:text-ink text-xl font-bold"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* 1. Historical Setlist.fm Import */}
        <div>
          <h4 className="font-semibold text-sm mb-1">Import from Setlist.fm Profile</h4>
          <p className="text-xs text-muted mb-3">
            Enter your Setlist.fm username to automatically import your full concert history and
            setlists into your library:
          </p>
          <form onSubmit={handleImportSubmit} className="flex gap-2">
            <input
              type="text"
              className="input-field flex-1 text-sm"
              placeholder="Setlist.fm username (e.g. crispylettuce)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isImporting}
            />
            <button
              type="submit"
              className="btn btn-primary text-xs"
              disabled={isImporting || !username.trim()}
            >
              {isImporting ? "Importing..." : "Import"}
            </button>
          </form>
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
