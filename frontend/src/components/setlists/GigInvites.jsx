import { useEffect, useState } from "react";
import { answerGigInvite, fetchGigInvites } from "../../api/setlists";
import { parseDateParts } from "./SetlistDateBadge";

function displayDate(raw) {
  const { day, month, year } = parseDateParts(raw);
  return `${Number(day) || day} ${month.charAt(0)}${month.slice(1).toLowerCase()} ${year}`;
}

/** Gigs people you know say you were at. Nothing is added until you choose Add. */
export default function GigInvites({ token, onAdded }) {
  const [invites, setInvites] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return undefined;
    let isMounted = true;
    fetchGigInvites({ token })
      .then((data) => isMounted && setInvites(Array.isArray(data) ? data : []))
      .catch(() => isMounted && setInvites([]));
    return () => {
      isMounted = false;
    };
  }, [token]);

  if (invites.length === 0 && !message) return null;

  const answer = async (invite, add) => {
    setBusyId(invite.id);
    setMessage("");
    try {
      await answerGigInvite({ token, inviteId: invite.id, add });
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (add) {
        setMessage(`Added ${invite.artist_name} to your gigs.`);
        onAdded?.();
      }
    } catch (err) {
      setMessage(`Couldn't update that invite: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="sfm-gig-section sfm-invites" aria-label="Gig invites">
      {invites.length > 0 && <h2>Were you there?</h2>}
      <ul className="sfm-bill">
        {invites.map((invite) => (
          <li key={invite.id}>
            <span className="sfm-bill-name">
              <strong>{invite.from_user.display_name}</strong> says you were at{" "}
              <strong>{invite.artist_name}</strong>,{" "}
              {[invite.venue_name, invite.city].filter(Boolean).join(", ")} on{" "}
              {displayDate(invite.event_date)}
              {invite.support_acts.length > 0 && (
                <span className="sfm-gig-meta"> (with {invite.support_acts.join(", ")})</span>
              )}
            </span>
            <span className="sfm-bill-status">
              <button
                type="button"
                className="sfm-link"
                onClick={() => answer(invite, true)}
                disabled={busyId === invite.id}
              >
                {busyId === invite.id ? "Adding..." : "Add to my gigs"}
              </button>
              <button
                type="button"
                className="sfm-link is-muted"
                onClick={() => answer(invite, false)}
                disabled={busyId === invite.id}
              >
                Dismiss
              </button>
            </span>
          </li>
        ))}
      </ul>
      {message && (
        <p className="sfm-gig-meta" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
