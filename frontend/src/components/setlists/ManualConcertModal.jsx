import { useState } from "react";
import { logManualConcert } from "../../api/setlists";

export default function ManualConcertModal({ isOpen, onClose, onSaved, token }) {
  const [artistName, setArtistName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");
  const [setlistUrl, setSetlistUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (!artistName.trim() || !venueName.trim() || !city.trim() || !eventDate) {
      setError("Please fill in Artist, Venue, City, and Date.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const gig = await logManualConcert({
        token,
        artistName: artistName.trim(),
        venueName: venueName.trim(),
        city: city.trim(),
        country: country.trim() || "United Kingdom",
        eventDate,
        notes: notes.trim() || null,
        setlistUrl: setlistUrl.trim() || null,
      });
      if (onSaved) {
        onSaved(gig);
      }
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to log concert manually.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div
        className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          border: "0.5px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-ink">Log Upcoming or Custom Gig</h3>
            <p className="text-xs text-muted">
              Add upcoming tour dates or gigs not yet indexed by Setlist.fm
            </p>
          </div>
          <button
            type="button"
            className="text-muted hover:text-ink text-xl font-bold cursor-pointer bg-transparent border-0"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {error && <div className="card p-3 text-danger bg-danger-soft text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block uppercase tracking-wider text-muted font-bold mb-1">
              Artist Name *
            </label>
            <input
              type="text"
              required
              className="input-field w-full text-xs"
              placeholder="e.g. Shed Seven"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block uppercase tracking-wider text-muted font-bold mb-1">
                Venue *
              </label>
              <input
                type="text"
                required
                className="input-field w-full text-xs"
                placeholder="e.g. O2 Academy Birmingham"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
              />
            </div>
            <div>
              <label className="block uppercase tracking-wider text-muted font-bold mb-1">
                City *
              </label>
              <input
                type="text"
                required
                className="input-field w-full text-xs"
                placeholder="e.g. Birmingham"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block uppercase tracking-wider text-muted font-bold mb-1">
                Country
              </label>
              <input
                type="text"
                className="input-field w-full text-xs"
                placeholder="e.g. United Kingdom"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
            <div>
              <label className="block uppercase tracking-wider text-muted font-bold mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                aria-label="Event Date"
                className="input-field w-full text-xs"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block uppercase tracking-wider text-muted font-bold mb-1">
              Gig Notes (optional)
            </label>
            <textarea
              className="input-field w-full text-xs h-20 resize-none"
              placeholder="e.g. Tickets booked, going with friends, balcony row B..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div>
            <label className="block uppercase tracking-wider text-muted font-bold mb-1">
              Setlist.fm Link or Tour URL (optional)
            </label>
            <input
              type="url"
              className="input-field w-full text-xs"
              placeholder="https://www.setlist.fm/..."
              value={setlistUrl}
              onChange={(e) => setSetlistUrl(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              className="btn btn-secondary text-xs px-3 py-1.5"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary text-xs px-4 py-1.5 font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Log Concert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
