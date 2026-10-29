import { useState, useEffect } from "react";
import { fetchSetlistDetail, updateConcertNotes } from "../../api/setlists";

export default function SetlistTracklistDrawer({
  setlistId,
  initialData = null,
  token,
  loggedConcertId = null,
  initialNotes = "",
  showNotesEditor = false,
  onNotesSaved = null,
  onCollapse = null,
}) {
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(!initialData?.sets && Boolean(setlistId));
  const [loadError, setLoadError] = useState("");

  // Notes state
  const [notes, setNotes] = useState(initialNotes || initialData?.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(initialNotes || initialData?.notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (initialNotes !== undefined) {
      setNotes(initialNotes);
      setNotesDraft(initialNotes);
    }
  }, [initialNotes]);

  useEffect(() => {
    if (!setlistId || (initialData && initialData.sets)) {
      if (initialData) setData(initialData);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError("");

    fetchSetlistDetail({ token, setlistId })
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        if (res.notes && !initialNotes) {
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
  }, [setlistId, token, initialData, initialNotes]);

  const artistName = data?.artist?.name || "Unknown Artist";
  const venueObj = data?.venue || {};
  const venueName = venueObj.name || "Unknown Venue";
  const eventDate = data?.eventDate || "";
  const setlistUrl = data?.url || data?.setlist_url || "";
  const infoNotes = data?.info || "";

  // Parse sets & songs with continuous song numbers
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
      className="mt-3 pt-3 border-t border-border space-y-4 animate-fadeIn"
      style={{ borderTop: "0.5px solid var(--color-border)" }}
    >
      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-4 text-center text-muted text-xs">
          Loading songs played from Setlist.fm...
        </div>
      )}

      {loadError && (
        <div className="notice notice-error text-xs p-2.5 rounded" role="alert">
          {loadError}
        </div>
      )}

      {/* Event Info / Notes from Setlist.fm */}
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
      {!isLoading && showNotesEditor && (
        <div
          className="p-3 rounded text-xs space-y-2"
          style={{
            backgroundColor: "var(--color-surface-hover)",
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
                className="text-xs text-primary hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0"
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
                placeholder="Record your memories (e.g. who you went with, support act highlights, favorite encore)..."
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                maxLength={2000}
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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-xs uppercase tracking-wide text-muted">
              Songs Played {totalSongs > 0 ? `(${totalSongs} tracks)` : ""}
            </h4>
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
              className="p-4 text-center text-muted text-xs rounded"
              style={{
                backgroundColor: "var(--color-surface-hover)",
                border: "0.5px solid var(--color-border)",
              }}
            >
              No setlist tracks recorded for this concert on Setlist.fm yet.
            </div>
          ) : (
            <div className="space-y-3">
              {processedSets.map((st, sIdx) => (
                <div key={sIdx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        st.isEncore
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-surface-hover text-ink border border-border"
                      }`}
                    >
                      {st.name}
                    </span>
                  </div>

                  <div
                    className="rounded divide-y divide-border overflow-hidden"
                    style={{ border: "0.5px solid var(--color-border)" }}
                  >
                    {st.songs.map((song, sgIdx) => (
                      <div
                        key={sgIdx}
                        className="p-2 flex items-start gap-2.5 bg-surface hover:bg-surface-hover transition-colors text-xs"
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
                            <span className="text-muted block text-[11px] mt-0.5">{song.info}</span>
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

      {/* Drawer Action Bar */}
      <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
        <div>
          {setlistUrl && (
            <a
              href={setlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]"
            >
              View on Setlist.fm <span>↗</span>
            </a>
          )}
        </div>
        {onCollapse && (
          <button
            type="button"
            className="text-muted hover:text-ink font-semibold cursor-pointer bg-transparent border-0 p-0 text-xs"
            onClick={onCollapse}
          >
            ▲ Collapse setlist
          </button>
        )}
      </div>
    </div>
  );
}
