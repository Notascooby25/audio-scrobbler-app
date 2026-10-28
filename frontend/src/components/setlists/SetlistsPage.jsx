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

export default function SetlistsPage() {
  const session = readSession();
  const token = session?.accessToken;

  const [activeTab, setActiveTab] = useState("gigs"); // 'gigs' | 'artists' | 'songs' | 'venues' | 'log'
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

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

  const handleSearch = async (params) => {
    if (!token) return;
    setIsSearching(true);
    setSearchError("");
    try {
      const data = await searchSetlists({ token, ...params });
      setSearchResults(data?.setlist || []);
    } catch (err) {
      setSearchError(err.message || "Error searching setlists.");
    } finally {
      setIsSearching(false);
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

  const handleDeleteConfirm = async (concertId, includeSupportActs) => {
    if (!token) return;
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

  const handleImportSubmit = async (username) => {
    if (!token) return;
    setIsImporting(true);
    try {
      const res = await importSetlistHistory({ token, username });
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
            <div>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                Found {searchResults.length} Results
              </h2>
              {searchResults.map((setlist) => (
                <GigCard
                  key={setlist.id}
                  setlist={setlist}
                  onLogAttendance={handleOpenAttendanceModal}
                  isLogging={isLogging}
                />
              ))}
            </div>
          )}

          {!isSearching && searchResults.length === 0 && !searchError && (
            <div className="card p-8 text-center text-muted text-sm">
              Search for an artist or venue above to find your concert and log attendance.
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
              onRefreshSetlist={handleRefreshSetlist}
              onDeleteGig={(gig) => setGigToDelete(gig)}
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
            <ArtistsSeenLeaderboard artists={artistsLeaderboard} />
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
    </div>
  );
}
