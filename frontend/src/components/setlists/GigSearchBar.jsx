import { useState } from "react";

const COUNTRIES = [
  { code: "", label: "All Countries" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "IE", label: "Ireland" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
];

export default function GigSearchBar({ onSearch, isLoading }) {
  const [artistName, setArtistName] = useState("");
  const [countryCode, setCountryCode] = useState("GB");
  const [venueName, setVenueName] = useState("");
  const [year, setYear] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!artistName.trim() && !venueName.trim()) return;
    onSearch({
      artistName: artistName.trim(),
      countryCode,
      venueName: venueName.trim(),
      year: year ? parseInt(year, 10) : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card p-4 mb-4"
      style={{ border: "0.5px solid var(--color-border)" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">
            Artist / Tour
          </label>
          <input
            type="text"
            className="input-field w-full"
            placeholder="Search artist (e.g. Foo Fighters)"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">Country</label>
          <select
            className="input-field w-full"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">Venue</label>
          <input
            type="text"
            className="input-field w-full"
            placeholder="Filter venue (e.g. Anfield)"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">Year</label>
          <input
            type="number"
            className="input-field w-full"
            placeholder="Year (e.g. 2026)"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="1950"
            max="2030"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || (!artistName.trim() && !venueName.trim())}
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}
