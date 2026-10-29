const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export function parseDateParts(rawDate) {
  if (!rawDate) return { day: "--", month: "---", year: "----" };

  // 1. "dd-MM-yyyy" (Standard Setlist.fm date format)
  if (typeof rawDate === "string" && /^\d{1,2}-\d{1,2}-\d{4}$/.test(rawDate.trim())) {
    const [d, m, y] = rawDate.trim().split("-");
    const mIdx = parseInt(m, 10) - 1;
    return {
      day: d.padStart(2, "0"),
      month: MONTH_NAMES[mIdx] || "---",
      year: y,
    };
  }

  // 2. Date object or standard parseable ISO string
  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    return {
      day: String(parsed.getDate()).padStart(2, "0"),
      month: MONTH_NAMES[parsed.getMonth()] || "---",
      year: String(parsed.getFullYear()),
    };
  }

  return { day: "--", month: "---", year: "----" };
}

export function isFutureDate(rawDate) {
  if (!rawDate) return false;
  let parsed = null;
  if (typeof rawDate === "string" && /^\d{1,2}-\d{1,2}-\d{4}$/.test(rawDate.trim())) {
    const [d, m, y] = rawDate.trim().split("-");
    parsed = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 23, 59, 59);
  } else {
    parsed = new Date(rawDate);
  }
  if (!parsed || isNaN(parsed.getTime())) return false;
  return parsed.getTime() > Date.now();
}

export default function SetlistDateBadge({ date, className = "", size = "sm" }) {
  const { day, month, year } = parseDateParts(date);
  const sizeClass = size === "lg" ? "sfm-date-block" : "sfm-date";

  return (
    <div className={`${sizeClass} ${className}`.trim()} aria-label={`${day} ${month} ${year}`}>
      <span className="sfm-date-month">{month}</span>
      <span className="sfm-date-day">{day}</span>
      <span className="sfm-date-year">{year}</span>
    </div>
  );
}
