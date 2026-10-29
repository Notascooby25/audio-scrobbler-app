/** Numbered setlist.fm-style song list; `sets` comes from processSetlistSets(). */
export default function SetlistSongs({ sets }) {
  return sets.map((set, setIdx) => (
    <div key={setIdx}>
      {set.name && <h3 className="sfm-set-name">{set.name}</h3>}
      <ol className="sfm-songs">
        {set.songs.map((song, songIdx) => (
          <li key={songIdx} className={song.tape ? "is-tape" : ""}>
            <span className="sfm-song-no">{song.number ? `${song.number}.` : ""}</span>
            <span>
              <span className="sfm-song-name">{song.name}</span>
              {song.tape && <span className="sfm-tag is-muted">Tape</span>}
              {(song.guest || song.coverArtist || song.info) && (
                <span className="sfm-song-note">
                  {[
                    song.guest && `with ${song.guest}`,
                    song.coverArtist && `${song.coverArtist} cover`,
                    song.info,
                  ]
                    .filter(Boolean)
                    .map((part) => `(${part})`)
                    .join(" ")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  ));
}
