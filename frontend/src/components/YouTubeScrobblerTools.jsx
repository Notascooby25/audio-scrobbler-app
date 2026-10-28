import { useEffect, useState } from "react";
import { readSession } from "../session";

function formatSeconds(seconds) {
  if (seconds == null) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getLocalDefaultDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

async function parseResponse(response, fallbackMsg) {
  let data;
  try {
    data = await response.json();
  } catch {
    let errText = "";
    try {
      if (typeof response.text === "function") {
        errText = await response.text();
      }
    } catch {
      // ignore
    }
    throw new Error(errText || `${fallbackMsg} (status ${response.status || "unknown"})`);
  }

  if (!response.ok) {
    throw new Error(data?.detail || fallbackMsg);
  }
  return data;
}

export default function YouTubeScrobblerTools() {
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [selectedSegments, setSelectedSegments] = useState(new Set());
  const [listenedAt, setListenedAt] = useState(getLocalDefaultDateTime);

  // Followed channels state
  const [followedChannels, setFollowedChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [channelVideos, setChannelVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [channelInput, setChannelInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Spotify Playlist Export State
  const [showPlaylistExport, setShowPlaylistExport] = useState(false);
  const [playlistMode, setPlaylistMode] = useState("create"); // 'create' | 'existing'
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [existingPlaylistId, setExistingPlaylistId] = useState("");
  const [exportingPlaylist, setExportingPlaylist] = useState(false);
  const [playlistResult, setPlaylistResult] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scrobbleResult, setScrobbleResult] = useState(null);

  const fetchFollowedChannels = async () => {
    setLoadingChannels(true);
    try {
      const session = readSession();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
      const response = await fetch(`${API_BASE_URL}/tools/youtube/followed-channels`, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      const data = await parseResponse(response, "Failed to fetch followed channels");
      setFollowedChannels(data.channels || []);
    } catch (err) {
      console.error("Error fetching followed channels:", err);
      setFollowedChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    fetchFollowedChannels();
  }, []);

  // When a channel is selected, fetch its recent videos
  useEffect(() => {
    if (!selectedChannelId) {
      setChannelVideos([]);
      setSelectedVideoId("");
      return;
    }

    const fetchVideos = async () => {
      setLoadingVideos(true);
      try {
        const session = readSession();
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
        const response = await fetch(
          `${API_BASE_URL}/tools/youtube/followed-channels/${selectedChannelId}/videos`,
          {
            headers: {
              Authorization: `Bearer ${session?.accessToken}`,
            },
          }
        );
        const data = await parseResponse(response, "Failed to fetch channel videos");
        const vids = data.videos || [];
        setChannelVideos(vids);
        if (vids.length > 0) {
          setSelectedVideoId(vids[0].video_id);
        } else {
          setSelectedVideoId("");
        }
      } catch (err) {
        console.error("Error fetching channel videos:", err);
        setChannelVideos([]);
        setSelectedVideoId("");
      } finally {
        setLoadingVideos(false);
      }
    };

    fetchVideos();
  }, [selectedChannelId]);

  const handleFollowChannel = async (targetInput) => {
    const raw = (targetInput || channelInput).trim();
    if (!raw) return;
    setActionLoading(true);
    setError(null);
    try {
      const session = readSession();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
      const response = await fetch(`${API_BASE_URL}/tools/youtube/followed-channels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ url_or_handle: raw }),
      });
      const newChan = await parseResponse(response, "Failed to follow channel");
      await fetchFollowedChannels();
      setSelectedChannelId(newChan.channel_id);
      setShowAddChannel(false);
      setChannelInput("");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollowChannel = async (channelId) => {
    setActionLoading(true);
    setError(null);
    try {
      const session = readSession();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
      const response = await fetch(`${API_BASE_URL}/tools/youtube/followed-channels/${channelId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      await parseResponse(response, "Failed to unfollow channel");
      if (selectedChannelId === channelId) {
        setSelectedChannelId("");
        setChannelVideos([]);
        setSelectedVideoId("");
      }
      await fetchFollowedChannels();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const session = readSession();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
      const selectedChan = followedChannels.find((c) => c.channel_id === selectedChannelId);
      const chanParam = selectedChan ? `&channel=${encodeURIComponent(selectedChan.title)}` : "";
      const response = await fetch(
        `${API_BASE_URL}/tools/youtube/search?q=${encodeURIComponent(q)}${chanParam}`,
        {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        }
      );
      const data = await parseResponse(response, "Failed to search YouTube videos");
      setSearchResults(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleFetch = async (e, overrideUrl = null) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const targetUrl = (overrideUrl || url).trim();
    if (!targetUrl) return;
    if (overrideUrl) {
      setUrl(overrideUrl);
    }

    setFetching(true);
    setError(null);
    setVideoData(null);
    setScrobbleResult(null);
    setPlaylistResult(null);

    try {
      const session = readSession();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
      const response = await fetch(`${API_BASE_URL}/tools/youtube/fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await parseResponse(response, "Failed to load YouTube video");

      setVideoData(data);
      setTracks(data.tracks || []);
      setNewPlaylistTitle(data.title || "YouTube Live Performance");
      setSelectedSegments(new Set((data.tracks || []).map((t) => t.segment_id)));
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleTrackChange = (segmentId, field, value) => {
    setTracks((prev) =>
      prev.map((t) => (t.segment_id === segmentId ? { ...t, [field]: value } : t))
    );
  };

  const toggleSelectTrack = (segmentId) => {
    setSelectedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSegments(new Set(tracks.map((t) => t.segment_id)));
  };

  const deselectAll = () => {
    setSelectedSegments(new Set());
  };

  const handleScrobble = async () => {
    if (!videoData) return;
    const chosenTracks = tracks.filter((t) => selectedSegments.has(t.segment_id));
    if (chosenTracks.length === 0) {
      setError("Please select at least one track to scrobble.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setScrobbleResult(null);

    try {
      const session = readSession();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
      const payload = {
        video_id: videoData.video_id,
        listened_at: listenedAt ? new Date(listenedAt).toISOString() : new Date().toISOString(),
        tracks: chosenTracks.map((t) => ({
          segment_id: t.segment_id,
          artist: t.artist,
          title: t.title,
          offset_seconds: t.offset_seconds || 0,
          duration_seconds: t.duration_seconds || null,
          spotify_uri: t.spotify_uri || null,
          artwork_url: t.image_url || videoData.thumbnail_url || null,
        })),
      };

      const response = await fetch(`${API_BASE_URL}/tools/youtube/scrobble`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await parseResponse(response, "Failed to scrobble tracks");
      setScrobbleResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportPlaylist = async () => {
    if (!videoData) return;
    const chosenTracks = tracks.filter((t) => selectedSegments.has(t.segment_id));
    if (chosenTracks.length === 0) return;

    setExportingPlaylist(true);
    setError(null);
    setPlaylistResult(null);

    try {
      const session = readSession();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

      // Filter tracks with existing Spotify URIs or use search
      const spotifyUris = chosenTracks.map((t) => t.spotify_uri).filter(Boolean);
      if (spotifyUris.length === 0) {
        throw new Error("None of the selected tracks currently have matched Spotify URIs.");
      }

      const response = await fetch(`${API_BASE_URL}/tools/scope-creep/playlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({
          url: videoData.url,
          title: newPlaylistTitle.trim() || videoData.title,
          mode: playlistMode,
          playlist_id: playlistMode === "existing" ? existingPlaylistId : null,
          spotify_uris: spotifyUris,
        }),
      });
      const res = await parseResponse(response, "Failed to export to Spotify playlist");
      setPlaylistResult(res);
      setShowPlaylistExport(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setExportingPlaylist(false);
    }
  };

  const recommendedDefaults = [
    { title: "NPR Music", handle: "@nprmusic" },
    { title: "KEXP", handle: "@kexp" },
    { title: "BBC Music", handle: "@BBCMusic" },
  ];

  return (
    <div className="youtube-scrobbler-tools" style={{ maxWidth: "100%", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", margin: "0 0 0.25rem 0", fontWeight: 600 }}>
          YouTube Music & Concert Scrobbler
        </h2>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--color-text-muted, #888888)" }}>
          Extract setlists and scrobble live performances from NPR Tiny Desk, KEXP, BBC Music, and
          full concert videos.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            background: "var(--color-danger-soft)",
            border: "0.5px solid var(--color-danger)",
            borderRadius: "var(--radius-sm, 8px)",
            color: "var(--color-danger)",
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {scrobbleResult && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            background: "var(--color-success-soft)",
            border: "0.5px solid var(--color-success)",
            borderRadius: "var(--radius-sm, 8px)",
            color: "var(--color-success)",
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          ✓ {scrobbleResult.message}
        </div>
      )}

      {playlistResult && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            background: "var(--color-success-soft)",
            border: "0.5px solid var(--color-success)",
            borderRadius: "var(--radius-sm, 8px)",
            color: "var(--color-success)",
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          ✓ {playlistResult.message}{" "}
          {playlistResult.playlist_url && (
            <a
              href={playlistResult.playlist_url}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "var(--color-primary)",
                textDecoration: "underline",
                marginLeft: "0.5rem",
              }}
            >
              Open Spotify Playlist
            </a>
          )}
        </div>
      )}

      {/* ─── SECTION 1: Followed Channels ─── */}
      <section className="youtube-card">
        <div className="youtube-card-header">
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Followed Channels</h3>
            <p
              style={{
                margin: "0.15rem 0 0 0",
                fontSize: "0.8rem",
                color: "var(--color-text-muted)",
              }}
            >
              Select a channel to browse its recent concert uploads.
            </p>
          </div>
          <button
            type="button"
            className="button"
            style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem", borderRadius: "8px" }}
            onClick={() => setShowAddChannel((prev) => !prev)}
          >
            {showAddChannel ? "Cancel" : "+ Add Channel"}
          </button>
        </div>

        {/* Add Channel Form */}
        {showAddChannel && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleFollowChannel();
            }}
            style={{
              padding: "0.75rem",
              background: "var(--color-canvas)",
              borderRadius: "8px",
              border: "0.5px solid var(--color-border)",
              marginBottom: "0.75rem",
            }}
          >
            <div className="youtube-input-group">
              <input
                type="text"
                placeholder="Channel handle (e.g. @nprmusic) or YouTube channel URL"
                className="form-input"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                style={{ flex: 1, minWidth: 0, fontSize: "0.85rem" }}
                disabled={actionLoading}
              />
              <button
                type="submit"
                className="button button-primary"
                style={{
                  fontSize: "0.85rem",
                  padding: "0.45rem 1rem",
                  borderRadius: "8px",
                  flexShrink: 0,
                }}
                disabled={!channelInput.trim() || actionLoading}
              >
                {actionLoading ? "Adding..." : "Follow"}
              </button>
            </div>
          </form>
        )}

        {/* Quick Follow Default Suggestions */}
        {followedChannels.length === 0 && !loadingChannels && (
          <div style={{ marginBottom: "0.75rem" }}>
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--color-text-muted)",
                marginRight: "0.5rem",
              }}
            >
              Suggested channels:
            </span>
            <div
              style={{
                display: "inline-flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginTop: "0.25rem",
              }}
            >
              {recommendedDefaults.map((rec) => (
                <button
                  key={rec.handle}
                  type="button"
                  className="button"
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", borderRadius: "6px" }}
                  onClick={() => handleFollowChannel(rec.handle)}
                  disabled={actionLoading}
                >
                  + {rec.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Channel Pills */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {followedChannels.map((c) => {
            const isActive = selectedChannelId === c.channel_id;
            return (
              <div
                key={c.channel_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: isActive ? "var(--color-accent-soft)" : "var(--color-surface)",
                  border: isActive
                    ? "1px solid var(--color-primary)"
                    : "0.5px solid var(--color-border)",
                  borderRadius: "8px",
                  padding: "0.35rem 0.6rem",
                  gap: "0.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedChannelId(isActive ? "" : c.channel_id)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    color: "inherit",
                  }}
                >
                  {c.image_url && (
                    <img
                      src={c.image_url}
                      alt={c.title}
                      loading="lazy"
                      decoding="async"
                      style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }}
                    />
                  )}
                  <span style={{ fontSize: "0.85rem", fontWeight: isActive ? 600 : 400 }}>
                    {c.title}
                  </span>
                </button>
                <button
                  type="button"
                  className="youtube-unfollow-btn"
                  title={`Unfollow ${c.title}`}
                  aria-label={`Unfollow ${c.title}`}
                  onClick={() => handleUnfollowChannel(c.channel_id)}
                  disabled={actionLoading}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Selected Channel Videos Picker & Channel Search */}
        {selectedChannelId && (
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "0.75rem",
              borderTop: "0.5px solid var(--color-border)",
            }}
          >
            <div style={{ marginBottom: "0.75rem" }}>
              <label
                htmlFor="channel-video-select"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  marginBottom: "0.25rem",
                }}
              >
                Recent Concert Uploads
              </label>
              <div className="youtube-input-group">
                <select
                  id="channel-video-select"
                  className="form-input"
                  value={selectedVideoId}
                  onChange={(e) => setSelectedVideoId(e.target.value)}
                  style={{ flex: 1, minWidth: 0, fontSize: "0.85rem" }}
                  disabled={loadingVideos}
                >
                  {loadingVideos ? (
                    <option value="">Loading recent uploads...</option>
                  ) : channelVideos.length === 0 ? (
                    <option value="">No recent uploads found</option>
                  ) : (
                    channelVideos.map((v) => (
                      <option key={v.video_id} value={v.video_id}>
                        {v.title}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className="button button-primary"
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.45rem 1rem",
                    borderRadius: "8px",
                    flexShrink: 0,
                  }}
                  onClick={() => {
                    if (selectedVideoId) {
                      handleFetch(null, `https://www.youtube.com/watch?v=${selectedVideoId}`);
                    }
                  }}
                  disabled={!selectedVideoId || fetching}
                >
                  {fetching ? "Loading Setlist..." : "Load Video"}
                </button>
              </div>
            </div>

            {/* Search within Channel */}
            <form onSubmit={handleSearch} className="youtube-input-group">
              <input
                type="text"
                placeholder="Search artist or concert in this channel..."
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: 0, fontSize: "0.85rem" }}
              />
              <button
                type="submit"
                className="button"
                style={{
                  fontSize: "0.85rem",
                  padding: "0.45rem 1rem",
                  borderRadius: "8px",
                  flexShrink: 0,
                }}
                disabled={!searchQuery.trim() || searching}
              >
                {searching ? "Searching..." : "Search Channel"}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div
                style={{
                  marginTop: "0.75rem",
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: "0.5px solid var(--color-border)",
                  borderRadius: "8px",
                }}
              >
                {searchResults.map((sr) => (
                  <div
                    key={sr.video_id}
                    onClick={() => handleFetch(null, sr.url)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      cursor: "pointer",
                      borderBottom: "0.5px solid var(--color-border)",
                    }}
                  >
                    {sr.thumbnail_url && (
                      <img
                        src={sr.thumbnail_url}
                        alt={sr.title}
                        loading="lazy"
                        decoding="async"
                        style={{ width: 48, height: 27, objectFit: "cover", borderRadius: "4px" }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sr.title}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                        {sr.channel_title} {sr.duration ? `• ${sr.duration}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button"
                      style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "6px" }}
                    >
                      Extract Setlist
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── SECTION 2: Direct Video URL Input ─── */}
      <section className="youtube-card">
        <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 600 }}>
          Video & Concert Extraction
        </h3>
        <p
          style={{
            margin: "0 0 0.75rem 0",
            fontSize: "0.85rem",
            color: "var(--color-text-muted)",
          }}
        >
          Paste any YouTube concert or live video URL directly to extract its setlist.
        </p>

        <form onSubmit={handleFetch}>
          <div className="youtube-input-group">
            <label htmlFor="youtube-video-url" className="sr-only">
              YouTube Video URL
            </label>
            <input
              id="youtube-video-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              className="form-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ flex: 1, minWidth: 0, fontSize: "0.85rem" }}
              disabled={fetching}
            />
            <button
              type="submit"
              className="button button-primary"
              style={{
                fontSize: "0.85rem",
                padding: "0.45rem 1.1rem",
                borderRadius: "8px",
                flexShrink: 0,
              }}
              disabled={!url.trim() || fetching}
            >
              {fetching ? "Extracting..." : "Load Video & Setlist"}
            </button>
          </div>
        </form>
      </section>

      {/* ─── SECTION 3: Extracted Video & Setlist ─── */}
      {videoData && (
        <section className="youtube-card">
          {/* Video Header Card */}
          <div className="youtube-video-header">
            {videoData.thumbnail_url && (
              <img
                src={videoData.thumbnail_url}
                alt={videoData.title}
                loading="lazy"
                decoding="async"
                className="youtube-video-thumb"
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.05rem", fontWeight: 600 }}>
                {videoData.title}
              </h4>
              <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                <span>{videoData.author}</span>
                {videoData.duration_seconds && (
                  <span> • {formatSeconds(videoData.duration_seconds)}</span>
                )}
                <a
                  href={videoData.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    marginLeft: "0.5rem",
                    color: "var(--color-primary)",
                    textDecoration: "none",
                  }}
                >
                  ↗ View on YouTube
                </a>
              </div>
            </div>
          </div>

          {/* Tracklist Table */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <h5 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
              Extracted Tracks ({tracks.length})
            </h5>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="button"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                onClick={selectAll}
              >
                Select All
              </button>
              <button
                type="button"
                className="button"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                onClick={deselectAll}
              >
                Deselect All
              </button>
            </div>
          </div>

          {tracks.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              No tracks could be automatically extracted from this video.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              {tracks.map((track, idx) => {
                const isSelected = selectedSegments.has(track.segment_id);
                return (
                  <div
                    key={track.segment_id}
                    className={`youtube-track-row ${isSelected ? "" : "is-unselected"}`}
                  >
                    <label className="youtube-checkbox-wrapper">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectTrack(track.segment_id)}
                        aria-label={`Select track ${track.title}`}
                      />
                    </label>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-text-muted)",
                        width: "1.2rem",
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}.
                    </span>

                    {/* Artwork thumbnail */}
                    {track.image_url ? (
                      <img
                        src={track.image_url}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "4px",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "4px",
                          background: "var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.7rem",
                          flexShrink: 0,
                        }}
                      >
                        🎵
                      </div>
                    )}

                    {/* Duration / Offset badge */}
                    <div className="youtube-track-duration">
                      {formatSeconds(track.offset_seconds)}
                      {track.duration_seconds ? ` (${formatSeconds(track.duration_seconds)})` : ""}
                    </div>

                    {/* Editable Title & Artist */}
                    <div className="youtube-track-inputs">
                      <input
                        type="text"
                        className="form-input youtube-track-title-input"
                        value={track.title}
                        onChange={(e) =>
                          handleTrackChange(track.segment_id, "title", e.target.value)
                        }
                        placeholder="Track title"
                        aria-label={`Track ${idx + 1} title`}
                      />
                      <input
                        type="text"
                        className="form-input youtube-track-artist-input"
                        value={track.artist}
                        onChange={(e) =>
                          handleTrackChange(track.segment_id, "artist", e.target.value)
                        }
                        placeholder="Artist"
                        aria-label={`Track ${idx + 1} artist`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Bar */}
          <div className="youtube-action-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <label htmlFor="yt-listened-at" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                Listened At:
              </label>
              <input
                id="yt-listened-at"
                type="datetime-local"
                className="form-input"
                value={listenedAt}
                onChange={(e) => setListenedAt(e.target.value)}
                style={{ fontSize: "0.85rem", padding: "0.35rem 0.6rem" }}
              />
            </div>

            <div className="youtube-action-buttons">
              <button
                type="button"
                className="button button-primary"
                style={{ fontSize: "0.85rem", padding: "0.5rem 1.25rem", borderRadius: "8px" }}
                onClick={handleScrobble}
                disabled={selectedSegments.size === 0 || actionLoading}
              >
                {actionLoading ? "Scrobbling..." : `Scrobble ${selectedSegments.size} Tracks`}
              </button>

              <button
                type="button"
                className="button"
                style={{ fontSize: "0.85rem", padding: "0.5rem 1rem", borderRadius: "8px" }}
                onClick={() => setShowPlaylistExport((prev) => !prev)}
                disabled={selectedSegments.size === 0}
              >
                Export to Spotify Playlist
              </button>
            </div>
          </div>

          {/* Spotify Playlist Export Drawer/Modal */}
          {showPlaylistExport && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "var(--color-canvas)",
                border: "0.5px solid var(--color-border)",
                borderRadius: "8px",
              }}
            >
              <h5 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 600 }}>
                Export Setlist to Spotify
              </h5>
              <div
                style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}
              >
                <label
                  style={{
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="radio"
                    name="ytPlaylistMode"
                    value="create"
                    checked={playlistMode === "create"}
                    onChange={() => setPlaylistMode("create")}
                    style={{ marginRight: "0.4rem" }}
                  />
                  Create New Playlist
                </label>
                <label
                  style={{
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="radio"
                    name="ytPlaylistMode"
                    value="existing"
                    checked={playlistMode === "existing"}
                    onChange={() => setPlaylistMode("existing")}
                    style={{ marginRight: "0.4rem" }}
                  />
                  Add to Existing Playlist
                </label>
              </div>

              {playlistMode === "create" ? (
                <div className="youtube-input-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Playlist Title"
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    style={{ flex: 1, minWidth: 0, fontSize: "0.85rem" }}
                  />
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleExportPlaylist}
                    disabled={exportingPlaylist}
                    style={{
                      fontSize: "0.85rem",
                      padding: "0.45rem 1rem",
                      borderRadius: "8px",
                      flexShrink: 0,
                    }}
                  >
                    {exportingPlaylist ? "Exporting..." : "Create Playlist"}
                  </button>
                </div>
              ) : (
                <div className="youtube-input-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter Spotify Playlist ID or URL"
                    value={existingPlaylistId}
                    onChange={(e) => setExistingPlaylistId(e.target.value)}
                    style={{ flex: 1, minWidth: 0, fontSize: "0.85rem" }}
                  />
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleExportPlaylist}
                    disabled={exportingPlaylist || !existingPlaylistId.trim()}
                    style={{
                      fontSize: "0.85rem",
                      padding: "0.45rem 1rem",
                      borderRadius: "8px",
                      flexShrink: 0,
                    }}
                  >
                    {exportingPlaylist ? "Adding..." : "Add to Playlist"}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
