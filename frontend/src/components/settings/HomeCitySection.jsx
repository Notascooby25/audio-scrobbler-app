import { useState } from "react";
import { clearHomeCity, setHomeCity } from "../../api";

/** Where you live, for working out how far you've travelled to gigs. Only you see the distances. */
export default function HomeCitySection({ token, savedCity = null, onChanged = null }) {
  const [city, setCity] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    if (!city.trim()) return;
    setIsSaving(true);
    setError("");
    setStatus("");
    try {
      const prefs = await setHomeCity({ token, city: city.trim() });
      setCity("");
      setStatus("Saved");
      if (onChanged) onChanged(prefs.home_city || null);
    } catch (err) {
      setError(err?.message || "Couldn't save your home city.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    setError("");
    setStatus("");
    try {
      await clearHomeCity({ token });
      setStatus("Cleared");
      if (onChanged) onChanged(null);
    } catch (err) {
      setError(err?.message || "Couldn't clear your home city.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="settings-form" aria-labelledby="home-city-heading">
      <h2 id="home-city-heading">Home city</h2>
      <p>
        Used to work out how far you&apos;ve travelled to gigs on the Gigs tab of Reports. Only you
        see these distances.
      </p>
      <p>
        {savedCity ? (
          <>
            Set to <strong>{savedCity}</strong>.
          </>
        ) : (
          "Not set yet."
        )}
      </p>
      <form onSubmit={handleSave}>
        <label>
          {savedCity ? "Change home city" : "Home city"}
          <input
            type="text"
            aria-label="Home city"
            placeholder="e.g. Leeds, United Kingdom"
            maxLength={128}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={isSaving}
          />
        </label>
        <div className="settings-actions">
          <button type="submit" disabled={isSaving || !city.trim()}>
            {isSaving ? "Saving..." : "Save home city"}
          </button>
          {savedCity && (
            <button type="button" onClick={handleClear} disabled={isSaving}>
              Clear
            </button>
          )}
        </div>
      </form>
      {error && (
        <p className="sfm-error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
