import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  attendDiscoveredGig,
  fetchDiscoveredGigs,
  saveGigDiscoverySettings,
  toggleDiscoveredGigInterest,
} from "../../api/setlists";
import DiscoverFilters, { countryName, shortCity } from "./DiscoverFilters";
import DiscoverKey from "./DiscoverKey";
import DiscoverSettingsModal from "./DiscoverSettingsModal";
import SetlistDateBadge from "./SetlistDateBadge";
import SkiddleCredit from "./SkiddleCredit";

const PAGE_SIZE = 20;
const RADIUS_DEBOUNCE_MS = 500;

const DATE_LABELS = {
  all: "Any time",
  weekend: "This weekend",
  "7d": "Next 7 days",
  "30d": "Next 30 days",
};

function clampRadius(value) {
  return Math.max(1, Math.min(100, Math.round(Number(value)) || 1));
}

/** Older saved settings kept "newly announced" and "interested" in the date window. */
function splitLegacyWindow(savedWindow, savedFilters) {
  let dateWindow = savedWindow || "all";
  let onlyNew = Boolean(savedFilters.only_new);
  let onlyInterested = Boolean(savedFilters.only_interested);
  if (dateWindow === "newly_announced") {
    dateWindow = "all";
    onlyNew = true;
  } else if (dateWindow === "interested") {
    dateWindow = "all";
    onlyInterested = true;
  }
  return { dateWindow, onlyNew, onlyInterested };
}

function describeResults({
  count,
  scope,
  homeCity,
  hasHomeCity,
  radiusMiles,
  country,
  onlyInterested,
}) {
  const noun = count === 1 ? "gig" : "gigs";
  if (onlyInterested) return `${count} ${noun} on your shortlist`;
  if (scope === "local") {
    return hasHomeCity
      ? `${count} ${noun} within ${radiusMiles} miles of ${shortCity(homeCity)}`
      : `${count} ${noun}`;
  }
  return country
    ? `${count} ${noun} by your artists in ${countryName(country)}`
    : `${count} ${noun} by your artists`;
}

export default function DiscoverGigsTab({ token, onOpenGig, onGigAdded }) {
  const [scope, setScope] = useState("my_artists");
  const [onlyMyArtists, setOnlyMyArtists] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [radiusInput, setRadiusInput] = useState("10");
  const [dateWindow, setDateWindow] = useState("all");
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyInterested, setOnlyInterested] = useState(false);
  const [country, setCountry] = useState("");
  const initializedFromPrefsRef = useRef(false);
  const userChangedFiltersRef = useRef(false);
  const skipNextFetchRef = useRef(false);
  const latestRequestRef = useRef(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [criteriaError, setCriteriaError] = useState("");
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [isCriteriaOpen, setIsCriteriaOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [busyGigId, setBusyGigId] = useState(null);

  const loadGigs = useCallback(
    async (overrides = {}) => {
      if (!token) return;
      const requestId = ++latestRequestRef.current;
      setLoading(true);
      setError("");
      try {
        const isInit = initializedFromPrefsRef.current;
        const res = await fetchDiscoveredGigs({
          token,
          scope: overrides.scope ?? (isInit ? scope : undefined),
          onlyMyArtists: overrides.onlyMyArtists ?? (isInit ? onlyMyArtists : undefined),
          radiusMiles: overrides.radiusMiles ?? (isInit ? radiusMiles : undefined),
          dateWindow: overrides.dateWindow ?? (isInit ? dateWindow : undefined),
          country: overrides.country ?? (isInit ? country : undefined),
          onlyNew: overrides.onlyNew ?? (isInit ? onlyNew : undefined),
          onlyInterested: overrides.onlyInterested ?? (isInit ? onlyInterested : undefined),
        });
        // A newer request has started since this one: its answer is the one to show.
        if (requestId !== latestRequestRef.current) return;
        setData(res);
        if (!isInit && res) {
          initializedFromPrefsRef.current = true;
          if (!userChangedFiltersRef.current) {
            const sf = res.saved_filters || {};
            const legacy = splitLegacyWindow(sf.date_window, sf);
            const nextScope = sf.scope || "my_artists";
            const nextOnlyMyArtists = Boolean(sf.local_only_my_artists);
            const nextRadius = res.saved_radius_miles || 10;
            const nextCountry = sf.country_code || "";
            if (
              nextScope !== scope ||
              nextOnlyMyArtists !== onlyMyArtists ||
              nextRadius !== radiusMiles ||
              legacy.dateWindow !== dateWindow ||
              legacy.onlyNew !== onlyNew ||
              legacy.onlyInterested !== onlyInterested ||
              nextCountry !== country
            ) {
              skipNextFetchRef.current = true;
              setScope(nextScope);
              setOnlyMyArtists(nextOnlyMyArtists);
              setRadiusMiles(nextRadius);
              setRadiusInput(String(nextRadius));
              setDateWindow(legacy.dateWindow);
              setOnlyNew(legacy.onlyNew);
              setOnlyInterested(legacy.onlyInterested);
              setCountry(nextCountry);
            }
          }
        }
      } catch (err) {
        if (requestId !== latestRequestRef.current) return;
        setError(err.message || "Could not load discovered gigs.");
      } finally {
        if (requestId === latestRequestRef.current) setLoading(false);
      }
    },
    [token, scope, onlyMyArtists, radiusMiles, dateWindow, country, onlyNew, onlyInterested]
  );

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    setVisibleCount(PAGE_SIZE);
    loadGigs();
  }, [loadGigs]);

  // Typing in the radius box waits for a pause, so each keystroke is not a new search.
  useEffect(() => {
    if (!initializedFromPrefsRef.current || radiusInput === "") return undefined;
    const next = clampRadius(radiusInput);
    if (next === radiusMiles) return undefined;
    const timer = setTimeout(() => setRadiusMiles(next), RADIUS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [radiusInput, radiusMiles]);

  const commitRadius = () => {
    const next = clampRadius(radiusInput);
    setRadiusInput(String(next));
    setRadiusMiles(next);
  };

  const saved = data?.saved_filters || {};
  const savedLegacy = splitLegacyWindow(saved.date_window, saved);
  const isDirty =
    Boolean(data) &&
    initializedFromPrefsRef.current &&
    (scope !== (saved.scope || "my_artists") ||
      onlyMyArtists !== Boolean(saved.local_only_my_artists) ||
      dateWindow !== savedLegacy.dateWindow ||
      onlyNew !== savedLegacy.onlyNew ||
      onlyInterested !== savedLegacy.onlyInterested ||
      country !== (saved.country_code || "") ||
      radiusMiles !== (data.saved_radius_miles || 10));

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    setSaveMessage("");
    try {
      const merged = {
        ...saved,
        scope,
        local_only_my_artists: onlyMyArtists,
        date_window: dateWindow,
        only_new: onlyNew,
        only_interested: onlyInterested,
        country_code: country,
      };
      const radius = clampRadius(radiusMiles);
      await saveGigDiscoverySettings({
        token,
        localGigRadiusMiles: radius,
        gigDiscoveryFilters: merged,
      });
      setData((prev) =>
        prev ? { ...prev, saved_filters: merged, saved_radius_miles: radius } : prev
      );
      setSaveMessage("Saved as your default");
      setTimeout(() => setSaveMessage(""), 2500);
    } catch (err) {
      setError(err.message || "Could not save defaults.");
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleSaveCriteria = async (criteria) => {
    setSavingDefaults(true);
    setCriteriaError("");
    try {
      const merged = {
        ...saved,
        ...criteria,
      };
      await saveGigDiscoverySettings({
        token,
        gigDiscoveryFilters: merged,
      });
      setIsCriteriaOpen(false);
      await loadGigs();
    } catch (err) {
      setCriteriaError(err.message || "Could not save artist criteria.");
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
          Gig discovery is not configured yet. Add a free <code>SKIDDLE_API_KEY</code> (UK events)
          or <code>TICKETMASTER_API_KEY</code> in your server environment to see upcoming and local
          gigs.
        </p>
      </div>
    );
  }

  const items = data?.items || [];
  const shownItems = items.slice(0, visibleCount);
  const needsHomeCity = scope === "local" && !onlyInterested && data && !data.has_home_city;
  const filterSummary = [
    scope === "local" ? "Local Radar" : "My Artists",
    scope === "local" ? `${radiusMiles} mi` : country ? countryName(country) : null,
    DATE_LABELS[dateWindow],
    onlyNew ? "New" : null,
    onlyInterested ? "Interested" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const userSet = (setter) => (value) => {
    userChangedFiltersRef.current = true;
    setter(value);
  };

  return (
    <div className="sfm-discover">
      <DiscoverFilters
        scope={scope}
        onScopeChange={userSet(setScope)}
        homeCity={data?.home_city}
        hasHomeCity={Boolean(data?.has_home_city)}
        radiusInput={radiusInput}
        onRadiusInputChange={setRadiusInput}
        onRadiusCommit={(val) => {
          userChangedFiltersRef.current = true;
          commitRadius(val);
        }}
        onlyMyArtists={onlyMyArtists}
        onOnlyMyArtistsChange={userSet(setOnlyMyArtists)}
        country={country}
        countries={data?.countries}
        onCountryChange={userSet(setCountry)}
        dateWindow={dateWindow}
        onDateWindowChange={userSet(setDateWindow)}
        onlyNew={onlyNew}
        onOnlyNewChange={userSet(setOnlyNew)}
        onlyInterested={onlyInterested}
        onOnlyInterestedChange={userSet(setOnlyInterested)}
        summary={filterSummary}
        open={filtersOpen}
        onToggleOpen={() => setFiltersOpen((value) => !value)}
        isDirty={isDirty}
        saving={savingDefaults}
        saveMessage={saveMessage}
        onSaveDefaults={handleSaveDefaults}
        onOpenCriteria={() => setIsCriteriaOpen(true)}
      />

      {error && (
        <div className="sfm-error" role="alert">
          {error}
        </div>
      )}

      {needsHomeCity ? (
        <div className="sfm-empty">
          <p>
            Set your home city or postcode in <Link to="/settings">Settings → Home city</Link> to
            see local gigs within your {radiusMiles}-mile radius.
          </p>
        </div>
      ) : !data && loading ? (
        <div className="sfm-empty" role="status">
          Checking upcoming gigs...
        </div>
      ) : !data ? null : (
        <>
          <div className="sfm-discover-list-head">
            <p className="sfm-discover-count" role="status">
              {loading
                ? "Updating..."
                : describeResults({
                    count: items.length,
                    scope,
                    homeCity: data?.home_city,
                    hasHomeCity: Boolean(data?.has_home_city),
                    radiusMiles,
                    country,
                    onlyInterested,
                  })}
            </p>
            <DiscoverKey />
          </div>

          {!items.length ? (
            <div className="sfm-empty">
              No upcoming gigs match these filters yet. Try a wider radius, choose{" "}
              <strong>Any time</strong>, or turn off the <strong>Only</strong> filters.
            </div>
          ) : (
            <div className={`sfm-discover-list ${loading ? "is-loading" : ""}`} aria-busy={loading}>
              {shownItems.map((gig) => {
                const showArtist =
                  gig.artist_name &&
                  !gig.event_name.toLowerCase().includes(gig.artist_name.toLowerCase());
                const isGoing = Boolean(gig.already_going && gig.concert_id);
                return (
                  <article key={gig.id} className="sfm-discover-card">
                    <SetlistDateBadge date={gig.event_date} />
                    <div className="sfm-discover-body">
                      <div className="sfm-discover-title-row">
                        <strong className="sfm-discover-event">{gig.event_name}</strong>
                        {gig.is_newly_announced && (
                          <span className="sfm-badge sfm-badge-new">Newly announced</span>
                        )}
                        {gig.is_my_artist && !gig.is_possible_match && (
                          <span className="sfm-badge sfm-badge-artist">Your artist</span>
                        )}
                        {gig.is_possible_match && (
                          <span className="sfm-badge sfm-badge-possible">Check line-up</span>
                        )}
                        {gig.is_seen_live && <span className="sfm-badge">Seen live</span>}
                      </div>
                      <div className="sfm-discover-meta">
                        {showArtist && (
                          <>
                            <span>{gig.artist_name}</span>
                            <span aria-hidden="true">•</span>
                          </>
                        )}
                        <span>
                          {gig.venue_name}
                          {gig.city ? `, ${gig.city}` : ""}
                          {gig.country_code ? ` (${gig.country_code})` : ""}
                        </span>
                        {gig.distance_miles !== null && gig.distance_miles !== undefined && (
                          <>
                            <span aria-hidden="true">•</span>
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
                          {gig.source === "skiddle" ? "View on Skiddle ↗" : "Tickets ↗"}
                        </a>
                      )}
                      {!isGoing && (
                        <button
                          type="button"
                          className={`sfm-action sfm-btn-mixed ${gig.is_interested ? "is-interested" : ""}`}
                          disabled={busyGigId === gig.id}
                          onClick={() => handleToggleInterest(gig)}
                        >
                          {gig.is_interested ? "★ Interested" : "I'm interested"}
                        </button>
                      )}
                      {isGoing ? (
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
                );
              })}
            </div>
          )}

          {items.length > shownItems.length && (
            <div className="sfm-discover-more">
              <button
                type="button"
                className="sfm-action sfm-btn-mixed"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, items.length - shownItems.length)} more (
                {items.length - shownItems.length} left)
              </button>
            </div>
          )}
        </>
      )}

      {items.some((gig) => gig.source === "skiddle") && <SkiddleCredit />}

      <DiscoverSettingsModal
        isOpen={isCriteriaOpen}
        onClose={() => {
          setCriteriaError("");
          setIsCriteriaOpen(false);
        }}
        initialFilters={data?.saved_filters}
        onSave={handleSaveCriteria}
        isSaving={savingDefaults}
        errorMessage={criteriaError}
      />
    </div>
  );
}
