// Flat decorative shapes in the person's accent colour. No gradients and no shadows. Each slide gets one
// variant in one corner so the story doesn't feel like the same page repeated.
export const SHAPE_VARIANTS = ["rings", "stripes", "dots", "arc"];
// Never top-left: that's where the section label sits.
export const SHAPE_CORNERS = ["tr", "bl", "tr", "br"];

function Variant({ variant }) {
  switch (variant) {
    case "rings":
      return (
        <>
          <circle cx="60" cy="40" r="52" />
          <circle cx="60" cy="40" r="38" />
          <circle cx="60" cy="40" r="24" />
        </>
      );
    case "stripes":
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={-20 + i * 24}
              y="-10"
              width="12"
              height="140"
              transform="rotate(30 50 50)"
              className="fill"
            />
          ))}
        </>
      );
    case "dots":
      return (
        <>
          {[0, 1, 2, 3].flatMap((row) =>
            [0, 1, 2, 3].map((col) => (
              <circle
                key={`${row}-${col}`}
                cx={14 + col * 24}
                cy={14 + row * 24}
                r="8"
                className="fill"
              />
            ))
          )}
        </>
      );
    default:
      return (
        <>
          <path d="M0 100 A100 100 0 0 1 100 0" strokeWidth="16" />
          <path d="M0 70 A70 70 0 0 1 70 0" strokeWidth="8" />
        </>
      );
  }
}

export default function Shapes({ variant = "rings", corner = "tr" }) {
  return (
    <svg
      className={`wrapped-shapes wrapped-shapes-${variant} wrapped-corner-${corner}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <Variant variant={variant} />
    </svg>
  );
}
