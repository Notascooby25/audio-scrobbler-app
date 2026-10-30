import { useState } from "react";
import GigRows from "./GigRows";
import { festivalEditionKey, festivalEditionLabel } from "./festivalNames";

/** Every festival you've been to, one row per edition. Opening a row lists the acts you saw there. */
export default function FestivalEditions({ gigs = [], onOpenGig = null }) {
  const [openKey, setOpenKey] = useState(null);

  const editions = new Map();
  gigs.forEach((gig) => {
    const key = festivalEditionKey(gig.festival_name, gig.event_date);
    if (!editions.has(key)) editions.set(key, { key, names: new Map(), gigs: [] });
    const edition = editions.get(key);
    edition.gigs.push(gig);
    edition.names.set(gig.festival_name, (edition.names.get(gig.festival_name) || 0) + 1);
  });

  const list = [...editions.values()]
    .map((edition) => {
      const [name] = [...edition.names.entries()].sort((a, b) => b[1] - a[1])[0];
      const newest = edition.gigs[0].event_date || "";
      return {
        ...edition,
        label: festivalEditionLabel(name, newest),
        newest,
        gigs: edition.gigs.sort((a, b) => (b.event_date || "").localeCompare(a.event_date || "")),
      };
    })
    .sort((a, b) => b.newest.localeCompare(a.newest));

  return (
    <ul className="festival-editions">
      {list.map((edition) => {
        const isOpen = openKey === edition.key;
        return (
          <li key={edition.key}>
            <button
              type="button"
              className="sfm-link"
              aria-expanded={isOpen}
              onClick={() => setOpenKey(isOpen ? null : edition.key)}
            >
              {edition.label} · {edition.gigs.length} {edition.gigs.length === 1 ? "act" : "acts"}
            </button>
            {isOpen && (
              <GigRows
                rows={edition.gigs.map((gig) => ({
                  key: gig.id,
                  date: gig.event_date || gig.date,
                  title: gig.artist_name,
                  meta: [gig.venueName, gig.venueSub].filter(Boolean).join(" · "),
                  onOpen: onOpenGig ? () => onOpenGig(gig.id) : null,
                }))}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
