import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AnalyticsPage from "../components/AnalyticsPage";
import DateRangeSelector from "../components/DateRangeSelector";
import RankedList from "../components/RankedList";
import RediscoverCard from "../components/RediscoverCard";
import JukeboxCard from "../components/jukebox/JukeboxCard";
import SummaryStatsBar from "../components/SummaryStatsBar";
import {
  fetchStatsChart,
  fetchStatsSummary,
  likeAlbum,
  likeTrack,
  redirectToAuthorization,
  requestSpotifyAuthorization,
  unlikeAlbum,
  unlikeTrack,
} from "../api";
import { createDefaultDateRange, isValidDateRange } from "../dateRange";
import { readSession } from "../session";

export default function OverviewPage() {
  const session = readSession();
  const [dateRange, setDateRange] = useState(createDefaultDateRange());
  const [summary, setSummary] = useState(null);
  const [charts, setCharts] = useState(null);
  const [status, setStatus] = useState(session?.accessToken ? "loading" : "idle");
  const [error, setError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [likingKeys, setLikingKeys] = useState(() => new Set());

  const handleToggleLike = async (item, kind) => {
    if (!session?.accessToken) return;

    const isAlbum = kind === "albums";
    const isTrack = kind === "tracks";

    if (isTrack) {
      const isSpotify = Boolean(
        item.spotify_track_id ||
        (item.sources && item.sources.some((s) => String(s).startsWith("spotify"))) ||
        String(item.source || "").startsWith("spotify")
      );
      if (!isSpotify || !item.spotify_track_id) {
        setActionNotice("Only able to like tracks played through Spotify");
        return;
      }
    } else if (isAlbum) {
      const isSpotify = Boolean(
        item.spotify_album_id ||
        (item.sources && item.sources.some((s) => String(s).startsWith("spotify"))) ||
        String(item.source || "").startsWith("spotify")
      );
      if (!isSpotify) {
        setActionNotice("Only able to like albums played through Spotify");
        return;
      }
    }

    const itemKey = `${kind}:${item.label}:${item.secondary || ""}`;
    setLikingKeys((prev) => new Set(prev).add(itemKey));

    const wasLiked = Boolean(item.is_liked);
    const nextLiked = !wasLiked;

    setCharts((prev) => {
      if (!prev || !prev[kind]) return prev;
      return {
        ...prev,
        [kind]: prev[kind].map((e) =>
          e.label === item.label && e.secondary === item.secondary
            ? { ...e, is_liked: nextLiked }
            : e
        ),
      };
    });

    try {
      if (isAlbum) {
        const albumIdentifier = item.spotify_album_id || item.label;
        if (wasLiked) {
          await unlikeAlbum({ token: session.accessToken, albumId: albumIdentifier });
        } else {
          const res = await likeAlbum({
            token: session.accessToken,
            albumId: albumIdentifier,
            payload: {
              album_name: item.label,
              artist_name: item.secondary || undefined,
              artwork_url: item.artwork_url || undefined,
            },
          });
          if (res?.spotify_album_id) {
            setCharts((prev) => {
              if (!prev || !prev[kind]) return prev;
              return {
                ...prev,
                [kind]: prev[kind].map((e) =>
                  e.label === item.label && e.secondary === item.secondary
                    ? { ...e, spotify_album_id: res.spotify_album_id }
                    : e
                ),
              };
            });
          }
        }
      } else {
        const trackId = item.spotify_track_id;
        if (wasLiked) {
          await unlikeTrack({ token: session.accessToken, trackId });
        } else {
          await likeTrack({
            token: session.accessToken,
            trackId,
            payload: {
              track_name: item.label,
              artist_name: item.secondary || undefined,
              artwork_url: item.artwork_url || undefined,
            },
          });
        }
      }
    } catch (err) {
      setCharts((prev) => {
        if (!prev || !prev[kind]) return prev;
        return {
          ...prev,
          [kind]: prev[kind].map((e) =>
            e.label === item.label && e.secondary === item.secondary
              ? { ...e, is_liked: wasLiked }
              : e
          ),
        };
      });

      if (err?.message?.includes("needs_spotify_reconnect") || err?.status === 403) {
        setActionNotice("needs_spotify_reconnect");
      } else {
        setActionNotice(err?.message || "Failed to update Spotify like.");
      }
    } finally {
      setLikingKeys((prev) => {
        const next = new Set(prev);
        next.delete(itemKey);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!session?.accessToken) return;
    fetchStatsSummary({ token: session.accessToken })
      .then(setSummary)
      .catch((requestError) => {
        setError(requestError.message);
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    if (!isValidDateRange(dateRange)) return;
    setStatus("loading");
    Promise.all([
      fetchStatsChart({ token: session.accessToken, entity: "artists", limit: 10, dateRange }),
      fetchStatsChart({ token: session.accessToken, entity: "albums", limit: 10, dateRange }),
      fetchStatsChart({ token: session.accessToken, entity: "tracks", limit: 10, dateRange }),
    ])
      .then(([artists, albums, tracks]) => {
        setCharts({ artists: artists.entries, albums: albums.entries, tracks: tracks.entries });
        setStatus("ready");
      })
      .catch((requestError) => {
        setError(requestError.message);
        setStatus("error");
      });
  }, [dateRange]);

  return (
    <AnalyticsPage eyebrow="Personal archive" title="Overview">
      {!session?.accessToken && (
        <p className="notice">
          Connect Spotify from the <Link to="/connect">connection page</Link> to see your listening
          overview.
        </p>
      )}
      {status === "loading" && !summary && (
        <p className="notice">Loading your listening overview...</p>
      )}
      {status === "error" && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {summary && (
        <>
          <SummaryStatsBar stats={summary} />
          <RediscoverCard token={session?.accessToken} />
          <JukeboxCard token={session?.accessToken} />
          <DateRangeSelector value={dateRange} onChange={setDateRange} showCompare={false} />
          {actionNotice === "needs_spotify_reconnect" ? (
            <div
              className="notice notice-info"
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <span>Please reconnect Spotify to grant library liking permissions.</span>
              <button
                type="button"
                className="button button-primary"
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                onClick={async () => {
                  try {
                    sessionStorage.setItem(
                      "spotify_auth_return_to",
                      window.location.pathname + window.location.search
                    );
                    const { authorization_url: authUrl } = await requestSpotifyAuthorization(true);
                    redirectToAuthorization(authUrl);
                  } catch (reconnectErr) {
                    setActionNotice(
                      reconnectErr.message || "Failed to start Spotify authorization"
                    );
                  }
                }}
              >
                Reconnect Spotify
              </button>
            </div>
          ) : actionNotice ? (
            <p className="notice notice-info" role="status">
              {actionNotice}
            </p>
          ) : null}
          {charts && (
            <div className="overview-grid">
              <RankedList title="Top artists" entries={charts.artists} kind="artists" />
              <RankedList
                title="Top albums"
                entries={charts.albums}
                kind="albums"
                interactive={true}
                onToggleLike={handleToggleLike}
                likingKeys={likingKeys}
              />
              <RankedList
                title="Top tracks"
                entries={charts.tracks}
                kind="tracks"
                interactive={true}
                onToggleLike={handleToggleLike}
                likingKeys={likingKeys}
              />
            </div>
          )}
          <p className="page-link">
            <Link to="/library">Explore the full library</Link>
          </p>
        </>
      )}
    </AnalyticsPage>
  );
}
