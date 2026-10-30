import { useState } from "react";
import { alreadyLoggedInfo, logManualConcert } from "../../api/setlists";
import AlreadyLoggedModal from "./AlreadyLoggedModal";

export default function ManualConcertModal({ isOpen, onClose, onSaved, token }) {
  const [artistName, setArtistName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");
  const [setlistUrl, setSetlistUrl] = useState("");
  const [isFestival, setIsFestival] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e, allowDuplicate = false) => {
    e?.preventDefault();
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
        isFestival,
        allowDuplicate,
      });
      setDuplicateInfo(null);
      if (onSaved) {
        onSaved(gig);
      }
      onClose();
    } catch (err) {
      const info = alreadyLoggedInfo(err);
      if (info) setDuplicateInfo(info);
      else setError(err?.message || "Failed to log concert manually.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-dialog sfm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-gig-title"
      >
        <div className="sfm-modal-head">
          <div>
            <h3 id="manual-gig-title">Log Upcoming or Custom Gig</h3>
            <p>Add upcoming tour dates or gigs not yet indexed by Setlist.fm</p>
          </div>
          <button type="button" className="sfm-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {error && (
          <p className="sfm-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="sfm-form-grid">
            <label>
              Artist Name *
              <input
                type="text"
                required
                placeholder="e.g. Shed Seven"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
              />
            </label>
            <label>
              Venue *
              <input
                type="text"
                required
                placeholder="e.g. O2 Academy Birmingham"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
              />
            </label>
            <label>
              City *
              <input
                type="text"
                required
                placeholder="e.g. Birmingham"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label>
              Country
              <input
                type="text"
                placeholder="e.g. United Kingdom"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </label>
            <label>
              Date *
              <input
                type="date"
                required
                aria-label="Event Date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </label>
          </div>

          <label className="sfm-field">
            Gig Notes (optional)
            <textarea
              rows={3}
              placeholder="e.g. Tickets booked, going with friends, balcony row B..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
            />
          </label>

          <label className="sfm-check">
            <input
              type="checkbox"
              checked={isFestival}
              onChange={(e) => setIsFestival(e.target.checked)}
            />
            <span>This was a festival</span>
          </label>

          <label className="sfm-field">
            Setlist.fm Link or Tour URL (optional)
            <input
              type="url"
              placeholder="https://www.setlist.fm/..."
              value={setlistUrl}
              onChange={(e) => setSetlistUrl(e.target.value)}
            />
          </label>

          <div className="modal-actions">
            <button
              type="button"
              className="modal-cancel-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="modal-confirm-button" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Log Concert"}
            </button>
          </div>
        </form>
      </div>

      <AlreadyLoggedModal
        info={duplicateInfo}
        isSubmitting={isSubmitting}
        onCancel={() => setDuplicateInfo(null)}
        onConfirm={() => handleSubmit(null, true)}
      />
    </div>
  );
}
