/**
 * Festival names are shown without their year, and grouped without it, so "V Festival – 2009"
 * and "V Festival" are the same festival. The gig's date still shows the year.
 */
const YEAR = /\b(19|20)\d{2}\b/g;

export function festivalLabel(name) {
  return name
    .replace(YEAR, " ")
    .replace(/\s[-–—]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function festivalGroupKey(name) {
  return festivalLabel(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** One edition of a festival: "V Festival 2009". Each year is its own edition. */
export function festivalEditionKey(name, eventDate) {
  return `${festivalGroupKey(name)}|${(eventDate || "").slice(0, 4)}`;
}

export function festivalEditionLabel(name, eventDate) {
  const year = (eventDate || "").slice(0, 4);
  return year ? `${festivalLabel(name)} ${year}` : festivalLabel(name);
}

/** The festival name for a venue whose gigs are all festivals, or null if any gig isn't one. */
export function venueFestivalName(gigs) {
  if (!gigs.length || !gigs.every((gig) => gig.is_festival && gig.festival_name)) return null;
  const counts = new Map();
  gigs.forEach((gig) => {
    const label = festivalLabel(gig.festival_name);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
