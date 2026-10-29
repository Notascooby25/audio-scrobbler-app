import { useState, useEffect } from "react";
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
import SetlistDetailModal from "./SetlistDetailModal";
import { isFutureDate } from "./SetlistDateBadge";

export default function SetlistsPage() {
  const session = readSession();
  const token = session?.accessToken;

  const [activeTab, setActiveTab] = useState("gigs"); // 'gigs' | 'artists' | 'songs' | 'venues' | 'log'
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
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

  // Detail modal state
  const [selectedSetlistForDetail, setSelectedSetlistForDetail] = useState(null);

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
  const [isLoadingData, setIsLoadingData] = useState(false);

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

  const handleOpenSetlistDetail = (item) => {
    if (!item) return;
    const setlistId = item.setlist_id || item.id;
    const loggedId = typeof item.id === "number" ? item.id : null;
    const initial = item.raw_data
      ? { ...item.raw_data, notes: item.notes, logged_concert_id: loggedId }
      : { ...item, logged_concert_id: loggedId };
    setSelectedSetlistForDetail({
      setlistId,
      initialData: initial,
    });
  };

  const handleNotesSaved = (concertId, newNotes) => {
    setMyGigs((prev) => prev.map((g) => (g.id === concertId ? { ...g, notes: newNotes } : g)));
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="fixed bottom-5 right-5 z-50 p-4 rounded bg-success text-white font-medium shadow-md transition-all"
          style={{ backgroundColor: "#15803d" }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header and Sub-navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Set Lists</h1>
          <p className="text-sm text-muted">
            Track your concert attendances, live song history, and artist stats
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Tabs */}
          <div
            className="inline-flex rounded-lg p-1 bg-surface-hover"
            style={{ border: "0.5px solid var(--color-border)" }}
            role="tablist"
          >
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "gigs" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
              onClick={() => setActiveTab("gigs")}
            >
              My Gigs
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "artists" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
              onClick={() => setActiveTab("artists")}
            >
              Artists Seen
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "songs" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
              onClick={() => setActiveTab("songs")}
            >
              Songs Heard
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "venues" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
              onClick={() => setActiveTab("venues")}
            >
              Venues
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeTab === "log" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
              onClick={() => setActiveTab("log")}
            >
              + Log a Gig
            </button>
          </div>

          {/* Import / Export Trigger */}
          <button
            type="button"
            className="btn btn-secondary text-xs px-2.5 py-1.5"
            onClick={() => setIsImportExportOpen(true)}
            title="Import from Setlist.fm or Export your gigs"
          >
            Import / Export
          </button>
        </div>
      </div>

      {/* Setlist.fm API Key Unconfigured Warning */}
      {apiConfigured === false && (
        <div
          className="p-4 mb-6 rounded text-sm flex items-start gap-3"
          style={{
            border: "0.5px solid var(--color-danger, #ef4444)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "var(--color-ink, #ffffff)",
          }}
          data-testid="unconfigured-warning"
        >
          <span className="text-lg leading-none">⚠️</span>
          <div>
            <strong>Setlist.fm API key is not detected by the server.</strong>
            <p className="mt-1 text-xs text-muted">
              Concert searches and Setlist.fm imports require <code>SETLIST_FM_API_KEY</code>. If
              you added it to your <code>.env.production</code> on the NUC, make sure to reload it
              with:
              <br />
              <code className="text-xs bg-black/40 px-1 py-0.5 rounded mt-1 inline-block">
                docker compose --env-file .env.production -f docker-compose.prod.yml up -d
              </code>
            </p>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === "log" && (
        <div>
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
            <div className="card p-8 text-center text-muted text-sm">
              {hasSearched ? (
                <span>
                  No concerts found matching &quot;<strong>{lastSearchQuery}</strong>&quot;. Try
                  checking the artist spelling, clearing the venue or year filter (the tour may have
                  taken place in a different year), or selecting &quot;All Countries&quot;.
                </span>
              ) : (
                <span>
                  Search for an artist or venue above to find your concert and log attendance.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "gigs" && (
        <div>
          {isLoadingData ? (
            <div className="text-center py-10 text-muted">Loading your gigs...</div>
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
            <div className="text-center py-10 text-muted">Loading artists seen...</div>
          ) : (
            <ArtistsSeenLeaderboard
              artists={artistsLeaderboard}
              onOpenSetlist={handleOpenSetlistDetail}
            />
          )}
        </div>
      )}

      {activeTab === "songs" && (
        <div>
          {isLoadingData ? (
            <div className="text-center py-10 text-muted">Loading songs heard live...</div>
          ) : (
            <SongsHeardLeaderboard songs={songsLeaderboard} />
          )}
        </div>
      )}

      {activeTab === "venues" && (
        <div>
          {isLoadingData ? (
            <div className="text-center py-10 text-muted">Loading venues leaderboard...</div>
          ) : (
            <VenuesLeaderboard venues={venuesLeaderboard} />
          )}
        </div>
      )}

      {/* Setlist.fm Attribution */}
      <footer
        className="mt-12 pt-6 pb-2 text-center text-xs text-muted"
        style={{ borderTop: "0.5px solid var(--color-border)" }}
      >
        Concert and setlist data provided by{" "}
        <a
          href="https://www.setlist.fm"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink transition-colors"
        >
          setlist.fm
        </a>{" "}
        under their{" "}
        <a
          href="https://www.setlist.fm/help/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink transition-colors"
        >
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

      {/* Setlist Detail Modal */}
      {selectedSetlistForDetail && (
        <SetlistDetailModal
          setlistId={selectedSetlistForDetail.setlistId}
          initialData={selectedSetlistForDetail.initialData}
          token={token}
          onClose={() => setSelectedSetlistForDetail(null)}
          onLogAttendance={(setlist) => {
            setSelectedSetlistForDetail(null);
            handleOpenAttendanceModal(setlist);
          }}
          isLogging={isLogging}
          onNotesSaved={handleNotesSaved}
        />
      )}
    </div>
  );
}
