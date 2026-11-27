import Cover from "./Cover";
import { formatNumber } from "./format";

// How big a headline can be and still fit on one slide: longer text gets a smaller size class.
export function sizeClass(text, { m = 7, s = 10 } = {}) {
  const length = String(text ?? "").length;
  if (length > s) return "wrapped-size-s";
  if (length > m) return "wrapped-size-m";
  return "";
}

// The slide's heading, set in a solid box so it carries the slide without a label above it.
export function Chip({ children }) {
  return <h2 className="wrapped-chip">{children}</h2>;
}

export function Big({ children, className = "" }) {
  return <p className={`wrapped-big ${sizeClass(children)} ${className}`}>{children}</p>;
}

// A ranked row with a cover. The full name always shows, wrapping onto a second line when it needs to.
export function CoverList({ items, detail, sub }) {
  return (
    <ol className="wrapped-rows">
      {items.map((item, index) => (
        <li key={`${item.name}-${item.artist || ""}-${index}`}>
          <span className="wrapped-rank">{index + 1}</span>
          <Cover src={item.artwork_url} name={item.name} />
          <span className="wrapped-row-text">
            <span className="wrapped-row-name">{item.name}</span>
            {sub && sub(item) ? <span className="wrapped-row-sub">{sub(item)}</span> : null}
          </span>
          <span className="wrapped-row-detail">{detail(item)}</span>
        </li>
      ))}
    </ol>
  );
}

export function playsDetail(item) {
  return `${formatNumber(item.plays)} plays`;
}
