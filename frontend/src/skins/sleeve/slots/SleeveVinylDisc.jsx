import React from "react";

/**
 * SleeveVinylDisc
 * 232px vinyl record drawn using clean SVG concentric rings.
 * Zero gradients and zero box-shadows in accordance with flat-design standards.
 */
export default function SleeveVinylDisc({ isPlaying = false, className = "" }) {
  return (
    <div
      className={`sleeve-vinyl-disc ${isPlaying ? "is-playing" : ""} ${className}`}
      aria-hidden="true"
    >
      <svg
        width="232"
        height="232"
        viewBox="0 0 232 232"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>
          {isPlaying && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 116 116"
              to="360 116 116"
              dur="20s"
              repeatCount="indefinite"
            />
          )}
          {/* Vinyl outer disc body */}
          <circle cx="116" cy="116" r="115" fill="#121212" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />

          {/* Concentric sound grooves */}
          <circle cx="116" cy="116" r="104" fill="none" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1" />
          <circle cx="116" cy="116" r="95" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
          <circle cx="116" cy="116" r="86" fill="none" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1" />
          <circle cx="116" cy="116" r="77" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
          <circle cx="116" cy="116" r="68" fill="none" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1" />
          <circle cx="116" cy="116" r="58" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
          <circle cx="116" cy="116" r="48" fill="none" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="1" />

          {/* Run-out groove */}
          <circle cx="116" cy="116" r="42" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />

          {/* Centre Label (colored in --sleeve fallback to primary) */}
          <circle cx="116" cy="116" r="36" fill="var(--sleeve, var(--color-primary, #6366f1))" />
          <circle cx="116" cy="116" r="32" fill="none" stroke="rgba(0, 0, 0, 0.2)" strokeWidth="1" />

          {/* Center spindle hole */}
          <circle cx="116" cy="116" r="5" fill="#000000" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
