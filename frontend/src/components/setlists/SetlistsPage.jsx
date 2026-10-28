import { useState, useEffect } from "react";
import { readSession } from "../../session";
import {
  searchSetlists,
  fetchVenueSupportActs,
  logConcertAttendance,
  fetchAttendances,
  fetchArtistsSeenLeaderboard,
  fetchSongsHeardLeaderboard,
  fetchVenuesVisitedLeaderboard,
} from "../../api/setlists";
import GigSearchBar from "./GigSearchBar";
import GigCard from "./GigCard";
import SupportActsPromptModal from "./SupportActsPromptModal";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Data collections
  const [myGigs, setMyGigs] = useState([]);
  const [artistsLeaderboard, setArtistsLeaderboard] = useState([]);
  const [songsLeaderboard, setSongsLeaderboard] = useState([]);
  const [venuesLeaderboard, setVenuesLeaderboard] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

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
      // Look up support acts at the same venue and date
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
      setIsModalOpen(true);
    } catch (err) {
      console.error("Error fetching support acts:", err);
      setSupportActs([]);
      setIsModalOpen(true);
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
      setIsModalOpen(false);
      setSelectedMainSetlist(null);
      setToastMessage("Concert logged! Songs added to your scrobble library.");
      setTimeout(() => setToastMessage(""), 4000);
      // Switch back to My Gigs to see the logged show
      setActiveTab("gigs");
    } catch (err) {
      alert(`Error logging concert: ${err.message}`);
    } finally {
      setIsLogging(false);
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
          ) : myGigs.length === 0 ? (
            <div className="card p-8 text-center text-muted">
              You haven't logged any gigs yet. Tap <strong>+ Log a Gig</strong> to get started!
            </div>
          ) : (
            <div className="space-y-3">
              {myGigs.map((gig) => (
                <div key={gig.id} className="card p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-base">
                      {gig.artist_name} at {gig.venue_name}
                    </h3>
                    <div className="text-xs text-muted">
                      {gig.city}, {gig.country} &bull;{" "}
                      {gig.event_date ? new Date(gig.event_date).toLocaleDateString() : ""} &bull;{" "}
                      {gig.song_count} songs
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "artists" && (
        <div className="space-y-2">
          {isLoadingData ? (
            <div className="text-center py-10 text-muted">Loading artist leaderboard...</div>
          ) : artistsLeaderboard.length === 0 ? (
            <div className="card p-8 text-center text-muted">No artists seen logged yet.</div>
          ) : (
            artistsLeaderboard.map((a, idx) => (
              <div key={a.artist_name} className="card p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted font-bold w-6">{idx + 1}</span>
                  <span className="font-semibold text-sm">{a.artist_name}</span>
                </div>
                <span className="badge font-bold px-2.5 py-0.5 rounded-full text-xs bg-surface-hover">
                  {a.count} {a.count === 1 ? "gig" : "gigs"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "songs" && (
        <div className="space-y-2">
          {isLoadingData ? (
            <div className="text-center py-10 text-muted">Loading songs leaderboard...</div>
          ) : songsLeaderboard.length === 0 ? (
            <div className="card p-8 text-center text-muted">No live songs recorded yet.</div>
          ) : (
            songsLeaderboard.map((s, idx) => (
              <div
                key={`${s.track_name}-${s.artist_name}`}
                className="card p-3 flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted font-bold w-6">{idx + 1}</span>
                  <div>
                    <div className="font-semibold text-sm">{s.track_name}</div>
                    <div className="text-xs text-muted">{s.artist_name}</div>
                  </div>
                </div>
                <span className="badge font-bold px-2.5 py-0.5 rounded-full text-xs bg-surface-hover">
                  {s.count} {s.count === 1 ? "time" : "times"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "venues" && (
        <div className="space-y-2">
          {isLoadingData ? (
            <div className="text-center py-10 text-muted">Loading venues leaderboard...</div>
          ) : venuesLeaderboard.length === 0 ? (
            <div className="card p-8 text-center text-muted">No venues visited yet.</div>
          ) : (
            venuesLeaderboard.map((v, idx) => (
              <div
                key={`${v.venue_name}-${v.city}`}
                className="card p-3 flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted font-bold w-6">{idx + 1}</span>
                  <div>
                    <div className="font-semibold text-sm">{v.venue_name}</div>
                    <div className="text-xs text-muted">
                      {v.city}, {v.country}
                    </div>
                  </div>
                </div>
                <span className="badge font-bold px-2.5 py-0.5 rounded-full text-xs bg-surface-hover">
                  {v.count} {v.count === 1 ? "visit" : "visits"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Support Acts Prompt Modal */}
      <SupportActsPromptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mainSetlist={selectedMainSetlist}
        supportActs={supportActs}
        onConfirm={handleConfirmAttendance}
        isSubmitting={isLogging}
      />
    </div>
  );
}
