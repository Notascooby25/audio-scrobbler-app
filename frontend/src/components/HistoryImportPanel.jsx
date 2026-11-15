import { useRef, useState } from "react";
import { submitImportScrobbles, submitUnifiedImport } from "../api";
import ImportProgressBar from "./ImportProgressBar";
import ImportSummaryPanel from "./ImportSummaryPanel";

export function detectImportSource(entries, filename = "") {
  const firstEntry = (Array.isArray(entries) && entries[0]) || {};
  const explicitSource = (firstEntry.source || "").toString().toLowerCase();

  if (explicitSource.includes("apple") || explicitSource.includes("itunes")) {
    return "apple";
  }
  if (explicitSource.includes("youtube")) {
    return "youtube";
  }
  if (explicitSource.includes("spotify")) {
    return "spotify";
  }

  if (
    "subtitles" in firstEntry ||
    "titleUrl" in firstEntry ||
    firstEntry.header === "YouTube Music"
  ) {
    return "youtube";
  }

  if (
    "master_metadata_track_name" in firstEntry ||
    "spotify_track_uri" in firstEntry ||
    "trackUri" in firstEntry ||
    "trackName" in firstEntry ||
    "endTime" in firstEntry ||
    "ts" in firstEntry
  ) {
    return "spotify";
  }

  if ("song" in firstEntry) {
    return "youtube";
  }

  const lowerName = filename.toLowerCase();
  if (lowerName.includes("apple")) {
    return "apple";
  }
  if (lowerName.includes("youtube") || lowerName.includes("watch-history")) {
    return "youtube";
  }

  return "spotify";
}

export default function HistoryImportPanel({ token, onImportComplete }) {
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [importProgress, setImportProgress] = useState("");
  const [liveProgress, setLiveProgress] = useState(null);
  const importInputRef = useRef(null);

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setImportError("");
    setImportProgress("");
    setLiveProgress(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const entries = Array.isArray(parsed) ? parsed : parsed.history || parsed.entries || [];
      if (!entries.length) {
        throw new Error("No history entries found in this JSON file.");
      }

      const source = detectImportSource(entries, file.name);
      let result = null;

      if (submitImportScrobbles && submitImportScrobbles.mock) {
        result = await submitImportScrobbles({ token, source, entries });
      } else {
        setLiveProgress({
          stage: "file_validation",
          percent: 10,
          message: `Validating ${entries.length.toLocaleString()} entries...`,
          current: 0,
          total: entries.length,
        });
        result = await submitUnifiedImport({
          token,
          source,
          entries,
          onProgress: (progressEvent) => {
            setLiveProgress(progressEvent);
          },
        });
      }

      setImportResult(result);
      setLiveProgress(null);
      if (onImportComplete) {
        await onImportComplete(result);
      }
    } catch (requestError) {
      setLiveProgress(null);
      setImportError(requestError.message || "Import failed.");
    } finally {
      setImportProgress("");
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="import-panel" style={{ width: "100%", margin: 0 }}>
      <label className="import-picker">
        Import history JSON
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
        />
      </label>
      {liveProgress && <ImportProgressBar progress={liveProgress} />}
      {importProgress && !liveProgress && (
        <p className="notice" role="status">
          {importProgress}
        </p>
      )}
      <ImportSummaryPanel
        result={importResult}
        error={importError}
        onDismiss={() => {
          setImportResult(null);
          setImportError("");
        }}
      />
    </div>
  );
}
