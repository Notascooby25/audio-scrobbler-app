import { Link } from "react-router-dom";
import AnalyticsPage from "../components/AnalyticsPage";
import RediscoverCard from "../components/RediscoverCard";
import JukeboxCard from "../components/jukebox/JukeboxCard";
import { readSession } from "../session";

export default function OverviewPage() {
  const session = readSession();

  return (
    <AnalyticsPage eyebrow="Personal archive" title="Play">
      {!session?.accessToken ? (
        <p className="notice">
          Connect Spotify from the <Link to="/connect">connection page</Link> to spin your Album
          Jukebox and explore your Time Capsule.
        </p>
      ) : (
        <>
          <JukeboxCard token={session.accessToken} />
          <RediscoverCard token={session.accessToken} />
        </>
      )}
    </AnalyticsPage>
  );
}
