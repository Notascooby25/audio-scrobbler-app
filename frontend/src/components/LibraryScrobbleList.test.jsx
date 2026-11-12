import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibraryScrobbleList from "./LibraryScrobbleList";

describe("LibraryScrobbleList", () => {
  afterEach(() => cleanup());

  it("groups rows by date and preserves source badges", () => {
    render(
      <LibraryScrobbleList
        token="token"
        view="list"
        scrobbles={[
          {
            id: 1,
            track_name: "Video Games",
            artist_name: "Lana Del Rey",
            source: "spotify",
            played_at: new Date().toISOString(),
            spotify_track_id: "track-1",
          },
          {
            id: 2,
            track_name: "Daylight",
            artist_name: "Matt Berninger",
            source: "youtube",
            played_at: new Date().toISOString(),
            spotify_track_id: null,
          },
        ]}
      />
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("spotify")).toBeInTheDocument();
    expect(screen.getByText("youtube")).toBeInTheDocument();
  });

  it("shows a heart on every track, filled red only when liked", () => {
    render(
      <LibraryScrobbleList
        token="token"
        view="list"
        scrobbles={[
          {
            id: 1,
            track_name: "Video Games",
            artist_name: "Lana Del Rey",
            source: "spotify",
            played_at: new Date().toISOString(),
            spotify_track_id: "track-1",
            is_liked: true,
          },
          {
            id: 2,
            track_name: "Daylight",
            artist_name: "Matt Berninger",
            source: "youtube",
            played_at: new Date().toISOString(),
            spotify_track_id: null,
            is_liked: false,
          },
        ]}
      />
    );

    expect(screen.getAllByTitle("Liked on Spotify")).toHaveLength(1);
    expect(screen.getAllByTitle("Not liked on Spotify")).toHaveLength(1);
  });

  it("renders interactive heart button and calls onToggleLike when isOwnLibrary is true", () => {
    const onToggleLike = vi.fn();
    const scrobble = {
      id: 1,
      track_name: "Video Games",
      artist_name: "Lana Del Rey",
      source: "spotify",
      played_at: new Date().toISOString(),
      spotify_track_id: "track-1",
      is_liked: false,
    };
    render(
      <LibraryScrobbleList
        token="token"
        view="list"
        isOwnLibrary={true}
        onToggleLike={onToggleLike}
        scrobbles={[scrobble]}
      />
    );

    const btn = screen.getByRole("button", { name: "Like on Spotify" });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onToggleLike).toHaveBeenCalledWith(scrobble, "scrobble");
  });

  it("renders read-only badge span when isOwnLibrary is false", () => {
    render(
      <LibraryScrobbleList
        token="token"
        view="list"
        isOwnLibrary={false}
        scrobbles={[
          {
            id: 1,
            track_name: "Video Games",
            artist_name: "Lana Del Rey",
            source: "spotify",
            played_at: new Date().toISOString(),
            spotify_track_id: "track-1",
            is_liked: true,
          },
        ]}
      />
    );

    expect(screen.queryByRole("button", { name: "Like on Spotify" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlike on Spotify" })).not.toBeInTheDocument();
    expect(screen.getByTitle("Liked on Spotify")).toBeInTheDocument();
  });

  it("gates checkboxes behind selectMode in scrobble list", () => {
    const onToggleSelection = vi.fn();
    const { rerender } = render(
      <LibraryScrobbleList
        token="token"
        view="list"
        onToggleSelection={onToggleSelection}
        selectMode={false}
        scrobbles={[
          {
            id: 1,
            track_name: "Video Games",
            artist_name: "Lana Del Rey",
            source: "spotify",
            played_at: new Date().toISOString(),
          },
        ]}
      />
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    rerender(
      <LibraryScrobbleList
        token="token"
        view="list"
        onToggleSelection={onToggleSelection}
        selectMode={true}
        scrobbles={[
          {
            id: 1,
            track_name: "Video Games",
            artist_name: "Lana Del Rey",
            source: "spotify",
            played_at: new Date().toISOString(),
          },
        ]}
      />
    );

    expect(screen.getByRole("checkbox", { name: "Select Video Games" })).toBeInTheDocument();
  });
});
