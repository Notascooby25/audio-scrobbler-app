import { useState } from "react";
import { Link } from "react-router-dom";

export default function GigOdysseyMap({
  homeSet = false,
  homeCity = "",
  homeCoords = null,
  pins = [],
}) {
  const [selectedPin, setSelectedPin] = useState(null);

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

  // Calculate bounding box or normalize coordinates
  const allCoords = [];
  if (homeCoords && homeCoords[0] && homeCoords[1]) {
    allCoords.push({ lat: homeCoords[0], lng: homeCoords[1], isHome: true });
  }
  pins.forEach((p) => {
    if (p.lat && p.lng) {
      allCoords.push({ lat: p.lat, lng: p.lng, pin: p });
    }
  });

  const minLat = Math.min(...allCoords.map((c) => c.lat), 48.0);
  const maxLat = Math.max(...allCoords.map((c) => c.lat), 58.0);
  const minLng = Math.min(...allCoords.map((c) => c.lng), -8.0);
  const maxLng = Math.max(...allCoords.map((c) => c.lng), 4.0);

  const latSpan = Math.max(maxLat - minLat, 4.0);
  const lngSpan = Math.max(maxLng - minLng, 6.0);

  const projectX = (lng) => ((lng - minLng) / lngSpan) * 80 + 10;
  // Invert Y for screen coordinates (north is up)
  const projectY = (lat) => (1 - (lat - minLat) / latSpan) * 75 + 12;

  const homeX = homeCoords ? projectX(homeCoords[1]) : 50;
  const homeY = homeCoords ? projectY(homeCoords[0]) : 50;

  return (
    <div className="chart-panel gig-odyssey-panel" data-testid="gig-odyssey-map">
      <div
        className="panel-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "8px",
        }}
      >
        <h2>Gig Odyssey Map</h2>
        <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: 600 }}>
          Home: {homeCity || "Configured"}
        </span>
      </div>
      <p className="chart-caption" style={{ marginBottom: "14px" }}>
        Venue hotspots, clusters, and travel connections from your home city.
      </p>

      <div
        className="odyssey-map-stage"
        style={{
          position: "relative",
          width: "100%",
          height: "280px",
          background: "var(--tl-tile)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
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

          {/* Travel arcs from home city */}
          {pins.map((pin, i) => {
            const px = projectX(pin.lng);
            const py = projectY(pin.lat);
            const midX = (homeX + px) / 2;
            const midY = (homeY + py) / 2 - 4; // curved arc
            return (
              <path
                key={`arc-${i}`}
                d={`M ${homeX} ${homeY} Q ${midX} ${midY} ${px} ${py}`}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="0.6"
                strokeDasharray="1.5,1.5"
                opacity="0.6"
              />
            );
          })}
        </svg>

        {/* Home Beacon Marker */}
        <div
          title={`Home: ${homeCity}`}
          style={{
            position: "absolute",
            left: `${homeX}%`,
            top: `${homeY}%`,
            transform: "translate(-50%, -50%)",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "#10b981",
            border: "2px solid #ffffff",
            boxShadow: "0 0 8px rgba(16, 185, 129, 0.7)",
            zIndex: 10,
          }}
        />

        {/* Venue Cluster Markers */}
        {pins.map((pin, index) => {
          const px = projectX(pin.lng);
          const py = projectY(pin.lat);
          const size = Math.min(22, 12 + pin.gig_count);
          return (
            <button
              key={`pin-${index}`}
              type="button"
              className="map-marker-btn"
              onClick={() => setSelectedPin(pin)}
              style={{
                position: "absolute",
                left: `${px}%`,
                top: `${py}%`,
                transform: "translate(-50%, -50%)",
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: "50%",
                background: "var(--color-primary)",
                border: "2px solid #ffffff",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: "9px",
                fontWeight: 700,
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                zIndex: 5,
              }}
              title={`${pin.venue_name} (${pin.gig_count} gigs)`}
            >
              {pin.gig_count > 1 ? pin.gig_count : ""}
            </button>
          );
        })}

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
          Showing <strong>{pins.length}</strong> located venue hotspot{pins.length === 1 ? "" : "s"}
          . Click any pin to inspect artists seen.
        </div>
      )}
    </div>
  );
}
