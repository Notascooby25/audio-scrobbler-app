import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import WrappedStory from "../components/wrapped/WrappedStory";
import { fetchWrappedYear, markWrappedSeen } from "../api/wrapped";
import { readSession } from "../session";

export default function WrappedPage() {
  const { year } = useParams();
  const navigate = useNavigate();
  const token = readSession()?.accessToken;
  const [state, setState] = useState({ status: "loading", snapshot: null });

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    setState({ status: "loading", snapshot: null });
    fetchWrappedYear({ token, year })
      .then((detail) => {
        if (cancelled) return;
        setState({ status: "ready", snapshot: detail.data });
        markWrappedSeen({ token, year })
          .then(() => window.dispatchEvent(new Event("wrapped_seen")))
          .catch(() => {});
      })
      .catch((error) => {
        if (!cancelled)
          setState({ status: error.status === 404 ? "missing" : "error", snapshot: null });
      });
    return () => {
      cancelled = true;
    };
  }, [token, year]);

  if (!token) {
    return (
      <section className="page-section">
        <h1>Your year in review</h1>
        <p>
          Sign in to see it. <Link to="/connect">Go to Connect</Link>
        </p>
      </section>
    );
  }

  if (state.status === "ready") {
    return <WrappedStory snapshot={state.snapshot} onClose={() => navigate("/reports")} />;
  }

  return (
    <section className="page-section">
      <h1>Your year in review</h1>
      {state.status === "loading" && <p>Loading…</p>}
      {state.status === "missing" && (
        <p>
          There&apos;s no review for {year} yet. <Link to="/reports">Back to Reports</Link>
        </p>
      )}
      {state.status === "error" && (
        <p>
          Couldn&apos;t load it just now. <Link to="/reports">Back to Reports</Link>
        </p>
      )}
    </section>
  );
}
