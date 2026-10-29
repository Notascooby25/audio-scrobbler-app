import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { alreadyLoggedInfo, deleteAttendance, fetchGigBill, logBillAct } from "../../api/setlists";

const ROLE_LABELS = { support: "Support", headliner: "Headliner" };

/** "On the bill": the other acts at this venue that night, and whether you logged each. */
export default function GigBill({ concertId, token }) {
  const [bill, setBill] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  // setlist_id -> concert id for acts logged from this box, so they can be undone
  const [justLogged, setJustLogged] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    fetchGigBill({ token, concertId })
      .then((data) => isMounted && setBill(data))
      .catch(() => isMounted && setBill(null))
      .finally(() => isMounted && setIsLoading(false));
    return () => {
      isMounted = false;
    };
  }, [concertId, token]);

  const updateAct = (setlistId, changes) =>
    setBill((prev) => ({
      ...prev,
      acts: prev.acts.map((a) => (a.setlist_id === setlistId ? { ...a, ...changes } : a)),
    }));

  const handleLog = async (act) => {
    setBusyId(act.setlist_id);
    setMessage("");
    try {
      const logged = await logBillAct({ token, concertId, setlistId: act.setlist_id });
      updateAct(act.setlist_id, {
        logged: true,
        concert_id: logged.id,
        role: logged.is_support_act ? "support" : act.role,
      });
      setJustLogged((prev) => ({ ...prev, [act.setlist_id]: logged.id }));
    } catch (err) {
      const info = alreadyLoggedInfo(err);
      if (info) updateAct(act.setlist_id, { logged: true, concert_id: info.existing.id });
      else setMessage(`Couldn't log ${act.artist_name}: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleUndo = async (act) => {
    setBusyId(act.setlist_id);
    setMessage("");
    try {
      await deleteAttendance({
        token,
        concertId: justLogged[act.setlist_id],
        includeSupportActs: false,
      });
      updateAct(act.setlist_id, { logged: false, concert_id: null, role: null });
      setJustLogged(({ [act.setlist_id]: _removed, ...rest }) => rest);
    } catch (err) {
      setMessage(`Couldn't undo: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="sfm-gig-section">
        <h2>On the bill</h2>
        <p className="sfm-gig-meta">Checking who else played...</p>
      </section>
    );
  }

  // Nothing to show: no other acts known (e.g. most upcoming gigs), or the lookup failed
  if (!bill || (bill.acts.length === 0 && bill.complete)) return null;

  return (
    <section className="sfm-gig-section">
      <h2>On the bill</h2>
      {bill.acts.length > 0 ? (
        <ul className="sfm-bill">
          {bill.acts.map((act) => (
            <li key={act.setlist_id}>
              <span className="sfm-bill-name">
                {act.logged && act.concert_id ? (
                  <Link className="sfm-link" to={`/gigs/${act.concert_id}`}>
                    {act.artist_name}
                  </Link>
                ) : (
                  act.artist_name
                )}
                {act.role && <span className="sfm-tag is-muted">{ROLE_LABELS[act.role]}</span>}
              </span>
              <span className="sfm-bill-status">
                {act.logged ? (
                  <>
                    <span className="sfm-bill-done">✓ I was there</span>
                    {justLogged[act.setlist_id] && (
                      <button
                        type="button"
                        className="sfm-link is-muted"
                        onClick={() => handleUndo(act)}
                        disabled={busyId === act.setlist_id}
                      >
                        Undo
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="sfm-link"
                    onClick={() => handleLog(act)}
                    disabled={busyId === act.setlist_id}
                    aria-label={`I was there for ${act.artist_name}`}
                  >
                    {busyId === act.setlist_id ? "Saving..." : "+ I was there"}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!bill.complete && (
        <p className="sfm-gig-meta">
          Couldn&apos;t check Setlist.fm just now, so this may be incomplete.
        </p>
      )}
      {bill.capped && (
        <p className="sfm-gig-meta">Showing the first 10 acts Setlist.fm lists for this night.</p>
      )}
      {message && (
        <p className="sfm-gig-meta" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
