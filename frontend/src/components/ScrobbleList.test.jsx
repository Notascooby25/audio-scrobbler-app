import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ScrobbleList from "./ScrobbleList";

describe("ScrobbleList", () => {
  afterEach(() => cleanup());

  it("renders artwork, track name, artist, and source in one readable row", () => {
    render(
      <ScrobbleList
        scrobbles={[
          {
            id: 1,
            track_name: "Something Heavy",
            artist_name: "Sam Fender",
            source: "youtube",
            artwork_url: "https://example.com/cover.jpg",
          },
        ]}
      />
    );

    expect(screen.getByRole("img", { name: "Something Heavy artwork" })).toHaveAttribute(
      "src",
      "https://example.com/cover.jpg"
    );
    expect(screen.getByText("Something Heavy")).toBeInTheDocument();
    expect(screen.getByText("Sam Fender")).toBeInTheDocument();
    expect(screen.getByText("youtube")).toBeInTheDocument();
  });

  it("renders interactive heart button and triggers onToggleLike", () => {
    const onToggleLike = vi.fn();
    const scrobble = {
      id: 1,
      track_name: "Something Heavy",
      artist_name: "Sam Fender",
      source: "spotify",
      spotify_track_id: "track-1",
      is_liked: false,
    };
    render(<ScrobbleList scrobbles={[scrobble]} interactive={true} onToggleLike={onToggleLike} />);
    const btn = screen.getByRole("button", { name: "Like on Spotify" });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(onToggleLike).toHaveBeenCalledWith(scrobble);
  });
});
