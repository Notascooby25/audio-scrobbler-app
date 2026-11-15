import { useRef, useState } from "react";
import { submitUnifiedImport } from "../api";
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
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setImportResult(null);
    setImportError("");
    setImportProgress("");
    setLiveProgress(null);

    const isBulk = files.length > 1;
    const totals = { inserted: 0, skipped: 0, duplicate: 0 };
    const sources = new Set();
    const fileErrors = [];
    let succeededCount = 0;

    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const prefix = isBulk ? `File ${i + 1} of ${files.length} (${file.name}): ` : "";

        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const entries = Array.isArray(parsed) ? parsed : parsed.history || parsed.entries || [];
          if (!entries.length) {
            throw new Error("No history entries found in this JSON file.");
          }

          const source = detectImportSource(entries, file.name);
          setLiveProgress({
            stage: "file_validation",
            percent: 10,
            message: `${prefix}Validating ${entries.length.toLocaleString()} entries...`,
            current: 0,
            total: entries.length,
          });

          const result = await submitUnifiedImport({
            token,
            source,
            entries,
            onProgress: (progressEvent) => {
              setLiveProgress(
                isBulk
                  ? { ...progressEvent, message: `${prefix}${progressEvent.message || ""}` }
                  : progressEvent
              );
            },
          });

          const s = result?.summary || {};
          totals.inserted += Number(s.inserted || 0);
          totals.skipped += Number(s.skipped || 0);
          totals.duplicate += Number(s.duplicate || 0);
          if (result?.source) sources.add(result.source);
          succeededCount += 1;

          if (!isBulk) {
            setImportResult(result);
          }
        } catch (fileErr) {
          const msg = fileErr?.message || "Import failed.";
          fileErrors.push(isBulk ? `${file.name}: ${msg}` : msg);
        }
      }

      setLiveProgress(null);

      if (isBulk && succeededCount > 0) {
        const sourceLabel =
          sources.size === 1
            ? `${Array.from(sources)[0]} (${succeededCount} ${succeededCount === 1 ? "file" : "files"})`
            : `multiple sources (${succeededCount} files)`;
        setImportResult({ status: "ok", source: sourceLabel, summary: totals });
      }

      if (fileErrors.length > 0) {
        setImportError(fileErrors.join(" | "));
      }

      if (succeededCount > 0 && onImportComplete) {
        await onImportComplete(isBulk ? { status: "ok", summary: totals } : undefined);
      }
    } finally {
      setLiveProgress(null);
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
          multiple
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
