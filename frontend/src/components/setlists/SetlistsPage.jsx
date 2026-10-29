import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { readSession } from "../../session";
import {
  searchSetlists,
  fetchVenueSupportActs,
  logConcertAttendance,
  fetchAttendances,
  deleteAttendance,
  refreshConcertSetlist,
  fetchArtistsSeenLeaderboard,
  fetchSongsHeardLeaderboard,
  fetchVenuesVisitedLeaderboard,
  importSetlistHistory,
  fetchSetlistStatus,
} from "../../api/setlists";
import GigSearchBar from "./GigSearchBar";
import GigCard from "./GigCard";
import SupportActsPromptModal from "./SupportActsPromptModal";
import MyGigsTimeline from "./MyGigsTimeline";
import ArtistsSeenLeaderboard from "./ArtistsSeenLeaderboard";
import SongsHeardLeaderboard from "./SongsHeardLeaderboard";
import VenuesLeaderboard from "./VenuesLeaderboard";
import DeleteGigConfirmModal from "./DeleteGigConfirmModal";
import ImportExportModal from "./ImportExportModal";
import ManualConcertModal from "./ManualConcertModal";
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
  const [toastMessage, setToastMessage] = useState("");

  // Delete modal state
  const [gigToDelete, setGigToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refresh setlist state
  const [isRefreshingId, setIsRefreshingId] = useState(null);

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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
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

  const handleConfirmAttendance = async (chosenSupportIds) => {
    if (!token || !selectedMainSetlist) return;
    setIsLogging(true);
    try {
      await logConcertAttendance({
        token,
        setlistId: selectedMainSetlist.id,
        supportSetlistIds: chosenSupportIds,
      });
      setIsSupportModalOpen(false);
      setSelectedMainSetlist(null);
      showToast("Concert logged! Songs added to your scrobble library.");
      setActiveTab("gigs");
    } catch (err) {
      alert(`Error logging concert: ${err.message}`);
    } finally {
      setIsLogging(false);
    }
  };

  const handleRefreshSetlist = async (gig) => {
    if (!token || !gig) return;
    setIsRefreshingId(gig.id);
    try {
      await refreshConcertSetlist({ token, concertId: gig.id });
      showToast(`Setlist for ${gig.artist_name} refreshed!`);
      loadData();
    } catch (err) {
      alert(`Error refreshing setlist: ${err.message}`);
    } finally {
      setIsRefreshingId(null);
    }
  };

  const handleDeleteConfirm = async (gigOrId, includeSupportActs = true) => {
    if (!token) return;
    const concertId = typeof gigOrId === "object" ? gigOrId.id : gigOrId;
    setIsDeleting(true);
    try {
      const res = await deleteAttendance({ token, concertId, includeSupportActs });
      setGigToDelete(null);
      showToast(`Gig removed (${res?.deleted_count || 1} acts purged from scrobbles).`);
      loadData();
    } catch (err) {
      alert(`Error deleting gig: ${err.message}`);
    } finally {
      setIsDeleting(false);
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
          `Import paused at ${res?.imported_count || 0} concerts (daily quota reached). Progress saved!`
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

  const handleNotesSaved = (concertId, newNotes) => {
    setMyGigs((prev) => prev.map((g) => (g.id === concertId ? { ...g, notes: newNotes } : g)));
    setArtistsLeaderboard((prev) =>
      prev.map((artist) => ({
        ...artist,
        gigs: (artist.gigs || []).map((g) => (g.id === concertId ? { ...g, notes: newNotes } : g)),
      }))
    );
  };

  const handleManualSaved = (newGig) => {
    showToast(`Logged "${newGig?.artist_name || "Upcoming gig"}"!`);
    loadData();
    setActiveTab("gigs");
  };

  return (
    <div className="sfm-page">
      {toastMessage && (
        <div className="sfm-toast" role="status">
          {toastMessage}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <span className="text-xs text-muted">
                Search Setlist.fm or paste direct show link / ID:
              </span>
              <button
                type="button"
                className="text-xs text-primary hover:underline font-bold cursor-pointer bg-transparent border-0 p-0 text-left sm:text-right"
                onClick={() => setIsManualModalOpen(true)}
              >
                + Add Upcoming Show Manually
              </button>
            </div>

            <GigSearchBar onSearch={handleSearch} isLoading={isSearching} />

            {searchError && (
              <div className="card p-4 mb-4 text-danger bg-danger-soft text-sm">{searchError}</div>
            )}

            {isSearching && (
              <div className="text-center py-10 text-muted text-sm">Searching Setlist.fm...</div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between text-xs text-muted uppercase tracking-wider">
                  <span>Found {totalSearchResults || searchResults.length} Results</span>
                  <span>
                    Showing {searchResults.length} of {totalSearchResults || searchResults.length}
                  </span>
                </div>

                {/* Upcoming Shows Group */}
                {searchResults.some((s) => isFutureDate(s.eventDate)) && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-1 border-b border-border">
                      <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                        Upcoming Shows
                      </h2>
                      <span className="badge text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {searchResults.filter((s) => isFutureDate(s.eventDate)).length}
                      </span>
                    </div>
                    <div>
                      {searchResults
                        .filter((s) => isFutureDate(s.eventDate))
                        .map((setlist) => (
                          <GigCard
                            key={setlist.id}
                            setlist={setlist}
                            token={token}
                            onLogAttendance={handleOpenAttendanceModal}
                            isLogging={isLogging}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* Past Shows Group */}
                {searchResults.some((s) => !isFutureDate(s.eventDate)) && (
                  <div>
                    {searchResults.some((s) => isFutureDate(s.eventDate)) && (
                      <div className="flex items-center gap-2 mb-3 pb-1 border-b border-border">
                        <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                          Past Shows
                        </h2>
                        <span className="badge text-[11px] font-bold px-2 py-0.5 rounded bg-surface-hover text-muted border border-border">
                          {searchResults.filter((s) => !isFutureDate(s.eventDate)).length}
                        </span>
                      </div>
                    )}
                    <div>
                      {searchResults
                        .filter((s) => !isFutureDate(s.eventDate))
                        .map((setlist) => (
                          <GigCard
                            key={setlist.id}
                            setlist={setlist}
                            token={token}
                            onLogAttendance={handleOpenAttendanceModal}
                            isLogging={isLogging}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* Pagination Button: View More Shows */}
                {searchResults.length < totalSearchResults && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      className="btn btn-secondary px-5 py-2 text-xs font-bold"
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
              <div className="card p-8 text-center text-muted text-sm space-y-3">
                {hasSearched ? (
                  <>
                    <p>
                      No concerts found matching &quot;<strong>{lastSearchQuery}</strong>&quot;. Try
                      checking the artist spelling, clearing the venue or year filter (the tour may
                      have taken place in a different year), or selecting &quot;All Countries&quot;.
                    </p>
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        type="button"
                        className="btn btn-primary text-xs px-3 py-1.5 font-bold"
                        onClick={() => setIsManualModalOpen(true)}
                      >
                        + Add Upcoming / Custom Show Manually
                      </button>
                    </div>
                    <p className="text-[11px] text-muted">
                      Upcoming tour dates not yet on Setlist.fm? You can paste their direct
                      Setlist.fm show link into the search bar, or add them manually above.
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                    <span>
                      Search for an artist or venue above to find your concert and log attendance.
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs px-3 py-1.5 shrink-0"
                      onClick={() => setIsManualModalOpen(true)}
                    >
                      + Add Show Manually
                    </button>
                  </div>
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
              <MyGigsTimeline
                gigs={myGigs}
                token={token}
                onRefreshSetlist={handleRefreshSetlist}
                onDeleteGig={handleDeleteConfirm}
                onNotesSaved={handleNotesSaved}
                isRefreshingId={isRefreshingId}
              />
            )}
          </div>
        )}

        {activeTab === "artists" && (
          <div>
            {isLoadingData ? (
              <div className="sfm-empty">Loading artists seen...</div>
            ) : (
              <ArtistsSeenLeaderboard artists={artistsLeaderboard} />
            )}
          </div>
        )}

        {activeTab === "songs" && (
          <div>
            {isLoadingData ? (
              <div className="sfm-empty">Loading songs heard live...</div>
            ) : (
              <SongsHeardLeaderboard songs={songsLeaderboard} />
            )}
          </div>
        )}

        {activeTab === "venues" && (
          <div>
            {isLoadingData ? (
              <div className="sfm-empty">Loading venues leaderboard...</div>
            ) : (
              <VenuesLeaderboard venues={venuesLeaderboard} />
            )}
          </div>
        )}
      </section>

      {/* Setlist.fm Attribution */}
      <footer className="sfm-attribution">
        Concert and setlist data provided by{" "}
        <a href="https://www.setlist.fm" target="_blank" rel="noopener noreferrer">
          setlist.fm
        </a>{" "}
        under their{" "}
        <a href="https://www.setlist.fm/help/terms" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>
        .
      </footer>

      {/* Support Acts Prompt Modal */}
      <SupportActsPromptModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        mainSetlist={selectedMainSetlist}
        supportActs={supportActs}
        onConfirm={handleConfirmAttendance}
        isSubmitting={isLogging}
      />

      {/* Delete Confirmation Modal */}
      <DeleteGigConfirmModal
        isOpen={!!gigToDelete}
        onClose={() => setGigToDelete(null)}
        gig={gigToDelete}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onImport={handleImportSubmit}
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
