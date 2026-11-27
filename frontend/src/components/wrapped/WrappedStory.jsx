import { useEffect, useMemo, useRef, useState } from "react";
import "./wrapped.css";
import { buildSlides } from "./buildSlides";
import { changedSlideIds } from "./changedSlides";
import ShareSlideButton from "./ShareSlideButton";

// The full-screen story. Tap the right side (or press the right arrow) to go on, the left side to go back.
// Slides never move on by themselves, so there is nothing to pause.
export default function WrappedStory({ snapshot, onClose }) {
  const slides = useMemo(() => buildSlides(snapshot), [snapshot]);
  const updated = useMemo(() => changedSlideIds(snapshot.changed), [snapshot.changed]);
  const [index, setIndex] = useState(0);
  const rootRef = useRef(null);
  const last = slides.length - 1;
  const slide = slides[index];

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "ArrowRight") setIndex((value) => Math.min(value + 1, last));
      else if (event.key === "ArrowLeft") setIndex((value) => Math.max(value - 1, 0));
      else if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onClose]);

  return (
    <div
      ref={rootRef}
      className="wrapped-story"
      role="dialog"
      aria-modal="true"
      aria-label={`Your ${snapshot.year} Wrapped`}
      tabIndex={-1}
    >
      <div className={`wrapped-frame wrapped-tone-${slide.tone}`}>
        <div
          className="wrapped-progress"
          role="progressbar"
          aria-label="Slide position"
          aria-valuemin={1}
          aria-valuemax={slides.length}
          aria-valuenow={index + 1}
        >
          {slides.map((item, position) => (
            <span key={item.id} data-done={position <= index ? "true" : "false"} />
          ))}
        </div>
        <button type="button" className="wrapped-close" onClick={onClose}>
          Close
        </button>
        <div className="wrapped-slide" key={slide.id}>
          {updated.has(slide.id) && <p className="wrapped-updated">Updated with the full year</p>}
          {slide.node}
        </div>
        <button
          type="button"
          className="wrapped-tap wrapped-tap-prev"
          aria-label="Previous slide"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(value - 1, 0))}
        />
        <button
          type="button"
          className="wrapped-tap wrapped-tap-next"
          aria-label="Next slide"
          disabled={index === last}
          onClick={() => setIndex((value) => Math.min(value + 1, last))}
        />
        <div className="wrapped-actions">
          <ShareSlideButton
            slide={slide.node}
            tone={slide.tone}
            filename={`wrapped-${snapshot.year}-${slide.id}.png`}
          />
        </div>
      </div>
    </div>
  );
}
