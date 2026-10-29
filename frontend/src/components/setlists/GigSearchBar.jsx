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
    const trimmedArtist = artistName.trim();
    const trimmedVenue = venueName.trim();
    if (!trimmedArtist && !trimmedVenue) return;

    // Check if user entered a Setlist.fm URL or direct setlist ID in the artist box
    const isSetlistUrlOrId =
      trimmedArtist.includes("setlist.fm") || /^[0-9a-fA-F]{7,10}$/.test(trimmedArtist);

    onSearch({
      artistName: isSetlistUrlOrId ? undefined : trimmedArtist,
      setlistUrlOrId: isSetlistUrlOrId ? trimmedArtist : undefined,
      countryCode,
      venueName: trimmedVenue,
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
    });
  };

  const field = (label, control) => (
    <label>
      {label}
      {control}
    </label>
  );

  return (
    <form onSubmit={handleSubmit} className="sfm-search">
      <div className="sfm-form-grid">
        {field(
          "Artist / Tour",
          <input
            type="text"
            placeholder="Search artist or paste Setlist.fm link / ID"
            aria-label="Artist / Tour"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
          />
        )}
        {field(
          "Country",
          <select
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
        )}
        {field(
          "Venue",
          <input
            type="text"
            placeholder="Filter venue (e.g. Anfield)"
            aria-label="Venue"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
          />
        )}
        {field(
          "Month",
          <select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        {field(
          "Year",
          <input
            type="number"
            placeholder="e.g. 2024"
            aria-label="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="1950"
            max="2030"
          />
        )}
      </div>
      <div className="sfm-form-actions">
        <button type="submit" disabled={isLoading || (!artistName.trim() && !venueName.trim())}>
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}
