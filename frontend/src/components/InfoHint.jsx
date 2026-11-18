import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { REPORT_HINTS } from "../reportHints";

const OPEN_EVENT = "info-hint-open";
const EDGE_GAP = 8;

export default function InfoHint({ hintId, label = "this chart" }) {
  const text = REPORT_HINTS[hintId];
  const noteId = useId();
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const noteRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);

  // Opening one hint closes any other that is open.
  useEffect(() => {
    function onOtherOpened(event) {
      if (event.detail !== noteId) setOpen(false);
    }
    document.addEventListener(OPEN_EVENT, onOtherOpened);
    return () => document.removeEventListener(OPEN_EVENT, onOtherOpened);
  }, [noteId]);

  // While open: close on outside press or Escape.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Keep the note inside the viewport so it never causes sideways scrolling.
  useLayoutEffect(() => {
    if (!open || !noteRef.current) {
      setShift(0);
      return;
    }
    const rect = noteRef.current.getBoundingClientRect();
    const overflowRight = rect.right - (window.innerWidth - EDGE_GAP);
    const overflowLeft = EDGE_GAP - rect.left;
    if (overflowRight > 0) setShift(-overflowRight);
    else if (overflowLeft > 0) setShift(overflowLeft);
    else setShift(0);
  }, [open]);

  if (!text) return null;

  function toggle(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!open) document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: noteId }));
    setOpen(!open);
  }

  return (
    <span className="info-hint" ref={wrapperRef}>
      <button
        type="button"
        ref={buttonRef}
        className="info-hint-btn"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        onClick={toggle}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <circle cx="12" cy="7.5" r="0.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span
          id={noteId}
          ref={noteRef}
          role="note"
          className="info-hint-note"
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        >
          {text}
        </span>
      )}
    </span>
  );
}
