import React, { useEffect, useRef, useState } from "react";
import { fetchActiveRecommendations, updateRecommendationStatus } from "../../api";

const MAX_ROWS = 4;

function buildSpotifyUrl(rec) {
  if (rec.spotify_url) return rec.spotify_url;
  if (rec.spotify_uri) {
    const parts = rec.spotify_uri.split(":");
    const spotifyId = parts.pop();
    const type =
      parts.pop() ||
      (rec.item_type === "album" ? "album" : rec.item_type === "artist" ? "artist" : "track");
    return `https://open.spotify.com/${type}/${spotifyId}`;
  }
  const query =
    rec.item_type === "artist"
      ? rec.artist_name || rec.title
      : `${rec.artist_name || ""} ${rec.title}`.trim();
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

function senderOf(rec) {
  return rec.sender_name || "A friend";
}

function metaOf(rec) {
  if (rec.item_type === "artist") return "Artist";
  const kind = rec.item_type === "album" ? "Album" : "Song";
  const base = rec.artist_name ? `${kind} by ${rec.artist_name}` : kind;
  const album = rec.album_name && rec.album_name !== rec.title ? ` · ${rec.album_name}` : "";
  return rec.item_type === "album" ? base : `${base}${album}`;
}

function Art({ rec }) {
  if (rec.image_url) {
    return <img className="friend-recs__art" src={rec.image_url} alt="" loading="lazy" />;
  }
  return (
    <div className="friend-recs__art" aria-hidden="true">
      {(rec.title || "?").charAt(0).toUpperCase()}
    </div>
  );
}

export default function FriendRecommendationsCard({ token }) {
  const [recommendations, setRecommendations] = useState([]);
  const [featuredId, setFeaturedId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const busyRef = useRef(new Set());
  const titleRef = useRef(null);
  const focusAfterPromote = useRef(false);

  useEffect(() => {
    if (!token) return;
    fetchActiveRecommendations({ token })
      .then((data) => {
        setRecommendations(data || []);
        setFeaturedId(null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (focusAfterPromote.current) {
      focusAfterPromote.current = false;
      titleRef.current?.focus();
    }
  }, [featuredId]);

  if (loading || !recommendations || recommendations.length === 0) {
    return null;
  }

  const featured = recommendations.find((r) => r.id === featuredId) || recommendations[0];
  const others = recommendations.filter((r) => r.id !== featured.id);
  const visibleRows = showAll ? others : others.slice(0, MAX_ROWS);
  const hiddenCount = others.length - MAX_ROWS;

  const promote = (id) => {
    focusAfterPromote.current = true;
    setFeaturedId(id);
  };

  const settle = async (rec, status, beforeSave) => {
    if (busyRef.current.has(rec.id)) return;
    busyRef.current.add(rec.id);
    setBusyIds(new Set(busyRef.current));
    if (beforeSave) beforeSave();
    try {
      await updateRecommendationStatus({ token, recommendationId: rec.id, status });
      setRecommendations((prev) => prev.filter((r) => r.id !== rec.id));
      setFeaturedId((prev) => (prev === rec.id ? null : prev));
    } catch {
      // Keep the pick so it is not lost; the next load will show it again.
    } finally {
      busyRef.current.delete(rec.id);
      setBusyIds(new Set(busyRef.current));
    }
  };

  const play = (rec) =>
    settle(rec, "listened", () => {
      window.open(buildSpotifyUrl(rec), "_blank", "noopener,noreferrer");
    });

  const dismiss = (rec) => settle(rec, "dismissed");

  const openVerb = (rec) => (rec.item_type === "artist" ? "Open" : "Play");

  return (
    <section className="friend-recs" aria-labelledby="friend-recs-heading">
      <div className="friend-recs__head">
        <h2 className="friend-recs__title" id="friend-recs-heading">
          Recommendations
        </h2>
        <span className="friend-recs__count">{recommendations.length} new</span>
      </div>

      <div className="friend-recs__featured">
        <Art rec={featured} />
        <div>
          <div className="friend-recs__who">
            <span className="friend-recs__avatar" aria-hidden="true">
              {senderOf(featured).charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>{senderOf(featured)}</strong> recommends
            </span>
          </div>
          <p className="friend-recs__item-title" tabIndex={-1} ref={titleRef}>
            {featured.title}
          </p>
          <p className="friend-recs__meta">{metaOf(featured)}</p>
          {featured.note && <p className="friend-recs__note">&ldquo;{featured.note}&rdquo;</p>}
          <div className="friend-recs__actions">
            <button
              type="button"
              className="friend-recs__btn friend-recs__btn--primary"
              disabled={busyIds.has(featured.id)}
              onClick={() => play(featured)}
            >
              {openVerb(featured) === "Open" ? "Open on Spotify" : "Play on Spotify"}
            </button>
            <button
              type="button"
              className="friend-recs__btn friend-recs__btn--quiet"
              disabled={busyIds.has(featured.id)}
              onClick={() => dismiss(featured)}
            >
              Not for me
            </button>
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <div className="friend-recs__rest">
          <h3 className="friend-recs__rest-label">Also waiting for you</h3>
          <ul className="friend-recs__list">
            {visibleRows.map((rec) => (
              <li className="friend-recs__row" key={rec.id}>
                <Art rec={rec} />
                <button
                  type="button"
                  className="friend-recs__row-main"
                  aria-label={`Show ${senderOf(rec)}'s recommendation: ${rec.title}`}
                  onClick={() => promote(rec.id)}
                >
                  <span className="friend-recs__row-meta">
                    <strong>{senderOf(rec)}</strong> recommends
                  </span>
                  <span className="friend-recs__row-title">{rec.title}</span>
                  <span className="friend-recs__row-meta">{rec.artist_name}</span>
                </button>
                <div className="friend-recs__row-actions">
                  <button
                    type="button"
                    className="friend-recs__btn friend-recs__btn--outline"
                    aria-label={`${openVerb(rec)} ${rec.title} on Spotify`}
                    disabled={busyIds.has(rec.id)}
                    onClick={() => play(rec)}
                  >
                    {openVerb(rec)}
                  </button>
                  <button
                    type="button"
                    className="friend-recs__btn friend-recs__btn--quiet"
                    aria-label={`Not for me: ${rec.title}`}
                    disabled={busyIds.has(rec.id)}
                    onClick={() => dismiss(rec)}
                  >
                    Not for me
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button
              type="button"
              className="friend-recs__more"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
