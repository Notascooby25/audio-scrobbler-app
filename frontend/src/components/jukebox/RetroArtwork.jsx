import { useState } from "react";
import PropTypes from "prop-types";

// Album artwork laid over a coloured stand-in. If the image fails to load it
// removes itself, so the stand-in underneath shows instead of a broken icon.
export default function RetroArtwork({ src, className }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) return null;

  return (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}

RetroArtwork.propTypes = {
  src: PropTypes.string,
  className: PropTypes.string,
};
