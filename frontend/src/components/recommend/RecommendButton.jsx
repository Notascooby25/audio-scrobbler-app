import React, { useState } from "react";
import RecommendModal from "./RecommendModal";

export default function RecommendButton({ token, item, inGrid = false }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!token) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={inGrid ? "recommend-btn-grid" : "recommend-btn-list"}
        title={`Recommend ${item?.title || "music"} to a friend`}
        aria-label={`Recommend ${item?.title || "music"} to a friend`}
        style={
          inGrid
            ? {
                background: "rgba(0, 0, 0, 0.65)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                color: "#ffffff",
              }
            : {
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "inline-flex",
                alignItems: "center",
                color: "var(--color-meta, #888)",
              }
        }
      >
        <svg
          width={inGrid ? "14" : "16"}
          height={inGrid ? "14" : "16"}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {isOpen && (
        <RecommendModal
          token={token}
          item={item}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
