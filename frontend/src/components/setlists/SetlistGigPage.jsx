import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { readSession } from "../../session";
import {
  deleteAttendance,
  fetchAttendance,
  fetchSetlistDetail,
  refreshConcertSetlist,
  updateConcertNotes,
} from "../../api/setlists";
import DeleteGigConfirmModal from "./DeleteGigConfirmModal";
import SetlistAttribution from "./SetlistAttribution";
import SetlistDateBadge, { isFutureDate, parseDateParts } from "./SetlistDateBadge";
import SetlistSongs from "./SetlistSongs";
import { processSetlistSets, setlistAsText } from "./setlistUiUtils";

function NotesEditor({ gig, token, onSaved }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(gig.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const save = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const notes = draft.trim() || null;
      await updateConcertNotes({ token, concertId: gig.id, notes });
      onSaved(notes);
      setIsEditing(false);
      setMessage("Note saved.");
    } catch (err) {
      setMessage(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="sfm-gig-section">
      <div className="sfm-gig-section-head">
        <h2>My notes</h2>
        {!isEditing && (
          <button
            type="button"
            className="sfm-link"
            onClick={() => {
              setDraft(gig.notes || "");
              setIsEditing(true);
              setMessage("");
            }}
          >
            {gig.notes ? "Edit note" : "+ Add note"}
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="sfm-notes-form">
          <textarea
            aria-label="Gig notes"
            placeholder="Record your memories (who you went with, support act highlights, favourite encore)..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            disabled={isSaving}
            rows={4}
          />
          <div className="sfm-notes-actions">
            <span className="sfm-gig-meta">{draft.length}/2000</span>
            <button
              type="button"
              className="sfm-link is-muted"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="button" onClick={save} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save note"}
            </button>
          </div>
        </div>
      ) : gig.notes ? (
        <p className="sfm-notes-text">{gig.notes}</p>
      ) : (
        <p className="sfm-gig-meta">No notes yet.</p>
      )}
      {message && (
        <p className="sfm-gig-meta" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

export default function SetlistGigPage() {
  const { concertId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = readSession()?.accessToken;

  const [gig, setGig] = useState(null);
  const [setlistData, setSetlistData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  // Arriving from inside the app, Back returns to the exact list state (tab, page,
  // expanded row); a direct visit has no in-app history, so fall back to My Gigs.
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/setlists");
  };

  useEffect(() => {
    if (!token) return undefined;
    let isMounted = true;
    setIsLoading(true);
    setError("");
    fetchAttendance({ token, concertId })
      .then(async (data) => {
        if (!isMounted) return;
        setGig(data);
        const isManual = data.setlist_id?.startsWith("manual-");
        if (data.raw_data?.sets || isManual || isFutureDate(data.event_date)) {
          setSetlistData(data.raw_data);
          return;
        }
        // Older imports may lack stored songs; fall back to the cached setlist lookup
        const detail = await fetchSetlistDetail({ token, setlistId: data.setlist_id }).catch(
          () => null
        );
        if (isMounted) setSetlistData(detail);
      })
      .catch((err) => {
        if (isMounted) setError(err?.message || "Couldn't load this gig.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [concertId, token]);

  const backLink = (
    <button type="button" className="sfm-link sfm-back" onClick={goBack}>
      &larr; Back
    </button>
  );

  if (!token) {
    return (
      <div className="sfm-page">
        {backLink}
        <p className="sfm-empty">Sign in to see your gigs.</p>
      </div>
    );
  }

  if (isLoading || !gig) {
    return (
      <div className="sfm-page">
        {backLink}
        <p className="sfm-empty">{error || "Loading gig..."}</p>
      </div>
    );
  }

  const isManual = gig.setlist_id?.startsWith("manual-");
  const isUpcoming = isFutureDate(gig.event_date);
  const sets = processSetlistSets(setlistData);
  const songCount = sets.reduce((acc, set) => acc + set.songs.filter((s) => !s.tape).length, 0);
  const setlistUrl = gig.setlist_url || setlistData?.url || null;
  const { day, month, year } = parseDateParts(gig.event_date);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActionMessage("");
    try {
      const updated = await refreshConcertSetlist({ token, concertId: gig.id });
      setGig(updated);
      setSetlistData(updated.raw_data);
      setActionMessage("Setlist refreshed from Setlist.fm.");
    } catch (err) {
      setActionMessage(`Couldn't refresh: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (id, includeSupportActs) => {
    setIsDeleting(true);
    try {
      await deleteAttendance({ token, concertId: id, includeSupportActs });
      setIsDeleteOpen(false);
      goBack();
    } catch (err) {
      setActionMessage(`Couldn't delete: ${err.message}`);
      setIsDeleting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(
      setlistAsText({
        artistName: gig.artist_name,
        venueName: gig.venue_name,
        eventDate: `${day} ${month} ${year}`,
        sets,
      })
    );
    setActionMessage("Setlist copied.");
  };

  return (
    <div className="sfm-page">
      {backLink}

      <header className="sfm-gig-header">
        <SetlistDateBadge date={gig.event_date} size="lg" />
        <div className="sfm-gig-heading">
          <h1>{gig.artist_name} Setlist</h1>
          <p>
            at {[gig.venue_name, gig.city, gig.country].filter(Boolean).join(", ")}
            {isUpcoming && <span className="sfm-tag">Upcoming</span>}
            {gig.is_support_act && <span className="sfm-tag is-muted">Support act</span>}
          </p>
          {gig.tour_name && <p>Tour: {gig.tour_name}</p>}
        </div>
      </header>

      <div className="sfm-gig-actions">
        {!isManual && (
          <button
            type="button"
            className="sfm-link"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh from Setlist.fm"}
          </button>
        )}
        {setlistUrl && (
          <a className="sfm-link" href={setlistUrl} target="_blank" rel="noopener noreferrer">
            View on Setlist.fm &#8599;
          </a>
        )}
        {songCount > 0 && (
          <button type="button" className="sfm-link" onClick={handleCopy}>
            Copy setlist
          </button>
        )}
        <button type="button" className="sfm-link is-danger" onClick={() => setIsDeleteOpen(true)}>
          Delete gig
        </button>
      </div>
      {actionMessage && (
        <p className="sfm-gig-meta" role="status">
          {actionMessage}
        </p>
      )}

      <div className="sfm-gig-columns">
        <section className="sfm-gig-section sfm-setlist">
          <h2>Setlist{songCount > 0 ? ` (${songCount} songs)` : ""}</h2>
          {songCount === 0 ? (
            <p className="sfm-gig-meta">
              {isUpcoming
                ? "No setlist yet. Check back after the show."
                : "No songs recorded for this gig on Setlist.fm yet."}
            </p>
          ) : (
            <SetlistSongs sets={sets} />
          )}
          {setlistData?.info && <p className="sfm-gig-meta">{setlistData.info}</p>}
        </section>

        <NotesEditor
          key={gig.id}
          gig={gig}
          token={token}
          onSaved={(notes) => setGig((prev) => ({ ...prev, notes }))}
        />
      </div>

      <SetlistAttribution />

      <DeleteGigConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        gig={gig}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
