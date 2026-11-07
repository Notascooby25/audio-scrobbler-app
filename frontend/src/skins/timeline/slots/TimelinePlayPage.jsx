import React from "react";
import { Link } from "react-router-dom";
import JukeboxCard from "../../../components/jukebox/JukeboxCard";
import RediscoverCard from "../../../components/RediscoverCard";
import { readSession } from "../../../session";

/**
 * TimelinePlayPage
 * Slot component for the Play route (/play) in Timeline skin.
 * Presents a calm, data-first view of tonight's album recommendation
 * and the Time Capsule (forgotten favorites & anniversary memory tracks).
 *
 * Protected invariant: RetroJukebox cabinet is completely untouched.
 */
export default function TimelinePlayPage() {
  const session = readSession();

  if (!session?.accessToken) {
    return (
      <div className="timeline-play-page">
        <div className="timeline-empty-notice" role="status">
          <h1 className="timeline-page-title">Play</h1>
          <p>
            Connect Spotify from the <Link to="/connect">connection page</Link> to spin your Album
            Jukebox and explore your Time Capsule.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-play-page">
      <header className="timeline-page-header">
        <h1 className="timeline-page-title">Play</h1>
        <p className="timeline-page-subtitle">An album from your own history, start to finish.</p>
      </header>

      <section className="timeline-jukebox-section" aria-label="Album Jukebox">
        <JukeboxCard token={session.accessToken} />
      </section>

      <section className="timeline-rediscover-section" aria-label="Time Capsule">
        <RediscoverCard token={session.accessToken} />
      </section>
    </div>
  );
}
