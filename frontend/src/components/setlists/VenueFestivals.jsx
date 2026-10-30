import { useState } from "react";
import GigRows from "./GigRows";
import { festivalGroupKey, festivalLabel } from "./festivalNames";

/** The festival gigs at one venue, grouped by festival. Opening a festival lists its gigs. */
export default function VenueFestivals({ gigs = [], onOpenGig = null }) {
  const [openKey, setOpenKey] = useState(null);

  const groups = new Map();
  gigs
    .filter((gig) => gig.is_festival && gig.festival_name)
    .forEach((gig) => {
      const key = festivalGroupKey(gig.festival_name);
      if (!groups.has(key)) groups.set(key, { key, label: null, names: new Map(), gigs: [] });
      const group = groups.get(key);
      group.gigs.push(gig);
      group.names.set(gig.festival_name, (group.names.get(gig.festival_name) || 0) + 1);
    });

  if (groups.size === 0) return null;

  const list = [...groups.values()]
    .map((group) => {
      const [mostUsed] = [...group.names.entries()].sort((a, b) => b[1] - a[1])[0];
      return { ...group, label: festivalLabel(mostUsed) };
    })
    .sort((a, b) => b.gigs.length - a.gigs.length || a.label.localeCompare(b.label));

  return (
    <div className="venue-festivals">
      <h4>Festivals</h4>
      <ul>
        {list.map((group) => {
          const isOpen = openKey === group.key;
          return (
            <li key={group.key}>
              <button
                type="button"
                className="sfm-link"
                aria-expanded={isOpen}
                onClick={() => setOpenKey(isOpen ? null : group.key)}
              >
                {group.label} · {group.gigs.length} {group.gigs.length === 1 ? "gig" : "gigs"}
              </button>
              {isOpen && (
                <GigRows
                  rows={group.gigs.map((gig) => ({
                    key: gig.id,
                    date: gig.event_date || gig.date,
                    title: gig.artist_name,
                    meta: gig.date,
                    onOpen: onOpenGig ? () => onOpenGig(gig.id) : null,
                  }))}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
