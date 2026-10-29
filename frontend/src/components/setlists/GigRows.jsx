import SetlistDateBadge from "./SetlistDateBadge";

/**
 * Setlist.fm-style gig rows: stacked date | hairline | title link + grey meta line.
 *
 * rows: [{ key, date, title, meta?, tag?, tagMuted?, onOpen? }]
 */
export default function GigRows({ rows = [] }) {
  return (
    <div className="sfm-gig-list">
      {rows.map((row) => (
        <div key={row.key} className="sfm-gig">
          <SetlistDateBadge date={row.date} />
          <div className="sfm-gig-body">
            <div className="sfm-gig-title">
              {row.onOpen ? (
                <button type="button" className="sfm-link" onClick={row.onOpen}>
                  {row.title}
                </button>
              ) : (
                row.title
              )}
              {row.tag && (
                <span className={`sfm-tag ${row.tagMuted ? "is-muted" : ""}`}>{row.tag}</span>
              )}
            </div>
            {row.meta && <div className="sfm-gig-meta">{row.meta}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
