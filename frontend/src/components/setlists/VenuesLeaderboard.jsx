export default function VenuesLeaderboard({ venues = [] }) {
  if (venues.length === 0) {
    return <div className="card p-8 text-center text-muted">No venues recorded yet.</div>;
  }

  return (
    <div className="space-y-2">
      {venues.map((v, idx) => (
        <div
          key={`${v.venue_name}-${v.city}`}
          className="card p-3 flex justify-between items-center"
          style={{ border: "0.5px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted font-bold w-6">{idx + 1}</span>
            <div>
              <div className="font-semibold text-sm">{v.venue_name}</div>
              <div className="text-xs text-muted">
                {v.city}
                {v.country ? `, ${v.country}` : ""}
              </div>
            </div>
          </div>
          <span
            className="badge font-bold px-2.5 py-0.5 rounded-full text-xs"
            style={{
              backgroundColor: "var(--color-surface-hover)",
              border: "0.5px solid var(--color-border)",
            }}
          >
            {v.count} {v.count === 1 ? "visit" : "visits"}
          </span>
        </div>
      ))}
    </div>
  );
}
