import { useState } from "react";

// A cover or artist picture. If there's no picture, or it fails to load, the coloured tile with the
// first letter shows instead, so a slide never has a blank hole.
export default function Cover({ src, name, className = "" }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`wrapped-cover ${className}`} aria-hidden="true">
      <span className="wrapped-cover-initial">{initial}</span>
      {src && !failed && (
        <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
