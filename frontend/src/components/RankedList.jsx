import Artwork from "./Artwork";
import LikedHeart from "./LikedHeart";

export default function RankedList({
  title,
  entries = [],
  emptyMessage = "No listening data yet.",
  kind,
  interactive = false,
  onToggleLike,
  likingKeys = new Set(),
}) {
  const showHeart = kind === "tracks" || kind === "albums";

  return (
    <section className="ranked-panel">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="panel-meta">{entries.length} shown</span>
      </div>
      {entries.length === 0 ? (
        <p className="notice">{emptyMessage}</p>
      ) : (
        <ol className="ranked-list">
          {entries.map((entry, index) => {
            const itemKey = `${kind}:${entry.label}:${entry.secondary || ""}`;
            return (
              <li key={`${entry.label}-${entry.secondary || ""}`}>
                <span className="rank-number">{index + 1}</span>
                <Artwork className="rank-artwork" src={entry.artwork_url} label={entry.label} />
                <span className="rank-copy">
                  <strong>{entry.label}</strong>
                  {entry.secondary && <small>{entry.secondary}</small>}
                </span>
                {showHeart && (
                  <LikedHeart
                    liked={entry.is_liked}
                    interactive={interactive}
                    label={entry.label}
                    busy={likingKeys.has(itemKey)}
                    onToggle={onToggleLike ? () => onToggleLike(entry, kind) : undefined}
                  />
                )}
                <span className="rank-count">{entry.play_count.toLocaleString()}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
