export default function SongsHeardLeaderboard({ songs = [] }) {
  if (songs.length === 0) {
    return <div className="card p-8 text-center text-muted">No songs heard live recorded yet.</div>;
  }

  return (
    <div className="space-y-2">
      {songs.map((song, idx) => (
        <div
          key={`${song.track_name}-${song.artist_name}`}
          className="card p-3 flex justify-between items-center"
          style={{ border: "0.5px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted font-bold w-6">{idx + 1}</span>
            <div>
              <div className="font-semibold text-sm">{song.track_name}</div>
              <div className="text-xs text-muted">{song.artist_name}</div>
            </div>
          </div>
          <span
            className="badge font-bold px-2.5 py-0.5 rounded-full text-xs"
            style={{
              backgroundColor: "var(--color-surface-hover)",
              border: "0.5px solid var(--color-border)",
            }}
          >
            {song.count} {song.count === 1 ? "time" : "times"}
          </span>
        </div>
      ))}
    </div>
  );
}
