import { useId, useState } from "react";

const KEY_ITEMS = [
  {
    label: "Newly announced",
    className: "sfm-badge sfm-badge-new",
    meaning: "First listed in the last 7 days.",
  },
  {
    label: "Your artist",
    className: "sfm-badge sfm-badge-artist",
    meaning: "An artist you listen to. Artist criteria decides which ones count.",
  },
  {
    label: "Check line-up",
    className: "sfm-badge sfm-badge-possible",
    meaning:
      "One of your artists is named in the event title, but not in the listed line-up. It might not be them, so check before you plan around it.",
  },
  {
    label: "Seen live",
    className: "sfm-badge",
    meaning: "You have logged this artist at a gig before.",
  },
  {
    label: "✓ Going",
    className: "sfm-badge sfm-badge-going",
    meaning: "You have already logged this gig.",
  },
];

/** A short key to the badges on a Discover card, folded away until asked for. */
export default function DiscoverKey() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="sfm-discover-key">
      <button
        type="button"
        className="sfm-discover-key-toggle sfm-btn-mixed"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        What do the labels mean?
      </button>
      {open && (
        <dl id={panelId} className="sfm-discover-key-list">
          {KEY_ITEMS.map((item) => (
            <div key={item.label} className="sfm-discover-key-row">
              <dt>
                <span className={item.className}>{item.label}</span>
              </dt>
              <dd>{item.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
