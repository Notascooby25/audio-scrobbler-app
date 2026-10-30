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
