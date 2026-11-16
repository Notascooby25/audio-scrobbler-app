import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  attendDiscoveredGig,
  fetchDiscoveredGigs,
  saveGigDiscoverySettings,
  toggleDiscoveredGigInterest,
} from "../../api/setlists";
import DiscoverSettingsModal from "./DiscoverSettingsModal";
import SetlistDateBadge from "./SetlistDateBadge";

const DATE_WINDOWS = [
  { id: "all", label: "All upcoming" },
  { id: "weekend", label: "This weekend" },
  { id: "7d", label: "Next 7 days" },
  { id: "30d", label: "Next 30 days" },
  { id: "newly_announced", label: "Newly announced" },
  { id: "interested", label: "Interested" },
];

export default function DiscoverGigsTab({ token, onOpenGig, onGigAdded }) {
  const [scope, setScope] = useState("my_artists");
  const [onlyMyArtists, setOnlyMyArtists] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [dateWindow, setDateWindow] = useState("all");
  const [country, setCountry] = useState("");
  const initializedFromPrefsRef = useRef(false);
  const skipNextFetchRef = useRef(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isCriteriaOpen, setIsCriteriaOpen] = useState(false);
  const [busyGigId, setBusyGigId] = useState(null);

  const loadGigs = useCallback(
    async (overrides = {}) => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const isInit = initializedFromPrefsRef.current;
        const res = await fetchDiscoveredGigs({
          token,
          scope: overrides.scope ?? (isInit ? scope : undefined),
          onlyMyArtists:
            overrides.onlyMyArtists ?? (isInit ? onlyMyArtists : undefined),
          radiusMiles: overrides.radiusMiles ?? (isInit ? radiusMiles : undefined),
          dateWindow: overrides.dateWindow ?? (isInit ? dateWindow : undefined),
          country: overrides.country ?? (isInit ? country : undefined),
        });
        setData(res);
        if (!isInit && res) {
          const sf = res.saved_filters || {};
          const nextScope = sf.scope || "my_artists";
          const nextOnlyMyArtists = Boolean(sf.local_only_my_artists);
          const nextRadius = res.saved_radius_miles || 10;
          const nextDateWindow = sf.date_window || "all";
          const nextCountry = sf.country_code || "";
          initializedFromPrefsRef.current = true;
          if (
            nextScope !== scope ||
            nextOnlyMyArtists !== onlyMyArtists ||
            nextRadius !== radiusMiles ||
            nextDateWindow !== dateWindow ||
            nextCountry !== country
          ) {
            skipNextFetchRef.current = true;
            setScope(nextScope);
            setOnlyMyArtists(nextOnlyMyArtists);
            setRadiusMiles(nextRadius);
            setDateWindow(nextDateWindow);
            setCountry(nextCountry);
          }
        }
      } catch (err) {
        setError(err.message || "Could not load discovered gigs.");
      } finally {
        setLoading(false);
      }
    },
    [token, scope, onlyMyArtists, radiusMiles, dateWindow, country]
  );

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    loadGigs();
  }, [loadGigs]);

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    setSaveMessage("");
    try {
      const merged = {
        ...(data?.saved_filters || {}),
        scope,
        local_only_my_artists: onlyMyArtists,
        date_window: dateWindow,
        country_code: country,
      };
      await saveGigDiscoverySettings({
        token,
        localGigRadiusMiles: Math.max(1, Math.min(100, Number(radiusMiles) || 10)),
        gigDiscoveryFilters: merged,
      });
      setSaveMessage("Defaults saved");
      setTimeout(() => setSaveMessage(""), 2500);
    } catch (err) {
      setError(err.message || "Could not save defaults.");
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleSaveCriteria = async (criteria) => {
    setSavingDefaults(true);
    try {
      const merged = {
        ...(data?.saved_filters || {}),
        ...criteria,
      };
      await saveGigDiscoverySettings({
        token,
        gigDiscoveryFilters: merged,
      });
      setIsCriteriaOpen(false);
      await loadGigs();
    } catch (err) {
      setError(err.message || "Could not save artist criteria.");
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleToggleInterest = async (gig) => {
    setBusyGigId(gig.id);
    try {
      const res = await toggleDiscoveredGigInterest({
        token,
        gigId: gig.id,
        interested: !gig.is_interested,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === gig.id ? { ...item, is_interested: res.is_interested } : item
              ),
            }
          : prev
      );
    } catch (err) {
      setError(err.message || "Could not update interest.");
    } finally {
      setBusyGigId(null);
    }
  };

  const handleAttend = async (gig) => {
    setBusyGigId(gig.id);
    try {
      const res = await attendDiscoveredGig({ token, gigId: gig.id });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === gig.id
                  ? { ...item, already_going: true, concert_id: res.concert_id }
                  : item
              ),
            }
          : prev
      );
      if (onGigAdded) onGigAdded();
    } catch (err) {
      setError(err.message || "Could not add gig to My Gigs.");
    } finally {
      setBusyGigId(null);
    }
  };

  if (data && !data.configured) {
    return (
      <div className="sfm-empty">
        <p>
          Gig discovery is not configured yet. Add a free <code>TICKETMASTER_API_KEY</code> in your
          server environment to see upcoming and local gigs.
        </p>
      </div>
    );
  }

  return (
    <div className="sfm-discover">
      <div className="sfm-discover-controls">
        <div className="sfm-discover-top-row">
          <div className="sfm-filter-pills" role="group" aria-label="Discovery scope">
            <button
              type="button"
              className={`sfm-pill sfm-btn-mixed ${scope === "my_artists" ? "is-active" : ""}`}
              onClick={() => setScope("my_artists")}
            >
              My Artists
            </button>
            <button
              type="button"
              className={`sfm-pill sfm-btn-mixed ${scope === "local" ? "is-active" : ""}`}
              onClick={() => setScope("local")}
            >
              Local Radar
            </button>
          </div>

          <div className="sfm-discover-actions-right">
            <button
              type="button"
              className="sfm-action sfm-btn-mixed"
              onClick={() => setIsCriteriaOpen(true)}
              aria-label="Artist criteria settings"
              title="Customise My Artists criteria"
            >
              ⚙ Criteria
            </button>
            <button
              type="button"
              className="sfm-action sfm-btn-mixed"
              onClick={handleSaveDefaults}
              disabled={savingDefaults}
            >
              {savingDefaults ? "Saving..." : saveMessage || "Save as default"}
            </button>
          </div>
        </div>

        <div className="sfm-discover-sub-row">
          {scope === "local" ? (
            <>
              <span className="sfm-discover-home-label">
                {data?.has_home_city ? `Near ${data.home_city}` : "No home city set"}
              </span>
              <label className="sfm-discover-radius">
                <span>Radius (mi)</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                />
              </label>
              <label className="sfm-discover-toggle">
                <input
                  type="checkbox"
                  checked={onlyMyArtists}
                  onChange={(e) => setOnlyMyArtists(e.target.checked)}
                />
                <span>My artists only</span>
              </label>
            </>
          ) : (
            <label className="sfm-discover-country">
              <span>Country</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">All countries</option>
                {(data?.countries || []).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="sfm-filter-pills" role="group" aria-label="Date and status filters">
          {DATE_WINDOWS.map((win) => (
            <button
              key={win.id}
              type="button"
              className={`sfm-pill sfm-btn-mixed ${dateWindow === win.id ? "is-active" : ""}`}
              onClick={() => setDateWindow(win.id)}
            >
              {win.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="sfm-error">{error}</div>}

      {scope === "local" && dateWindow !== "interested" && data && !data.has_home_city ? (
        <div className="sfm-empty">
          <p>
            Set your home city or postcode in{" "}
            <Link to="/settings">Settings → Home city</Link> to see local gigs within your{" "}
            {radiusMiles}-mile radius.
          </p>
        </div>
      ) : loading ? (
        <div className="sfm-empty">Checking upcoming gigs...</div>
      ) : !data?.items?.length ? (
        <div className="sfm-empty">
          No upcoming gigs match these filters yet. Try widening your radius, switching to{" "}
          <strong>All upcoming</strong>, or turning off <strong>My artists only</strong>.
        </div>
      ) : (
        <div className="sfm-discover-list">
          {data.items.map((gig) => (
            <article key={gig.id} className="sfm-discover-card">
              <SetlistDateBadge date={gig.event_date} />
              <div className="sfm-discover-body">
                <div className="sfm-discover-title-row">
                  <strong className="sfm-discover-event">{gig.event_name}</strong>
                  {gig.is_newly_announced && (
                    <span className="sfm-badge sfm-badge-new">Newly announced</span>
                  )}
                  {gig.is_my_artist && (
                    <span className="sfm-badge sfm-badge-artist">Your artist</span>
                  )}
                  {gig.is_seen_live && <span className="sfm-badge">Seen live</span>}
                </div>
                <div className="sfm-discover-meta">
                  <span>{gig.artist_name}</span>
                  <span>•</span>
                  <span>
                    {gig.venue_name}
                    {gig.city ? `, ${gig.city}` : ""}
                    {gig.country_code ? ` (${gig.country_code})` : ""}
                  </span>
                  {gig.distance_miles !== null && gig.distance_miles !== undefined && (
                    <>
                      <span>•</span>
                      <span>{gig.distance_miles} mi away</span>
                    </>
                  )}
                </div>
              </div>
              <div className="sfm-discover-card-actions">
                {gig.ticket_url && (
                  <a
                    href={gig.ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sfm-action sfm-btn-mixed"
                  >
                    Tickets ↗
                  </a>
                )}
                <button
                  type="button"
                  className={`sfm-action sfm-btn-mixed ${gig.is_interested ? "is-interested" : ""}`}
                  disabled={busyGigId === gig.id}
                  onClick={() => handleToggleInterest(gig)}
                >
                  {gig.is_interested ? "★ Interested" : "I'm interested"}
                </button>
                {gig.already_going && gig.concert_id ? (
                  <button
                    type="button"
                    className="sfm-action sfm-action-primary sfm-btn-mixed"
                    onClick={() => onOpenGig(gig.concert_id)}
                  >
                    ✓ Going
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sfm-action sfm-action-primary sfm-btn-mixed"
                    disabled={busyGigId === gig.id}
                    onClick={() => handleAttend(gig)}
                  >
                    + I&apos;m going
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <DiscoverSettingsModal
        isOpen={isCriteriaOpen}
        onClose={() => setIsCriteriaOpen(false)}
        initialFilters={data?.saved_filters}
        onSave={handleSaveCriteria}
        isSaving={savingDefaults}
      />
    </div>
  );
}
