import { useId } from "react";

const SCOPES = [
  { id: "my_artists", label: "My Artists" },
  { id: "local", label: "Local Radar" },
];

const DATE_WINDOWS = [
  { id: "all", label: "Any time" },
  { id: "weekend", label: "This weekend" },
  { id: "7d", label: "Next 7 days" },
  { id: "30d", label: "Next 30 days" },
];

/** 'Warwick, United Kingdom' reads better as 'Warwick' in a sentence. */
export function shortCity(name) {
  return String(name || "")
    .split(",")[0]
    .trim();
}

export function countryName(code) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`sfm-chip sfm-btn-mixed ${active ? "is-active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** The Discover filter panel: where to look, then when, then what to show. */
export default function DiscoverFilters({
  scope,
  onScopeChange,
  homeCity,
  hasHomeCity,
  radiusInput,
  onRadiusInputChange,
  onRadiusCommit,
  onlyMyArtists,
  onOnlyMyArtistsChange,
  country,
  countries,
  onCountryChange,
  dateWindow,
  onDateWindowChange,
  onlyNew,
  onOnlyNewChange,
  onlyInterested,
  onOnlyInterestedChange,
  summary,
  open,
  onToggleOpen,
  isDirty,
  saving,
  saveMessage,
  onSaveDefaults,
  onOpenCriteria,
}) {
  const bodyId = useId();
  return (
    <section className="sfm-discover-filters" aria-label="Discover filters">
      <div className="sfm-discover-filters-head">
        <div className="sfm-segmented" role="group" aria-label="Where to look">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sfm-segment sfm-btn-mixed ${scope === item.id ? "is-active" : ""}`}
              aria-pressed={scope === item.id}
              onClick={() => onScopeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sfm-discover-filters-toggle sfm-btn-mixed"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggleOpen}
        >
          <span>Filters</span>
          <span className="sfm-discover-filters-summary">{summary}</span>
        </button>
      </div>

      <div id={bodyId} className={`sfm-discover-filters-body ${open ? "is-open" : ""}`}>
        {onlyInterested ? (
          <p className="sfm-discover-context">Your shortlist, wherever the gigs are.</p>
        ) : scope === "local" ? (
          <div className="sfm-discover-context">
            {hasHomeCity ? (
              <span>
                Near <strong>{shortCity(homeCity)}</strong>, within
              </span>
            ) : (
              <span>No home city set, within</span>
            )}
            <label className="sfm-discover-radius">
              <span className="visually-hidden-accessible">Radius in miles</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={radiusInput}
                onChange={(event) => onRadiusInputChange(event.target.value)}
                onBlur={onRadiusCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onRadiusCommit();
                }}
              />
              <span aria-hidden="true">miles</span>
            </label>
            <label className="sfm-discover-toggle">
              <input
                type="checkbox"
                checked={onlyMyArtists}
                onChange={(event) => onOnlyMyArtistsChange(event.target.checked)}
              />
              <span>Only gigs by my artists</span>
            </label>
          </div>
        ) : (
          <div className="sfm-discover-context">
            <label className="sfm-discover-country">
              <span>Country</span>
              <select value={country} onChange={(event) => onCountryChange(event.target.value)}>
                <option value="">All countries</option>
                {(countries || []).map((code) => (
                  <option key={code} value={code}>
                    {countryName(code)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="sfm-discover-filter-row" role="group" aria-label="When">
          <span className="sfm-discover-filter-label" aria-hidden="true">
            When
          </span>
          <div className="sfm-chips">
            {DATE_WINDOWS.map((item) => (
              <Chip
                key={item.id}
                active={dateWindow === item.id}
                onClick={() => onDateWindowChange(item.id)}
              >
                {item.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="sfm-discover-filter-row" role="group" aria-label="Show only">
          <span className="sfm-discover-filter-label" aria-hidden="true">
            Only
          </span>
          <div className="sfm-chips">
            <Chip active={onlyNew} onClick={() => onOnlyNewChange(!onlyNew)}>
              Newly announced
            </Chip>
            <Chip active={onlyInterested} onClick={() => onOnlyInterestedChange(!onlyInterested)}>
              Interested
            </Chip>
          </div>
        </div>

        <div className="sfm-discover-settings-row">
          <button type="button" className="sfm-action sfm-btn-mixed" onClick={onOpenCriteria}>
            Artist criteria
          </button>
          {isDirty && (
            <button
              type="button"
              className="sfm-action sfm-btn-mixed"
              onClick={onSaveDefaults}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save these as my default"}
            </button>
          )}
          <span className="sfm-discover-save-message" role="status">
            {saveMessage}
          </span>
        </div>
      </div>
    </section>
  );
}
