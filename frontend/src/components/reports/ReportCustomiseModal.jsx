import { useState, useEffect } from "react";
import PropTypes from "prop-types";

export const DEFAULT_WIDGET_PREFERENCES = {
  showMilestones: true,
  showChallenge1001: true,
  showLiveConnection: true,
  showScrobblesOverTime: true,
  showListeningRoutines: true,
  showListeningClock: true,
  showDecades: true,
  showGenres: true,
  showRatios: true,
  showLeaderboards: true,
  leaderboardLimit: 5,
};

export default function ReportCustomiseModal({ isOpen, preferences, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({
    ...DEFAULT_WIDGET_PREFERENCES,
    ...(preferences || {}),
  }));

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...DEFAULT_WIDGET_PREFERENCES,
        ...(preferences || {}),
      });
    }
  }, [isOpen, preferences]);

  if (!isOpen) return null;

  const handleToggle = (key) => {
    setDraft((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleLimitChange = (e) => {
    const val = Number(e.target.value) || 5;
    setDraft((prev) => ({
      ...prev,
      leaderboardLimit: val === 10 ? 10 : 5,
    }));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_WIDGET_PREFERENCES);
  };

  return (
    <div className="customise-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="customise-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customise-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="customise-modal-header">
          <h2 id="customise-modal-title">Customise Report Widgets</h2>
          <button
            type="button"
            className="customise-modal-close"
            onClick={onClose}
            aria-label="Close customise dialog"
          >
            ✕
          </button>
        </div>

        <p className="customise-modal-intro">
          Choose which metrics, charts, and milestones appear on your listening report. Preferences
          are saved automatically to this device.
        </p>

        <div className="customise-modal-body">
          <fieldset className="customise-fieldset">
            <legend className="customise-legend">Milestones & Highlights</legend>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showMilestones)}
                onChange={() => handleToggle("showMilestones")}
              />
              <span>Streaks & Milestones (Active streak, peak day, heavy rotation, persona)</span>
            </label>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showChallenge1001)}
                onChange={() => handleToggle("showChallenge1001")}
              />
              <span>1001 Albums Challenge (Completed albums & progress)</span>
            </label>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showLiveConnection)}
                onChange={() => handleToggle("showLiveConnection")}
              />
              <span>Live Artist Connection (Cross-over with attended concerts)</span>
            </label>
          </fieldset>

          <fieldset className="customise-fieldset">
            <legend className="customise-legend">Habits, Charts & Ratios</legend>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showScrobblesOverTime)}
                onChange={() => handleToggle("showScrobblesOverTime")}
              />
              <span>Scrobbles over time (Weekly trend)</span>
            </label>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showListeningRoutines)}
                onChange={() => handleToggle("showListeningRoutines")}
              />
              <span>Listening routines (Heatmap)</span>
            </label>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showListeningClock)}
                onChange={() => handleToggle("showListeningClock")}
              />
              <span>Listening Clock (24-hour radial)</span>
            </label>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showDecades)}
                onChange={() => handleToggle("showDecades")}
              />
              <span>Music by decade</span>
            </label>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showGenres)}
                onChange={() => handleToggle("showGenres")}
              />
              <span>Top genres</span>
            </label>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showRatios)}
                onChange={() => handleToggle("showRatios")}
              />
              <span>Music ratios & Discovery velocity</span>
            </label>
          </fieldset>

          <fieldset className="customise-fieldset">
            <legend className="customise-legend">Ranked Leaderboards</legend>
            <label className="customise-checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.showLeaderboards)}
                onChange={() => handleToggle("showLeaderboards")}
              />
              <span>Top Artists, Albums, and Tracks</span>
            </label>

            <div className="customise-select-group">
              <label htmlFor="customise-leaderboard-limit">Leaderboard display count</label>
              <select
                id="customise-leaderboard-limit"
                value={String(draft.leaderboardLimit || 5)}
                onChange={handleLimitChange}
                disabled={!draft.showLeaderboards}
                className="customise-select"
              >
                <option value="5">Top 5 items</option>
                <option value="10">Top 10 items</option>
              </select>
            </div>
          </fieldset>
        </div>

        <div className="customise-modal-footer">
          <button type="button" className="btn-secondary" onClick={handleReset}>
            Reset to Defaults
          </button>
          <div className="customise-footer-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

ReportCustomiseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  preferences: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
