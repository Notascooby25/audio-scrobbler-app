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

const MONTHS = [
  { value: "", label: "All Months" },
  { value: "1", label: "01 - January" },
  { value: "2", label: "02 - February" },
  { value: "3", label: "03 - March" },
  { value: "4", label: "04 - April" },
  { value: "5", label: "05 - May" },
  { value: "6", label: "06 - June" },
  { value: "7", label: "07 - July" },
  { value: "8", label: "08 - August" },
  { value: "9", label: "09 - September" },
  { value: "10", label: "10 - October" },
  { value: "11", label: "11 - November" },
  { value: "12", label: "12 - December" },
];

export default function GigSearchBar({ onSearch, isLoading }) {
  const [artistName, setArtistName] = useState("");
  const [countryCode, setCountryCode] = useState("GB");
  const [venueName, setVenueName] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!artistName.trim() && !venueName.trim()) return;
    onSearch({
      artistName: artistName.trim(),
      countryCode,
      venueName: venueName.trim(),
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card p-4 mb-4"
      style={{ border: "0.5px solid var(--color-border)" }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">
            Artist / Tour
          </label>
          <input
            type="text"
            className="input-field w-full"
            placeholder="Search artist (e.g. Foo Fighters)"
            aria-label="Artist / Tour"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">Country</label>
          <select
            className="input-field w-full"
            aria-label="Country"
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
            aria-label="Venue"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">Month</label>
          <select
            className="input-field w-full"
            aria-label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-muted mb-1">Year</label>
          <input
            type="number"
            className="input-field w-full"
            placeholder="Year (e.g. 2026)"
            aria-label="Year"
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
