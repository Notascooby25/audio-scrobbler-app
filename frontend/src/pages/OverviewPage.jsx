import { Link } from "react-router-dom";
import AnalyticsPage from "../components/AnalyticsPage";
import RediscoverCard from "../components/RediscoverCard";
import JukeboxCard from "../components/jukebox/JukeboxCard";
import FriendRecommendationsCard from "../components/recommend/FriendRecommendationsCard";
import { readSession } from "../session";
import Slot from "../skins/Slot";

function ClassicOverviewContent({ session }) {
  return (
    <AnalyticsPage eyebrow="Jukebox" title="Play">
      {!session?.accessToken ? (
        <p className="notice">
          Connect Spotify from the <Link to="/connect">connection page</Link> to spin your Album
          Jukebox and explore your Time Capsule.
        </p>
      ) : (
        <>
          <FriendRecommendationsCard token={session.accessToken} />
          <JukeboxCard token={session.accessToken} />
          <RediscoverCard token={session.accessToken} />
        </>
      )}
    </AnalyticsPage>
  );
}

export default function OverviewPage() {
  const session = readSession();

  return (
    <Slot name="playPage" fallback={<ClassicOverviewContent session={session} />} />
  );
}
