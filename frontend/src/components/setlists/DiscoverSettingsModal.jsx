import { useEffect, useState } from "react";

export default function DiscoverSettingsModal({
  isOpen,
  onClose,
  initialFilters,
  onSave,
  isSaving,
}) {
  const [mode, setMode] = useState(initialFilters?.my_artists_mode || "top_n");
  const [limit, setLimit] = useState(String(initialFilters?.my_artists_limit || 100));
  const [minPlays, setMinPlays] = useState(String(initialFilters?.my_artists_min_plays || 5));
  const [months, setMonths] = useState(String(initialFilters?.my_artists_months ?? 12));
  const [includeSeenLive, setIncludeSeenLive] = useState(
    initialFilters?.include_seen_live !== false
  );

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialFilters?.my_artists_mode || "top_n");
    setLimit(String(initialFilters?.my_artists_limit || 100));
    setMinPlays(String(initialFilters?.my_artists_min_plays || 5));
    setMonths(String(initialFilters?.my_artists_months ?? 12));
    setIncludeSeenLive(initialFilters?.include_seen_live !== false);
  }, [isOpen, initialFilters]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      my_artists_mode: mode,
      my_artists_limit: Math.max(1, Math.min(500, Number(limit) || 100)),
      my_artists_min_plays: Math.max(1, Math.min(500, Number(minPlays) || 5)),
      my_artists_months: Math.max(0, Math.min(120, Number(months) || 0)),
      include_seen_live: includeSeenLive,
    });
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-dialog sfm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discover-criteria-title"
      >
        <div className="sfm-modal-head">
          <h3 id="discover-criteria-title">My Artists criteria</h3>
          <button type="button" className="sfm-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="sfm-discover-criteria-form">
          <fieldset className="sfm-discover-fieldset">
            <legend>How to pick your artists</legend>
            <label className="sfm-discover-radio">
              <input
                type="radio"
                name="my-artists-mode"
                value="top_n"
                checked={mode === "top_n"}
                onChange={() => setMode("top_n")}
              />
              <span>Top N most played artists</span>
            </label>
            {mode === "top_n" && (
              <div className="sfm-discover-field-row">
                <label htmlFor="discover-top-n">Top artists</label>
                <select
                  id="discover-top-n"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                >
                  <option value="50">Top 50</option>
                  <option value="100">Top 100</option>
                  <option value="200">Top 200</option>
                </select>
              </div>
            )}

            <label className="sfm-discover-radio">
              <input
                type="radio"
                name="my-artists-mode"
                value="min_plays"
                checked={mode === "min_plays"}
                onChange={() => setMode("min_plays")}
              />
              <span>Played at least X times</span>
            </label>
            {mode === "min_plays" && (
              <div className="sfm-discover-field-row">
                <label htmlFor="discover-min-plays">Minimum plays</label>
                <input
                  id="discover-min-plays"
                  type="number"
                  min={1}
                  max={500}
                  value={minPlays}
                  onChange={(e) => setMinPlays(e.target.value)}
                />
              </div>
            )}
          </fieldset>

          <div className="sfm-discover-field-row">
            <label htmlFor="discover-months">Timeframe</label>
            <select id="discover-months" value={months} onChange={(e) => setMonths(e.target.value)}>
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="24">Last 24 months</option>
              <option value="0">All time</option>
            </select>
          </div>

          <label className="sfm-discover-checkbox">
            <input
              type="checkbox"
              checked={includeSeenLive}
              onChange={(e) => setIncludeSeenLive(e.target.checked)}
            />
            <span>Include artists I&apos;ve seen live</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="modal-cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-confirm-button" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save criteria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
