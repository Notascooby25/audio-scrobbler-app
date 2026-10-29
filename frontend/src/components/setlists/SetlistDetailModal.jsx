import { useState, useEffect } from "react";
import SetlistDateBadge, { isFutureDate } from "./SetlistDateBadge";
import { fetchSetlistDetail, updateConcertNotes } from "../../api/setlists";

export default function SetlistDetailModal({
  setlistId,
  initialData = null,
  token,
  onClose,
  onLogAttendance = null,
  isLogging = false,
  onNotesSaved = null,
}) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(!initialData || !initialData.sets);
  const [loadError, setLoadError] = useState("");

  // Notes state
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(initialData?.notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!setlistId || (initialData && initialData.sets)) {
      if (initialData?.notes) {
        setNotes(initialData.notes);
        setNotesDraft(initialData.notes);
      }
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError("");

    fetchSetlistDetail({ token, setlistId })
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        if (res.notes) {
          setNotes(res.notes);
          setNotesDraft(res.notes);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err?.message || "Failed to load setlist details.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [setlistId, token, initialData]);

  const artistName = data?.artist?.name || "Unknown Artist";
  const venueObj = data?.venue || {};
  const venueName = venueObj.name || "Unknown Venue";
  const city = venueObj.city?.name || "";
  const country = venueObj.city?.country?.name || venueObj.city?.country?.code || "";
  const tourName = data?.tour?.name || "";
  const eventDate = data?.eventDate || "";
  const setlistUrl = data?.url || data?.setlist_url || "";
  const infoNotes = data?.info || "";
  const alreadyLogged = data?.already_logged ?? Boolean(data?.logged_concert_id || data?.id);
  const loggedConcertId =
    data?.logged_concert_id || (alreadyLogged && typeof data?.id === "number" ? data.id : null);
  const isFuture = isFutureDate(eventDate);

  // Parse sets & songs into structured sets with continuous song numbering
  const rawSets = data?.sets?.set || [];
  const setsList = Array.isArray(rawSets) ? rawSets : rawSets ? [rawSets] : [];

  let globalSongNumber = 1;
  const processedSets = setsList.map((st, idx) => {
    const rawSongs = st.song || [];
    const songsArray = Array.isArray(rawSongs) ? rawSongs : rawSongs ? [rawSongs] : [];
    const songs = songsArray.map((sg) => {
      const isTape = Boolean(sg.tape);
      const num = isTape ? null : globalSongNumber++;
      return {
        ...sg,
        displayNum: num,
        name: sg.name || "Untitled Song",
        guest: sg.with?.name || null,
        coverArtist: sg.cover?.name || null,
        info: sg.info || null,
      };
    });

    const isEncore = Boolean(st.encore);
    const encoreLabel = isEncore
      ? typeof st.encore === "number" && st.encore > 1
        ? `Encore ${st.encore}:`
        : "Encore:"
      : null;
    const setName = st.name || encoreLabel || (setsList.length > 1 ? `Set ${idx + 1}` : "Setlist");

    return {
      name: setName,
      isEncore,
      songs,
    };
  });

  const totalSongs = processedSets.reduce(
    (acc, s) => acc + s.songs.filter((sg) => !sg.tape).length,
    0
  );

  const handleSaveNotes = async () => {
    if (!loggedConcertId) {
      setNotes(notesDraft);
      setIsEditingNotes(false);
      return;
    }
    setIsSavingNotes(true);
    setNotesMessage("");
    try {
      await updateConcertNotes({
        token,
        concertId: loggedConcertId,
        notes: notesDraft.trim() || null,
      });
      setNotes(notesDraft.trim());
      setIsEditingNotes(false);
      setNotesMessage("Note saved!");
      setTimeout(() => setNotesMessage(""), 3000);
      if (onNotesSaved) {
        onNotesSaved(loggedConcertId, notesDraft.trim());
      }
    } catch (err) {
      setNotesMessage(`Failed to save: ${err.message}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCopySetlist = () => {
    const lines = [`${artistName} at ${venueName} (${eventDate})`, ""];
    processedSets.forEach((st) => {
      lines.push(`-- ${st.name} --`);
      st.songs.forEach((sg) => {
        let line = sg.displayNum ? `${sg.displayNum}. ${sg.name}` : `[Tape] ${sg.name}`;
        if (sg.guest) line += ` (with ${sg.guest})`;
        if (sg.coverArtist) line += ` (${sg.coverArtist} cover)`;
        if (sg.info) line += ` (${sg.info})`;
        lines.push(line);
      });
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n").trim());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/70"
      style={{ backdropFilter: "blur(3px)" }}
    >
      <div
        className="card w-full max-w-2xl p-5 md:p-6 space-y-5 max-h-[92vh] overflow-y-auto"
        style={{
          border: "0.5px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <SetlistDateBadge date={eventDate} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg md:text-xl font-bold truncate text-ink">{artistName}</h2>
                {isFuture && (
                  <span className="badge font-bold px-2 py-0.5 rounded text-[11px] bg-primary/10 text-primary border border-primary/20">
                    Upcoming Gig
                  </span>
                )}
                {alreadyLogged && (
                  <span className="badge font-bold px-2 py-0.5 rounded text-[11px] bg-success/10 text-success border border-success/20">
                    ✓ In Your Gigs
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-muted mt-0.5">
                at <strong className="text-ink font-semibold">{venueName}</strong>
                {city ? `, ${city}` : ""}
                {country ? `, ${country}` : ""}
              </p>
              {tourName && (
                <p className="text-xs text-muted mt-0.5">
                  Tour: <span className="text-ink font-medium">{tourName}</span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="text-muted hover:text-ink text-2xl font-bold leading-none p-1 cursor-pointer bg-transparent border-0 shrink-0"
            onClick={onClose}
            aria-label="Close setlist modal"
          >
            &times;
          </button>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="py-12 text-center text-muted text-sm">
            Loading songs played from Setlist.fm...
          </div>
        )}

        {loadError && (
          <div className="notice notice-error text-xs p-3 rounded" role="alert">
            {loadError}
          </div>
        )}

        {/* Event Notes / Info Card */}
        {!isLoading && infoNotes && (
          <div
            className="p-3 rounded text-xs text-muted space-y-1"
            style={{
              backgroundColor: "var(--color-surface-hover)",
              border: "0.5px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-1.5 font-bold text-ink">
              <span>ℹ️</span> Event Info
            </div>
            <p className="whitespace-pre-line leading-relaxed">{infoNotes}</p>
          </div>
        )}

        {/* Personal Gig Notes (Diary / Memories) */}
        {!isLoading && alreadyLogged && (
          <div
            className="p-3.5 rounded text-xs space-y-2"
            style={{
              backgroundColor: "var(--color-canvas, var(--color-surface-hover))",
              border: "0.5px solid var(--color-border)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <span>📝</span> My Gig Notes & Memories
              </span>
              {!isEditingNotes && (
                <button
                  type="button"
                  className="text-xs text-primary underline cursor-pointer bg-transparent border-0 p-0"
                  onClick={() => {
                    setNotesDraft(notes);
                    setIsEditingNotes(true);
                  }}
                >
                  {notes ? "Edit Note" : "+ Add Note"}
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2 mt-2">
                <textarea
                  className="input-field w-full text-xs p-2.5 min-h-[75px] rounded resize-y"
                  placeholder="Record your memories (e.g. who you went with, standing spot, favorite encore song)..."
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  disabled={isSavingNotes}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">{notesDraft.length}/2000 chars</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary text-xs px-2.5 py-1"
                      onClick={() => setIsEditingNotes(false)}
                      disabled={isSavingNotes}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary text-xs px-3 py-1 font-semibold"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                    >
                      {isSavingNotes ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </div>
              </div>
            ) : notes ? (
              <p className="text-xs text-ink/90 whitespace-pre-line leading-relaxed italic bg-surface p-2.5 rounded border border-border">
                &ldquo;{notes}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-muted italic">
                No personal notes added yet. Tap &ldquo;+ Add Note&rdquo; to save concert memories.
              </p>
            )}

            {notesMessage && (
              <span className="text-[11px] font-semibold text-primary block mt-1">
                {notesMessage}
              </span>
            )}
          </div>
        )}

        {/* Setlist Song Tracks */}
        {!isLoading && !loadError && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-1">
              <h3 className="font-bold text-sm uppercase tracking-wide text-muted">
                Setlist {totalSongs > 0 ? `(${totalSongs} songs)` : ""}
              </h3>
              {totalSongs > 0 && (
                <button
                  type="button"
                  className="text-xs text-muted hover:text-ink underline cursor-pointer bg-transparent border-0 p-0 flex items-center gap-1"
                  onClick={handleCopySetlist}
                >
                  <span>📋</span> {isCopied ? "Copied!" : "Copy Setlist"}
                </button>
              )}
            </div>

            {totalSongs === 0 ? (
              <div
                className="p-6 text-center text-muted text-xs rounded"
                style={{
                  backgroundColor: "var(--color-surface-hover)",
                  border: "0.5px solid var(--color-border)",
                }}
              >
                {isFuture
                  ? "This concert is in the future. Songs will be added on Setlist.fm once the show takes place!"
                  : "No setlist tracks have been recorded for this concert on Setlist.fm yet."}
              </div>
            ) : (
              <div className="space-y-4">
                {processedSets.map((st, sIdx) => (
                  <div key={sIdx} className="space-y-1.5">
                    {/* Set Name Header */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          st.isEncore
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-surface-hover text-ink border border-border"
                        }`}
                      >
                        {st.name}
                      </span>
                    </div>

                    {/* Song Rows */}
                    <div
                      className="rounded divide-y divide-border overflow-hidden"
                      style={{ border: "0.5px solid var(--color-border)" }}
                    >
                      {st.songs.map((song, sgIdx) => (
                        <div
                          key={sgIdx}
                          className="p-2.5 flex items-start gap-3 bg-surface hover:bg-surface-hover transition-colors text-xs"
                        >
                          <span className="w-5 text-right font-mono font-bold text-muted shrink-0 text-[11px] pt-0.5">
                            {song.displayNum ? `${song.displayNum}.` : "•"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-ink">{song.name}</span>
                            {song.tape && (
                              <span className="text-[10px] text-muted bg-surface-hover border border-border px-1.5 py-0.5 rounded font-bold uppercase ml-1.5">
                                Tape
                              </span>
                            )}
                            {song.guest && (
                              <span className="text-muted ml-1.5">
                                (with <span className="text-ink font-medium">{song.guest}</span>)
                              </span>
                            )}
                            {song.coverArtist && (
                              <span className="text-muted ml-1.5 italic">
                                ({song.coverArtist} cover)
                              </span>
                            )}
                            {song.info && (
                              <span className="text-muted block text-[11px] mt-0.5">
                                {song.info}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Action Bar */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            {setlistUrl && (
              <a
                href={setlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-medium"
              >
                View on Setlist.fm <span>↗</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!alreadyLogged && onLogAttendance && data && (
              <button
                type="button"
                className="btn px-4 py-1.5 font-bold text-xs"
                style={{
                  backgroundColor: isFuture ? "var(--color-primary, #0066FF)" : "#16a34a",
                  color: "#ffffff",
                }}
                onClick={() => onLogAttendance(data)}
                disabled={isLogging}
              >
                {isLogging ? "Saving..." : isFuture ? "+ I'M GOING" : "✓ I WAS THERE"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary px-3 py-1.5 text-xs font-semibold"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
