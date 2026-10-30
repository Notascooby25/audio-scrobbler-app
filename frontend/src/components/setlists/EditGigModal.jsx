import { useState } from "react";
import { alreadyLoggedInfo, updateConcert } from "../../api/setlists";
import AlreadyLoggedModal from "./AlreadyLoggedModal";

/** Corrects a logged gig's details; its scrobbles move with it. */
export default function EditGigModal({ gig, onClose, onSaved, token }) {
  const [artistName, setArtistName] = useState(gig.artist_name || "");
  const [venueName, setVenueName] = useState(gig.venue_name || "");
  const [city, setCity] = useState(gig.city || "");
  const [country, setCountry] = useState(gig.country || "");
  const [eventDate, setEventDate] = useState((gig.event_date || "").slice(0, 10));
  const [tourName, setTourName] = useState(gig.tour_name || "");
  const [isFestival, setIsFestival] = useState(Boolean(gig.is_festival));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  const handleSubmit = async (e, allowDuplicate = false) => {
    e?.preventDefault();
    if (!artistName.trim() || !venueName.trim() || !eventDate) {
      setError("Please fill in Artist, Venue and Date.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const updated = await updateConcert({
        token,
        concertId: gig.id,
        artistName: artistName.trim(),
        venueName: venueName.trim(),
        city: city.trim(),
        country: country.trim(),
        eventDate,
        tourName: tourName.trim() || null,
        isFestival,
        allowDuplicate,
      });
      setDuplicateInfo(null);
      onSaved(updated);
    } catch (err) {
      const info = alreadyLoggedInfo(err);
      if (info) setDuplicateInfo(info);
      else setError(err?.message || "Couldn't save your changes.");
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
        aria-labelledby="edit-gig-title"
      >
        <div className="sfm-modal-head">
          <div>
            <h3 id="edit-gig-title">Edit gig details</h3>
            <p>Fix a wrong date, artist or venue. The songs you heard move with the gig.</p>
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
              Artist *
              <input
                type="text"
                required
                maxLength={255}
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
              />
            </label>
            <label>
              Venue *
              <input
                type="text"
                required
                maxLength={255}
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
              />
            </label>
            <label>
              City
              <input
                type="text"
                maxLength={128}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label>
              Country
              <input
                type="text"
                maxLength={128}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </label>
            <label>
              Date *
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </label>
            <label>
              Tour
              <input
                type="text"
                maxLength={255}
                value={tourName}
                onChange={(e) => setTourName(e.target.value)}
              />
            </label>
          </div>
          <label className="sfm-check">
            <input
              type="checkbox"
              checked={isFestival}
              onChange={(e) => setIsFestival(e.target.checked)}
            />
            <span>This was a festival</span>
          </label>
          {!gig.is_support_act && (
            <p className="sfm-gig-meta">
              Support acts you logged with this gig move to the new date and venue too.
            </p>
          )}

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
              {isSubmitting ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>

      <AlreadyLoggedModal
        info={duplicateInfo}
        isEdit
        isSubmitting={isSubmitting}
        onCancel={() => setDuplicateInfo(null)}
        onConfirm={() => handleSubmit(null, true)}
      />
    </div>
  );
}
