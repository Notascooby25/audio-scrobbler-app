export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

// The backend counts weekdays from Monday = 0.
export const WEEKDAY_NAMES = [
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
  "Sundays",
];

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-GB");
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

// "2026-09-09" -> "9 September" (or "9 September 2026" with the year).
export function formatDay(iso, { withYear = false } = {}) {
  if (!iso) return "";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const text = `${day} ${MONTH_NAMES[month - 1]}`;
  return withYear ? `${text} ${year}` : text;
}

// "2026-01-17" -> "17 Jan"
export function formatShortDay(iso) {
  if (!iso) return "";
  const [, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTH_SHORT[month - 1]}`;
}

export function formatHour(hour) {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

const BRITAIN_MILES = 874; // Land's End to John o' Groats
const LONDON_PARIS_MILES = 213;

export function distanceComparison(miles) {
  if (miles >= BRITAIN_MILES) {
    return `That's about ${(miles / BRITAIN_MILES).toFixed(1)} times the length of Britain.`;
  }
  if (miles >= LONDON_PARIS_MILES) {
    return `That's about ${(miles / LONDON_PARIS_MILES).toFixed(1)} trips from London to Paris.`;
  }
  return "";
}
