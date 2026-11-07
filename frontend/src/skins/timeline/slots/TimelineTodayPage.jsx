import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNowPlaying, fetchRecentScrobbles, likeTrack, unlikeTrack } from "../../../api";
import { readSession } from "../../../session";
import TimelineHourlyChart from "./TimelineHourlyChart";
import TimelineRail from "./TimelineRail";

export function formatTodayHeaderDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function computeTodayStats(scrobbles = []) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const todayScrobbles = scrobbles.filter((s) => {
    if (!s.played_at) return false;
    return new Date(s.played_at).getTime() >= startOfToday;
  });

  const totalDurationMs = todayScrobbles.reduce((acc, s) => acc + (s.duration_ms || 210000), 0);
  const totalMinutes = Math.round(totalDurationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationText =
    hours > 0 ? `${hours} h ${minutes} m of listening` : `${minutes} m of listening`;

  return {
    todayScrobbles,
    count: todayScrobbles.length,
    subtitle: `${todayScrobbles.length} play${todayScrobbles.length === 1 ? "" : "s"} so far, ${durationText}`,
  };
}

export default function TimelineTodayPage() {
  const session = readSession();
  const [nowPlaying, setNowPlaying] = useState(null);
  const [recentScrobbles, setRecentScrobbles] = useState([]);
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
          fetchRecentScrobbles({ token: session.accessToken, limit: 100 }).catch(() => null),
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
        const np = await fetchNowPlaying({
          token: session.accessToken,
          userId: session.userId,
        });
        if (isMounted) {
          setNowPlaying(np?.is_playing ? np : null);
        }
      } catch (_err) {
        // Silently catch background poll failures
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [session?.accessToken, session?.userId]);

  const handleToggleLike = async (item) => {
    if (!session?.accessToken) return;
    const wasLiked = Boolean(item.is_liked);
    const newLiked = !wasLiked;

    // Optimistically update scrobbles
    setRecentScrobbles((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, is_liked: newLiked } : s))
    );
    if (nowPlaying && nowPlaying.track_name === item.track_name) {
      setNowPlaying((prev) => (prev ? { ...prev, is_liked: newLiked } : prev));
    }

    try {
      if (wasLiked) {
        await unlikeTrack({ token: session.accessToken, trackId: item.spotify_track_id });
      } else {
        await likeTrack({
          token: session.accessToken,
          trackId: item.spotify_track_id || "__resolve__",
          payload: {
            track_name: item.track_name,
            artist_name: item.artist_name,
            album_name: item.album_name,
            artwork_url: item.artwork_url,
          },
        });
      }
    } catch (_err) {
      // Revert on error
      setRecentScrobbles((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, is_liked: wasLiked } : s))
      );
      if (nowPlaying && nowPlaying.track_name === item.track_name) {
        setNowPlaying((prev) => (prev ? { ...prev, is_liked: wasLiked } : prev));
      }
    }
  };

  if (!session?.accessToken) {
    return (
      <div className="timeline-today-page">
        <div className="timeline-empty-notice">
          <h2>Welcome to Timeline</h2>
          <p>
            Connect Spotify from the <Link to="/connect">connection page</Link> to view your live
            listening timeline.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="timeline-today-page">
        <div className="timeline-loading-state" aria-live="polite">
          Loading today&apos;s timeline...
        </div>
      </div>
    );
  }

  const { todayScrobbles, subtitle } = computeTodayStats(recentScrobbles);
  const headerDate = formatTodayHeaderDate();

  return (
    <div className="timeline-today-page">
      <div className="timeline-today-container">
        <header className="timeline-today-header">
          <h1 className="timeline-today-title">{headerDate}</h1>
          <p className="timeline-today-subtitle">{subtitle}</p>
        </header>

        <TimelineHourlyChart scrobbles={todayScrobbles} />

        <div className="timeline-rail-section">
          <TimelineRail
            scrobbles={todayScrobbles}
            nowPlaying={nowPlaying}
            onToggleLike={handleToggleLike}
          />
        </div>
      </div>
    </div>
  );
}
