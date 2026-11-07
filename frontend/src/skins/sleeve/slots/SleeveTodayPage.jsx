import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Artwork from "../../../components/Artwork";
import SleeveVinylDisc from "./SleeveVinylDisc";
import { fetchNowPlaying, fetchRecentScrobbles } from "../../../api";
import { readSession } from "../../../session";
import { formatScrobbleTime } from "../../../timeFormatting";
import { applySleeveColor } from "../sleeveColor";

export default function SleeveTodayPage() {
  const session = readSession();
  const [nowPlaying, setNowPlaying] = useState(null);
  const [recentScrobbles, setRecentScrobbles] = useState([]);
  const [totalScrobbles, setTotalScrobbles] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      try {
        const promises = [
          fetchRecentScrobbles({ token: session.accessToken, limit: 30 }).catch(() => null),
        ];
        if (session.userId) {
          promises.push(
            fetchNowPlaying({ token: session.accessToken, userId: session.userId }).catch(
              () => null
            )
          );
        }

        const [scrobblesRes, nowPlayingRes] = await Promise.all(promises);

        if (!isMounted) return;

        if (scrobblesRes?.scrobbles) {
          setRecentScrobbles(scrobblesRes.scrobbles);
          setTotalScrobbles(scrobblesRes.total ?? scrobblesRes.scrobbles.length);
        }

        if (nowPlayingRes?.is_playing) {
          setNowPlaying(nowPlayingRes);
        } else {
          setNowPlaying(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    // Poll now playing every 15 seconds
    const interval = setInterval(async () => {
      if (!session?.userId) return;
      try {
        const res = await fetchNowPlaying({ token: session.accessToken, userId: session.userId });
        if (isMounted) {
          if (res?.is_playing) {
            setNowPlaying(res);
          } else {
            setNowPlaying(null);
          }
        }
      } catch {
        // quiet poll fail
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [session?.accessToken, session?.userId]);

  // Determine active hero track: either live playing track or most recent scrobble
  const isRealtime = Boolean(nowPlaying?.is_playing);
  const heroTrack = isRealtime
    ? {
        track_name: nowPlaying.track_name,
        artist_name: nowPlaying.artist_name,
        album_name: nowPlaying.album_name,
        artwork_url: nowPlaying.artwork_url,
        artwork_color: nowPlaying.artwork_color,
        source: "spotify",
        is_playing: true,
      }
    : recentScrobbles[0] || null;

  useEffect(() => {
    const artworkColor = heroTrack?.artwork_color || null;
    if (artworkColor) {
      sessionStorage.setItem("sleeve-latest-artwork-color", artworkColor);
    } else {
      sessionStorage.removeItem("sleeve-latest-artwork-color");
    }

    const matchSleeve = localStorage.getItem("audio-scrobbler-match-sleeve") !== "false";
    applySleeveColor(artworkColor, matchSleeve);
    window.dispatchEvent(
      new CustomEvent("sleeve-artwork-color-changed", { detail: { color: artworkColor } })
    );
  }, [heroTrack?.artwork_color]);

  // Earlier tracks for the crate: exclude the hero track if it's the first scrobble
  const crateTracks = isRealtime ? recentScrobbles : recentScrobbles.slice(1);

  if (!session?.accessToken) {
    return (
      <div className="sleeve-today-page">
        <div className="sleeve-empty-state">
          <h2>Welcome to Sleeve</h2>
          <p>
            Connect Spotify from the <Link to="/connect">connection hub</Link> to view your live
            listening sleeve and today&apos;s records.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sleeve-today-page">
        <div className="sleeve-loading-state" aria-live="polite">
          Loading today&apos;s sleeve...
        </div>
      </div>
    );
  }

  if (!heroTrack) {
    return (
      <div className="sleeve-today-page">
        <div className="sleeve-empty-state">
          <h2>Nothing played yet</h2>
          <p>Put on some music to start your day&apos;s listening stack.</p>
          <Link to="/connect" className="sleeve-action-btn">
            Connect Sources
          </Link>
        </div>
      </div>
    );
  }

  const relativeTime = heroTrack.is_playing
    ? "Playing now"
    : heroTrack.played_at
      ? `Scrobbled ${formatScrobbleTime(heroTrack.played_at, Date.now(), "relative")}`
      : "Recently scrobbled";

  const sourceName =
    heroTrack.source === "apple"
      ? "Apple Music"
      : heroTrack.source === "youtube"
        ? "YouTube"
        : heroTrack.source === "bbc_sounds"
          ? "BBC Sounds"
          : "Spotify";

  return (
    <div className="sleeve-today-page">
      {/* 1. Now-playing stack */}
      <section className="sleeve-now-playing-section" aria-label="Current listening">
        <div className="sleeve-stack-container">
          {/* Peeking vinyl disc on the right */}
          <div className="sleeve-vinyl-wrapper">
            <SleeveVinylDisc isPlaying={Boolean(heroTrack.is_playing)} />
          </div>

          {/* 252px Sleeve Tile */}
          <div className="sleeve-tile-wrapper">
            {heroTrack.artwork_url ? (
              <Artwork
                src={heroTrack.artwork_url}
                label={`${heroTrack.album_name || heroTrack.track_name || "Album"}`}
                className="sleeve-hero-art"
              />
            ) : (
              <div
                className="sleeve-hero-fallback"
                role="img"
                aria-label="Album artwork placeholder"
              >
                <span className="sleeve-fallback-initials">
                  {(heroTrack.artist_name || "?").slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Track info beneath stack */}
        <div className="sleeve-hero-info">
          <h1 className="sleeve-hero-title">{heroTrack.track_name || "Unknown Track"}</h1>
          <p className="sleeve-hero-artist">{heroTrack.artist_name || "Unknown Artist"}</p>
          <p className="sleeve-hero-meta">
            {heroTrack.album_name && <span>{heroTrack.album_name} • </span>}
            <span>{relativeTime}</span>
            <span> from {sourceName}</span>
          </p>
        </div>
      </section>

      {/* 2. Earlier today crate */}
      {crateTracks.length > 0 && (
        <section className="sleeve-earlier-section" aria-label="Earlier today">
          <div className="sleeve-section-header">
            <h2 className="sleeve-section-title">Earlier today</h2>
            <Link to="/library" className="sleeve-see-all-link">
              See all {totalScrobbles} →
            </Link>
          </div>

          <div className="sleeve-crate-scroll">
            {crateTracks.map((item, idx) => (
              <div
                key={item.id || `${item.track_name}-${item.played_at || idx}`}
                className="sleeve-crate-card"
              >
                <div className="sleeve-crate-tile">
                  {item.artwork_url ? (
                    <Artwork
                      src={item.artwork_url}
                      label={item.album_name || item.track_name}
                      className="sleeve-crate-art"
                    />
                  ) : (
                    <div className="sleeve-crate-fallback" aria-hidden="true">
                      <span>{(item.artist_name || "?").slice(0, 2).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="sleeve-crate-info">
                  <div className="sleeve-crate-title" title={item.track_name}>
                    {item.track_name}
                  </div>
                  <div className="sleeve-crate-artist" title={item.artist_name}>
                    {item.artist_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
