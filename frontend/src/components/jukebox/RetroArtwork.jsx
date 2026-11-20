import { useState } from "react";
import PropTypes from "prop-types";
import { thumbnailUrl } from "./retroCovers";

// Album artwork laid over a coloured stand-in. It asks for a small copy first, tries
// the full image if that fails, and if that fails too it removes itself so the
// stand-in underneath shows instead of a broken icon.
export default function RetroArtwork({ src, className }) {
  const [failure, setFailure] = useState({ src: null, thumbFailed: false, allFailed: false });
  if (!src) return null;

  const state = failure.src === src ? failure : { src, thumbFailed: false, allFailed: false };
  const small = thumbnailUrl(src);
  if (state.allFailed) return null;

  const showing = state.thumbFailed ? src : small;
  const handleError = () => {
    if (!state.thumbFailed && small !== src) {
      setFailure({ src, thumbFailed: true, allFailed: false });
    } else {
      setFailure({ src, thumbFailed: true, allFailed: true });
    }
  };

  return (
    <img
      className={className}
      src={showing}
      alt=""
      loading="lazy"
      decoding="async"
      onError={handleError}
    />
  );
}

RetroArtwork.propTypes = {
  src: PropTypes.string,
  className: PropTypes.string,
};
