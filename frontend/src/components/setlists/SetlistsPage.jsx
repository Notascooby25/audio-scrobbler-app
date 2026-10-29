import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { readSession } from "../../session";
import {
  searchSetlists,
  fetchVenueSupportActs,
  logConcertAttendance,
  fetchAttendances,
  fetchArtistsSeenLeaderboard,
  fetchSongsHeardLeaderboard,
  fetchVenuesVisitedLeaderboard,
  importSetlistHistory,
  fetchSetlistStatus,
  alreadyLoggedInfo,
  deleteAttendance,
} from "../../api/setlists";
import AlreadyLoggedModal from "./AlreadyLoggedModal";
import DeleteGigConfirmModal from "./DeleteGigConfirmModal";
import GigSearchBar from "./GigSearchBar";
import GigCard from "./GigCard";
import SupportActsPromptModal from "./SupportActsPromptModal";
import MyGigsTimeline from "./MyGigsTimeline";
import ArtistsSeenLeaderboard from "./ArtistsSeenLeaderboard";
import SongsHeardLeaderboard from "./SongsHeardLeaderboard";
import VenuesLeaderboard from "./VenuesLeaderboard";
import ImportExportModal from "./ImportExportModal";
import ManualConcertModal from "./ManualConcertModal";
import SetlistAttribution from "./SetlistAttribution";
import { isFutureDate } from "./SetlistDateBadge";

const TABS = [
  { id: "gigs", label: "My Gigs", short: "Gigs" },
  { id: "artists", label: "Artists Seen", short: "Artists" },
  { id: "songs", label: "Songs Heard", short: "Songs" },
  { id: "venues", label: "Venues", short: "Venues" },
];
const TAB_IDS = [...TABS.map((t) => t.id), "log"];

export default function SetlistsPage() {
  const session = readSession();
  const token = session?.accessToken;

  // The active tab lives in the URL (?tab=) so the browser Back button returns to it
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = TAB_IDS.includes(tabParam) ? tabParam : "gigs";
  const setActiveTab = (tab) => setSearchParams(tab === "gigs" ? {} : { tab });
  const navigate = useNavigate();
  const openGig = (concertId) => navigate(`/gigs/${concertId}`);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const [apiConfigured, setApiConfigured] = useState(null);

  // Search pagination state
  const [lastSearchParams, setLastSearchParams] = useState(null);
  const [searchPage, setSearchPage] = useState(1);
  const [totalSearchResults, setTotalSearchResults] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Support act prompt state
  const [selectedMainSetlist, setSelectedMainSetlist] = useState(null);
  const [supportActs, setSupportActs] = useState([]);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  // Set when the backend says this gig is already logged; holds what to retry with
  const [duplicatePrompt, setDuplicatePrompt] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  // When set, the toast offers Undo for the gig that was just logged
  const [toastUndoGig, setToastUndoGig] = useState(null);
  const toastTimer = useRef(null);
  const [gigToRemove, setGigToRemove] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Import/Export modal state
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Data collections
  const [myGigs, setMyGigs] = useState([]);
  const [artistsLeaderboard, setArtistsLeaderboard] = useState([]);
  const [songsLeaderboard, setSongsLeaderboard] = useState([]);
  const [venuesLeaderboard, setVenuesLeaderboard] = useState([]);
  // Start in the loading state so empty-state text doesn't flash before the first fetch
  const [isLoadingData, setIsLoadingData] = useState(Boolean(token));

  const showToast = (msg, undoGig = null) => {
    clearTimeout(toastTimer.current);
    setToastMessage(msg);
    setToastUndoGig(undoGig);
    toastTimer.current = setTimeout(
      () => {
        setToastMessage("");
        setToastUndoGig(null);
      },
      undoGig ? 10000 : 4000
    );
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const removeGig = async (gig, includeSupportActs, doneMessage) => {
    setIsRemoving(true);
    try {
      await deleteAttendance({ token, concertId: gig.id, includeSupportActs });
      setGigToRemove(null);
      showToast(doneMessage);
      loadData();
    } catch (err) {
      alert(`Couldn't remove gig: ${err.message}`);
    } finally {
      setIsRemoving(false);
    }
  };

  const loadData = async () => {
    if (!token) return;
    setIsLoadingData(true);
    try {
      if (activeTab === "gigs") {
        const data = await fetchAttendances({ token });
        setMyGigs(data || []);
      } else if (activeTab === "artists") {
        const data = await fetchArtistsSeenLeaderboard({ token });
        setArtistsLeaderboard(data || []);
      } else if (activeTab === "songs") {
        const data = await fetchSongsHeardLeaderboard({ token });
        setSongsLeaderboard(data || []);
      } else if (activeTab === "venues") {
        const data = await fetchVenuesVisitedLeaderboard({ token });
        setVenuesLeaderboard(data || []);
      }
    } catch (err) {
      console.error("Error loading setlists data:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, token]);

  useEffect(() => {
    if (token) {
      fetchSetlistStatus({ token })
        .then((res) => {
          setApiConfigured(res?.configured ?? true);
        })
        .catch(() => {});
    }
  }, [token]);

  const handleSearch = async (params) => {
    if (!token) return;
    setIsSearching(true);
    setSearchError("");
    setHasSearched(true);
    setLastSearchParams(params);
    setSearchPage(1);
    const monthLabel = params.month ? `month ${params.month}` : null;
    const queryDesc = [params.artistName, params.venueName, monthLabel, params.year]
      .filter(Boolean)
      .join(" ");
    setLastSearchQuery(queryDesc || "your search query");
    try {
      const data = await searchSetlists({ token, ...params, p: 1 });
      setSearchResults(data?.setlist || []);
      setTotalSearchResults(data?.total || 0);
    } catch (err) {
      setSearchError(err.message || "Error searching setlists.");
      setSearchResults([]);
      setTotalSearchResults(0);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!token || !lastSearchParams || isLoadingMore) return;
    setIsLoadingMore(true);
    const nextPage = searchPage + 1;
    try {
      const data = await searchSetlists({ token, ...lastSearchParams, p: nextPage });
      const newItems = data?.setlist || [];
      setSearchResults((prev) => [...prev, ...newItems]);
      setSearchPage(nextPage);
      if (typeof data?.total === "number") {
        setTotalSearchResults(data.total);
      }
    } catch (err) {
      alert(`Error loading more shows: ${err.message}`);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleOpenAttendanceModal = async (setlist) => {
    setSelectedMainSetlist(setlist);
    setIsLogging(true);
    try {
      const venueId = setlist?.venue?.id;
      const eventDate = setlist?.eventDate;
      if (venueId && eventDate) {
        const otherActs = await fetchVenueSupportActs({
          token,
          venueId,
          eventDate,
          excludeSetlistId: setlist.id,
        });
        setSupportActs(otherActs || []);
      } else {
        setSupportActs([]);
      }
      setIsSupportModalOpen(true);
    } catch (err) {
      console.error("Error fetching support acts:", err);
      setSupportActs([]);
      setIsSupportModalOpen(true);
    } finally {
      setIsLogging(false);
    }
  };

  const handleConfirmAttendance = async (chosenSupportIds, allowDuplicate = false) => {
    if (!token || !selectedMainSetlist) return;
    setIsLogging(true);
    try {
      const logged = await logConcertAttendance({
        token,
        setlistId: selectedMainSetlist.id,
        supportSetlistIds: chosenSupportIds,
        allowDuplicate,
      });
      // Re-logging the same show only refreshed an existing gig, so there's nothing to undo
      const refreshedExisting = Boolean(duplicatePrompt?.info?.same_show);
      setIsSupportModalOpen(false);
      setDuplicatePrompt(null);
      setSelectedMainSetlist(null);
      showToast(
        refreshedExisting
          ? "Gig refreshed. Songs updated in your scrobble library."
          : "Concert logged! Songs added to your scrobble library.",
        refreshedExisting ? null : logged
      );
      setActiveTab("gigs");
    } catch (err) {
      const info = alreadyLoggedInfo(err);
      if (info) {
        setIsSupportModalOpen(false);
        setDuplicatePrompt({ info, chosenSupportIds });
      } else {
        alert(`Error logging concert: ${err.message}`);
      }
    } finally {
      setIsLogging(false);
    }
  };

  const handleImportSubmit = async (username, setlistIds = null) => {
    if (!token) return;
    setIsImporting(true);
    try {
      const res = await importSetlistHistory({ token, username, setlistIds });
      setIsImportExportOpen(false);
      if (res?.status === "completed") {
        showToast(`Imported ${res?.imported_count || 0} concerts from Setlist.fm!`);
      } else if (res?.status === "paused_rate_limit") {
        showToast(
          `Imported ${res?.imported_count || 0} concerts, then paused at the daily Setlist.fm limit. ${
            res?.resumes_automatically
              ? "The rest will import automatically after midnight UTC."
              : "Progress saved!"
          }`
        );
      } else {
        showToast(`Import finished with status: ${res?.status}`);
      }
      loadData();
    } catch (err) {
      alert(`Import error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleManualSaved = (newGig) => {
    showToast(`Logged "${newGig?.artist_name || "Upcoming gig"}"!`, newGig?.id ? newGig : null);
    loadData();
    setActiveTab("gigs");
  };

  return (
    <div className="sfm-page">
      {toastMessage && (
        <div className="sfm-toast" role="status">
          {toastMessage}
          {toastUndoGig && (
            <button
              type="button"
              className="sfm-link"
              onClick={() => removeGig(toastUndoGig, true, "Gig removed.")}
              disabled={isRemoving}
            >
              Undo
            </button>
          )}
        </div>
      )}

      <header className="sfm-page-header">
        <h1>Set Lists</h1>
        <p className="sfm-page-intro">
          Track your concert attendances, live song history, and artist stats
        </p>
      </header>

      {apiConfigured === false && (
        <div className="sfm-warning" data-testid="unconfigured-warning">
          <strong>Setlist.fm API key is not detected by the server.</strong>
          <p>
            Concert searches and Setlist.fm imports require <code>SETLIST_FM_API_KEY</code>. If you
            added it to your <code>.env.production</code> on the NUC, reload it with:{" "}
            <code>docker compose --env-file .env.production -f docker-compose.prod.yml up -d</code>
          </p>
        </div>
      )}

      <section className="sfm-panel">
        <div className="sfm-tabbar">
          <div className="sfm-tabs" role="tablist" aria-label="Set Lists sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`sfm-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="sfm-tab-long">{tab.label}</span>
                <span className="sfm-tab-short" aria-hidden="true">
                  {tab.short}
                </span>
              </button>
            ))}
          </div>
          <div className="sfm-tabbar-actions">
            <button
              type="button"
              className={`sfm-link ${activeTab === "log" ? "is-current" : ""}`}
              onClick={() => setActiveTab("log")}
            >
              + Log a Gig
            </button>
            <button
              type="button"
              className="sfm-link"
              onClick={() => setIsImportExportOpen(true)}
              title="Import from Setlist.fm or Export your gigs"
            >
              Import / Export
            </button>
          </div>
        </div>

        {/* Main Tab Content */}
        {activeTab === "log" && (
          <div>
            <div className="sfm-section-head">
              <h2>Log a Gig</h2>
              <div className="sfm-search-hint">
                <p className="sfm-section-desc">
                  Search Setlist.fm, or paste a show&apos;s Setlist.fm link or ID.
                </p>
                <button
                  type="button"
                  className="sfm-link"
                  onClick={() => setIsManualModalOpen(true)}
                >
                  + Add Upcoming Show Manually
                </button>
              </div>
            </div>

            <GigSearchBar onSearch={handleSearch} isLoading={isSearching} />

            {searchError && (
              <p className="sfm-error" role="alert">
                {searchError}
              </p>
            )}

            {isSearching && <p className="sfm-empty">Searching Setlist.fm...</p>}

            {!isSearching && searchResults.length > 0 && (
              <div>
                <div className="sfm-results-head">
                  <span>Found {totalSearchResults || searchResults.length} results</span>
                  <span>
                    Showing {searchResults.length} of {totalSearchResults || searchResults.length}
                  </span>
                </div>

                {[
                  ["Upcoming Shows", searchResults.filter((s) => isFutureDate(s.eventDate))],
                  ["Past Shows", searchResults.filter((s) => !isFutureDate(s.eventDate))],
                ]
                  .filter(([, group]) => group.length > 0)
                  .map(([title, group], _idx, groups) => (
                    <div key={title} className="sfm-results-group">
                      {/* Only label the groups when results span both */}
                      {(groups.length > 1 || title === "Upcoming Shows") && (
                        <h3>
                          {title} ({group.length})
                        </h3>
                      )}
                      <div className="sfm-gig-list">
                        {group.map((setlist) => (
                          <GigCard
                            key={setlist.id}
                            setlist={setlist}
                            onLogAttendance={handleOpenAttendanceModal}
                            isLogging={isLogging}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                {searchResults.length < totalSearchResults && (
                  <div className="sfm-load-more">
                    <button
                      type="button"
                      className="sfm-action"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? "Loading more shows..." : "View More Shows (+20)"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isSearching && searchResults.length === 0 && !searchError && (
              <div className="sfm-empty">
                {hasSearched ? (
                  <>
                    <p>
                      No concerts found matching &quot;<strong>{lastSearchQuery}</strong>&quot;. Try
                      checking the artist spelling, clearing the venue or year filter (the tour may
                      have taken place in a different year), or selecting &quot;All Countries&quot;.
                    </p>
                    <p>
                      Upcoming tour dates not yet on Setlist.fm? Paste the show&apos;s Setlist.fm
                      link above, or{" "}
                      <button
                        type="button"
                        className="sfm-link"
                        onClick={() => setIsManualModalOpen(true)}
                      >
                        + Add Upcoming / Custom Show Manually
                      </button>
                    </p>
                  </>
                ) : (
                  <p>Search for an artist or venue above to find your concert and log it.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "gigs" && (
          <div>
            {isLoadingData ? (
              <div className="sfm-empty">Loading your gigs...</div>
            ) : (
              <MyGigsTimeline gigs={myGigs} onOpenGig={openGig} onRemoveGig={setGigToRemove} />
            )}
          </div>
        )}

        {activeTab === "artists" && (
          <div>
            {isLoadingData ? (
              <div className="sfm-empty">Loading artists seen...</div>
            ) : (
              <ArtistsSeenLeaderboard artists={artistsLeaderboard} onOpenGig={openGig} />
            )}
          </div>
        )}

        {activeTab === "songs" && (
          <div>
            {isLoadingData ? (
              <div className="sfm-empty">Loading songs heard live...</div>
            ) : (
              <SongsHeardLeaderboard songs={songsLeaderboard} onOpenGig={openGig} />
            )}
          </div>
        )}

        {activeTab === "venues" && (
          <div>
            {isLoadingData ? (
              <div className="sfm-empty">Loading venues leaderboard...</div>
            ) : (
              <VenuesLeaderboard venues={venuesLeaderboard} onOpenGig={openGig} />
            )}
          </div>
        )}
      </section>

      <SetlistAttribution />

      {/* Support Acts Prompt Modal */}
      <SupportActsPromptModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        mainSetlist={selectedMainSetlist}
        supportActs={supportActs}
        onConfirm={handleConfirmAttendance}
        isSubmitting={isLogging}
      />

      <DeleteGigConfirmModal
        key={gigToRemove?.id}
        isOpen={Boolean(gigToRemove)}
        onClose={() => setGigToRemove(null)}
        gig={gigToRemove}
        onConfirm={(_id, includeSupportActs) =>
          removeGig(gigToRemove, includeSupportActs, `Removed ${gigToRemove.artist_name}.`)
        }
        isDeleting={isRemoving}
      />

      <AlreadyLoggedModal
        info={duplicatePrompt?.info}
        isSubmitting={isLogging}
        onCancel={() => {
          setDuplicatePrompt(null);
          setSelectedMainSetlist(null);
        }}
        onConfirm={() => handleConfirmAttendance(duplicatePrompt.chosenSupportIds, true)}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onImport={handleImportSubmit}
        onFileImported={() => loadData()}
        isImporting={isImporting}
        token={token}
      />

      {/* Manual Upcoming / Custom Concert Modal */}
      <ManualConcertModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSaved={handleManualSaved}
        token={token}
      />
    </div>
  );
}
