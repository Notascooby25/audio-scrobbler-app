import React from "react";
import JukeboxCard from "../../../components/jukebox/JukeboxCard";
import RediscoverCard from "../../../components/RediscoverCard";
import FriendRecommendationsCard from "../../../components/recommend/FriendRecommendationsCard";
import { readSession } from "../../../session";
import { Link } from "react-router-dom";

/**
 * SleevePlayPage
 * The album-led Play view for Sleeve skin.
 * Renders tonight's album pick with big sleeve styling, jukebox filter pills,
 * and the Time Capsule list below.
 * Protected invariant: RetroJukebox cabinet is completely untouched.
 */
export default function SleevePlayPage() {
  const session = readSession();

  if (!session?.accessToken) {
    return (
      <div className="sleeve-play-page">
        <div className="sleeve-empty-state">
          <h2>Play</h2>
          <p>
            Connect Spotify from the <Link to="/connect">connection hub</Link> to spin your Album
            Jukebox and explore your Time Capsule.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sleeve-play-page">
      <header className="sleeve-page-header">
        <h1 className="sleeve-page-title">Play</h1>
      </header>

      <FriendRecommendationsCard token={session.accessToken} />

      <section className="sleeve-jukebox-section" aria-label="Album Jukebox">
        <JukeboxCard token={session.accessToken} />
      </section>

      <section className="sleeve-time-capsule-section" aria-label="Time Capsule">
        <RediscoverCard token={session.accessToken} />
      </section>
    </div>
  );
}
