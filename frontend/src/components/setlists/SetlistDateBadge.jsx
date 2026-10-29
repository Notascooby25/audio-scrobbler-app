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

export default function SetlistDateBadge({ date, className = "", size = "md" }) {
  const { day, month, year } = parseDateParts(date);
  const isSm = size === "sm";

  return (
    <div
      className={`flex flex-col items-center justify-center rounded text-center shrink-0 select-none ${
        isSm ? "w-11 py-1 px-1" : "w-14 py-1.5 px-1.5"
      } ${className}`}
      style={{
        backgroundColor: "var(--color-surface-hover)",
        border: "0.5px solid var(--color-border)",
      }}
      aria-label={`${day} ${month} ${year}`}
    >
      <span
        className={`${isSm ? "text-[9px]" : "text-[10px]"} font-bold text-muted uppercase tracking-wider leading-none`}
      >
        {month}
      </span>
      <span
        className={`${isSm ? "text-base font-extrabold" : "text-lg font-black"} text-ink leading-tight my-0.5`}
      >
        {day}
      </span>
      <span
        className={`${isSm ? "text-[9px]" : "text-[10px]"} font-medium text-muted leading-none`}
      >
        {year}
      </span>
    </div>
  );
}
