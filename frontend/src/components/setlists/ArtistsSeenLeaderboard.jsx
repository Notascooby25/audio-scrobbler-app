import { useState } from "react";

export default function ArtistsSeenLeaderboard({ artists = [] }) {
  const [expandedArtist, setExpandedArtist] = useState(null);

  const handleToggle = (artistName) => {
    setExpandedArtist((prev) => (prev === artistName ? null : artistName));
  };

  if (artists.length === 0) {
    return <div className="card p-8 text-center text-muted">No artists seen recorded yet.</div>;
  }

  return (
    <div className="space-y-2">
      {artists.map((item, idx) => {
        const isExpanded = expandedArtist === item.artist_name;
        return (
          <div
            key={item.artist_name}
            className="card overflow-hidden"
            style={{ border: "0.5px solid var(--color-border)" }}
          >
            {/* Header Row */}
            <div
              className="p-3 flex justify-between items-center cursor-pointer transition-colors hover:bg-surface-hover"
              onClick={() => handleToggle(item.artist_name)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted font-bold w-6">{idx + 1}</span>
                <span className="font-semibold text-sm">{item.artist_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="badge font-bold px-2.5 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: "var(--color-surface-hover)",
                    border: "0.5px solid var(--color-border)",
                  }}
                >
                  {item.count} {item.count === 1 ? "gig" : "gigs"}
                </span>
                <span className="text-muted text-xs">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </div>

            {/* Accordion List of Gigs */}
            {isExpanded && item.gigs && item.gigs.length > 0 && (
              <div
                className="px-4 py-2 border-t text-xs space-y-2"
                style={{
                  backgroundColor: "var(--color-surface-hover)",
                  borderColor: "var(--color-border)",
                }}
              >
                {item.gigs.map((g, gIdx) => (
                  <div
                    key={g.id || gIdx}
                    className="flex justify-between items-center py-1 border-b border-border-subtle last:border-b-0"
                  >
                    <div>
                      <span className="font-medium text-ink">{g.venue}</span>
                      {g.city && <span className="text-muted">, {g.city}</span>}
                      {g.is_support && (
                        <span className="ml-2 text-primary font-medium">(Support)</span>
                      )}
                    </div>
                    <div className="text-muted text-right">
                      <span>{g.date}</span>
                      {g.song_count > 0 && (
                        <span className="ml-2">&bull; {g.song_count} songs</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
