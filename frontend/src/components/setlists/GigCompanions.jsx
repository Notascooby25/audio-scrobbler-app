import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { addGigCompanions, fetchGigCompanions, removeGigCompanion } from "../../api/setlists";

const STATUS_LABELS = { added: "✓ Added it", pending: "Invited", dismissed: "Not added" };
// Show a name filter once the picker gets long
const FILTER_FROM = 8;

/** "Went with": people you follow who were at this gig too. They're asked before it's added. */
export default function GigCompanions({ concertId, token }) {
  const [data, setData] = useState(null);
  const [isPicking, setIsPicking] = useState(false);
  const [chosen, setChosen] = useState([]);
  const [query, setQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    fetchGigCompanions({ token, concertId })
      // Anything unexpected just hides the box rather than breaking the gig page
      .then((res) => isMounted && setData(Array.isArray(res?.companions) ? res : null))
      .catch(() => isMounted && setData(null));
    return () => {
      isMounted = false;
    };
  }, [concertId, token]);

  if (!data) return null;

  const closePicker = () => {
    setIsPicking(false);
    setChosen([]);
    setQuery("");
  };

  const toggle = (userId) =>
    setChosen((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );

  const handleAdd = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const updated = await addGigCompanions({ token, concertId, friendIds: chosen });
      setData(updated);
      closePicker();
    } catch (err) {
      setMessage(`Couldn't add them: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (person) => {
    setMessage("");
    try {
      await removeGigCompanion({ token, concertId, friendId: person.user_id });
      setData((prev) => ({
        companions: prev.companions.filter((p) => p.user_id !== person.user_id),
        following: [...prev.following, { ...person, logged_it: person.status === "added" }],
      }));
    } catch (err) {
      setMessage(`Couldn't remove ${person.display_name}: ${err.message}`);
    }
  };

  const needle = query.trim().toLowerCase();
  const choices = data.following.filter(
    (p) =>
      !needle ||
      p.display_name.toLowerCase().includes(needle) ||
      p.username.toLowerCase().includes(needle)
  );

  return (
    <section className="sfm-gig-section">
      <div className="sfm-gig-section-head">
        <h2>Went with</h2>
        {!isPicking && (
          <button type="button" className="sfm-link" onClick={() => setIsPicking(true)}>
            + Add people
          </button>
        )}
      </div>

      {data.companions.length > 0 ? (
        <ul className="sfm-bill">
          {data.companions.map((person) => (
            <li key={person.user_id}>
              <span className="sfm-bill-name">
                <Link className="sfm-link" to={`/profile/${person.user_id}`}>
                  {person.display_name}
                </Link>
              </span>
              <span className="sfm-bill-status">
                <span className={person.status === "added" ? "sfm-bill-done" : "sfm-gig-meta"}>
                  {STATUS_LABELS[person.status] || person.status}
                </span>
                <button
                  type="button"
                  className="sfm-link is-muted"
                  onClick={() => handleRemove(person)}
                  aria-label={`Remove ${person.display_name}`}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !isPicking && (
          <p className="sfm-gig-meta">
            Went with people you follow? Add them and they&apos;ll be asked to add this gig to their
            own Set Lists.
          </p>
        )
      )}

      {isPicking && (
        <div className="sfm-picker">
          {data.following.length === 0 ? (
            <p className="sfm-gig-meta">
              {data.companions.length > 0
                ? "Everyone you follow is already on this gig."
                : "You don't follow anyone yet."}{" "}
              <Link className="sfm-link" to="/following">
                Find people
              </Link>
            </p>
          ) : (
            <>
              {data.following.length >= FILTER_FROM && (
                <input
                  type="search"
                  className="sfm-picker-filter"
                  placeholder="Filter people"
                  aria-label="Filter people"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              )}
              <ul className="sfm-picker-list">
                {choices.map((person) => (
                  <li key={person.user_id}>
                    <label className="sfm-check">
                      <input
                        type="checkbox"
                        checked={chosen.includes(person.user_id)}
                        onChange={() => toggle(person.user_id)}
                      />
                      {person.display_name}
                      {person.logged_it && (
                        <span className="sfm-tag is-muted">Logged this gig</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="sfm-notes-actions">
            <button type="button" className="sfm-link is-muted" onClick={closePicker}>
              Cancel
            </button>
            {data.following.length > 0 && (
              <button
                type="button"
                className="sfm-link"
                onClick={handleAdd}
                disabled={chosen.length === 0 || isSaving}
              >
                {isSaving ? "Adding..." : chosen.length ? `Add (${chosen.length})` : "Add"}
              </button>
            )}
          </div>
        </div>
      )}

      {message && (
        <p className="sfm-gig-meta" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
