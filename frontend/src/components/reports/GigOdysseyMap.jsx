import { useState } from "react";
import { Link } from "react-router-dom";
import { UK_MAP_PATH, projectUkCoords } from "./ukMapData";

// UK and Ireland default geographic framing
const UK_BOUNDS = {
  minLat: 49.8,
  maxLat: 59.5,
  minLng: -8.5,
  maxLng: 2.2,
};

function isPinAbroad(pin) {
  if (!pin.lat || !pin.lng) return false;
  // If explicitly not UK / Ireland or outside UK bounding box
  const isOutsideBox =
    pin.lat < UK_BOUNDS.minLat - 1.0 ||
    pin.lat > UK_BOUNDS.maxLat + 1.0 ||
    pin.lng < UK_BOUNDS.minLng - 1.0 ||
    pin.lng > UK_BOUNDS.maxLng + 1.0;
  const isForeignCountry =
    pin.country &&
    ![
      "United Kingdom",
      "UK",
      "Great Britain",
      "Ireland",
      "Northern Ireland",
      "Scotland",
      "Wales",
      "England",
    ].includes(pin.country);
  return isOutsideBox || isForeignCountry;
}

export default function GigOdysseyMap({
  homeSet = false,
  homeCity = "",
  homeCoords = null,
  pins = [],
}) {
  const [selectedPin, setSelectedPin] = useState(null);
  const [viewMode, setViewMode] = useState("uk"); // "uk" or "world"

  if (!homeSet) {
    return (
      <div className="chart-panel gig-odyssey-panel" data-testid="gig-odyssey-map">
        <div className="panel-header">
          <h2>Gig Odyssey Map</h2>
        </div>
        <p className="notice" style={{ marginTop: "12px" }}>
          Set your home city in <Link to="/settings">Settings</Link> to view your interactive gig
          map and travel arcs.
        </p>
      </div>
    );
  }

  const abroadPins = pins.filter(isPinAbroad);
  const hasAbroad = abroadPins.length > 0;

  // Filter visible pins based on view mode
  const visiblePins = viewMode === "uk" && hasAbroad ? pins.filter((p) => !isPinAbroad(p)) : pins;

  // Calculate bounding box or normalize coordinates
  const allCoords = [];
  if (homeCoords && homeCoords[0] && homeCoords[1]) {
    allCoords.push({ lat: homeCoords[0], lng: homeCoords[1], isHome: true });
  }
  visiblePins.forEach((p) => {
    if (p.lat && p.lng) {
      allCoords.push({ lat: p.lat, lng: p.lng, pin: p });
    }
  });

  let minLat, maxLat, minLng, maxLng;
  if (viewMode === "world") {
    // Global framing across all pins
    minLat = Math.min(...allCoords.map((c) => c.lat), 30.0);
    maxLat = Math.max(...allCoords.map((c) => c.lat), 60.0);
    minLng = Math.min(...allCoords.map((c) => c.lng), -120.0);
    maxLng = Math.max(...allCoords.map((c) => c.lng), 10.0);
  }

  const latSpan = maxLat ? Math.max(maxLat - minLat, 3.0) : 1;
  const lngSpan = maxLng ? Math.max(maxLng - minLng, 4.0) : 1;

  // In UK viewMode, we use projectUkCoords to accurately match the UK silhouette outline
  const projectX = (lng, lat) => {
    if (viewMode === "uk") {
      return projectUkCoords(lng, lat).x;
    }
    return ((lng - minLng) / lngSpan) * 80 + 10;
  };

  const projectY = (lat, lng) => {
    if (viewMode === "uk") {
      return projectUkCoords(lng, lat).y;
    }
    return (1 - (lat - minLat) / latSpan) * 75 + 12;
  };

  const homeX = homeCoords ? projectX(homeCoords[1], homeCoords[0]) : 50;
  const homeY = homeCoords ? projectY(homeCoords[0], homeCoords[1]) : 50;

  return (
    <div className="chart-panel gig-odyssey-panel" data-testid="gig-odyssey-map">
      <div
        className="panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2 style={{ margin: 0 }}>Gig Odyssey Map</h2>
          <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 600 }}>
            Home: {homeCity || "Configured"}
          </span>
        </div>

        {hasAbroad && (
          <button
            type="button"
            className="sfm-link"
            onClick={() => {
              setSelectedPin(null);
              setViewMode((prev) => (prev === "uk" ? "world" : "uk"));
            }}
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              cursor: "pointer",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              textTransform: "none",
            }}
          >
            {viewMode === "uk" ? (
              <>
                ✈️ {abroadPins.length} gig{abroadPins.length === 1 ? "" : "s"} abroad (
                {abroadPins[0]?.city || abroadPins[0]?.country || "International"}) · Zoom out
              </>
            ) : (
              <>🇬🇧 Focus UK</>
            )}
          </button>
        )}
      </div>
      <p className="chart-caption" style={{ marginBottom: "14px" }}>
        {viewMode === "uk"
          ? "Venue hotspots and travel connections across the UK & Ireland."
          : "Global concert travel map and transatlantic flight arcs from your home city."}
      </p>

      <div
        className="odyssey-map-stage"
        style={{
          position: "relative",
          width: "100%",
          height: "380px",
          background: "var(--tl-tile, var(--color-surface-subtle))",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
        >
          {/* Subtle grid lines */}
          <line
            x1="0"
            y1="25"
            x2="100"
            y2="25"
            stroke="var(--color-border-subtle)"
            strokeWidth="0.3"
            strokeDasharray="1,1"
          />
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="var(--color-border-subtle)"
            strokeWidth="0.3"
            strokeDasharray="1,1"
          />
          <line
            x1="0"
            y1="75"
            x2="100"
            y2="75"
            stroke="var(--color-border-subtle)"
            strokeWidth="0.3"
            strokeDasharray="1,1"
          />
          <line
            x1="25"
            y1="0"
            x2="25"
            y2="100"
            stroke="var(--color-border-subtle)"
            strokeWidth="0.3"
            strokeDasharray="1,1"
          />
          <line
            x1="50"
            y1="0"
            x2="50"
            y2="100"
            stroke="var(--color-border-subtle)"
            strokeWidth="0.3"
            strokeDasharray="1,1"
          />
          <line
            x1="75"
            y1="0"
            x2="75"
            y2="100"
            stroke="var(--color-border-subtle)"
            strokeWidth="0.3"
            strokeDasharray="1,1"
          />

          {/* UK & Ireland Geographic Silhouette (in UK Focus mode) */}
          {viewMode === "uk" && (
            <path
              d={UK_MAP_PATH}
              fill="var(--color-surface, #ffffff)"
              stroke="var(--color-border)"
              strokeWidth="0.35"
              style={{
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.06))",
                opacity: 0.95,
              }}
            />
          )}

          {/* Travel arcs from home city */}
          {visiblePins.map((pin, i) => {
            const px = projectX(pin.lng, pin.lat);
            const py = projectY(pin.lat, pin.lng);
            const midX = (homeX + px) / 2;
            const midY = (homeY + py) / 2 - 2.5; // curved arc
            return (
              <path
                key={`arc-${i}`}
                d={`M ${homeX} ${homeY} Q ${midX} ${midY} ${px} ${py}`}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="0.4"
                strokeDasharray="1,1"
                opacity="0.6"
              />
            );
          })}

          {/* Home Beacon Marker */}
          <g transform={`translate(${homeX}, ${homeY})`} style={{ cursor: "default" }}>
            <circle r="2.2" fill="#10b981" opacity="0.3" />
            <circle r="1.4" fill="#10b981" stroke="#ffffff" strokeWidth="0.4" />
            <title>{`Home: ${homeCity || "Configured"}`}</title>
          </g>

          {/* Venue Cluster Markers */}
          {visiblePins.map((pin, index) => {
            const px = projectX(pin.lng, pin.lat);
            const py = projectY(pin.lat, pin.lng);
            const r = Math.min(2.8, 1.4 + pin.gig_count * 0.08);
            const isSelected = selectedPin?.venue_name === pin.venue_name;
            return (
              <g
                key={`pin-${index}`}
                transform={`translate(${px}, ${py})`}
                onClick={() => setSelectedPin(pin)}
                style={{ cursor: "pointer" }}
                className="map-marker-btn"
                role="button"
                tabIndex={0}
                aria-label={`${pin.venue_name} (${pin.gig_count} gigs)`}
              >
                <circle
                  r={r}
                  fill={isSelected ? "var(--color-ink)" : "var(--color-primary)"}
                  stroke="#ffffff"
                  strokeWidth="0.3"
                  style={{ filter: "drop-shadow(0 0.5px 1px rgba(0,0,0,0.3))" }}
                />
                {pin.gig_count > 1 && (
                  <text
                    textAnchor="middle"
                    dy="0.4"
                    fill="#ffffff"
                    fontSize="1.1"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {pin.gig_count}
                  </text>
                )}
                <title>{`${pin.venue_name} (${pin.gig_count} gigs)`}</title>
              </g>
            );
          })}
        </svg>

        {/* Selected Venue Popover */}
        {selectedPin && (
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              left: "10px",
              right: "10px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
              zIndex: 20,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong style={{ fontSize: "13px", color: "var(--color-ink)" }}>
                {selectedPin.venue_name}
              </strong>
              <small style={{ display: "block", color: "var(--color-muted)", fontSize: "11px" }}>
                {selectedPin.city}, {selectedPin.country} &middot; {selectedPin.gig_count} gig
                {selectedPin.gig_count === 1 ? "" : "s"}
                {selectedPin.artists?.length > 0 ? ` (${selectedPin.artists.join(", ")})` : ""}
              </small>
            </div>
            <button
              type="button"
              className="sfm-link"
              onClick={() => setSelectedPin(null)}
              style={{
                fontSize: "12px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {pins.length > 0 && (
        <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--color-muted)" }}>
          Showing <strong>{visiblePins.length}</strong> located venue hotspot
          {visiblePins.length === 1 ? "" : "s"}
          {viewMode === "uk" && hasAbroad
            ? ` in the UK & Ireland (${abroadPins.length} abroad). Click any pin to inspect artists seen.`
            : ". Click any pin to inspect artists seen."}
        </div>
      )}
    </div>
  );
}
