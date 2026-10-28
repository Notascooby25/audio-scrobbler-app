import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import YouTubeScrobblerTools from "./YouTubeScrobblerTools";

describe("YouTubeScrobblerTools", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    localStorage.setItem(
      "audio-scrobbler-session",
      JSON.stringify({ accessToken: "mock-token", userId: 1 })
    );
  });

  it("renders initial YouTube tool interface and channel sections", async () => {
    vi.spyOn(global, "fetch").mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ channels: [] }),
      })
    );

    render(
      <MemoryRouter>
        <YouTubeScrobblerTools />
      </MemoryRouter>
    );

    expect(screen.getByText("YouTube Music & Concert Scrobbler")).toBeInTheDocument();
    expect(screen.getByText("Followed Channels")).toBeInTheDocument();
    expect(screen.getByText("Video & Concert Extraction")).toBeInTheDocument();
    expect(screen.getByLabelText(/YouTube Video URL/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Load Video & Setlist/i })).toBeInTheDocument();
  });

  it("fetches video, allows inline editing and scrobbles tracks", async () => {
    const mockVideoData = {
      video_id: "y38qQRg3UDI",
      title: "Dua Lipa: Tiny Desk Concert",
      author: "NPR Music",
      artist: "Dua Lipa",
      duration_seconds: 1100,
      thumbnail_url: "https://example.com/thumb.jpg",
      url: "https://www.youtube.com/watch?v=y38qQRg3UDI",
      tracks: [
        {
          segment_id: "seg_0",
          artist: "Dua Lipa",
          title: "Training Season",
          offset_seconds: 0,
          duration_seconds: 240,
          spotify_uri: null,
          image_url: "https://example.com/art.jpg",
        },
        {
          segment_id: "seg_1",
          artist: "Dua Lipa",
          title: "These Walls",
          offset_seconds: 240,
          duration_seconds: 240,
          spotify_uri: null,
          image_url: "https://example.com/art.jpg",
        },
      ],
    };

    vi.spyOn(global, "fetch")
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ channels: [] }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVideoData),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              message: "Scrobbled 2 tracks (0 duplicates skipped).",
              scrobbled_count: 2,
              duplicate_count: 0,
            }),
        })
      );

    render(
      <MemoryRouter>
        <YouTubeScrobblerTools />
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/YouTube Video URL/i);
    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=y38qQRg3UDI" } });

    const loadBtn = screen.getByRole("button", { name: /Load Video & Setlist/i });
    fireEvent.click(loadBtn);

    await waitFor(() => {
      expect(screen.getByText("Dua Lipa: Tiny Desk Concert")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Training Season")).toBeInTheDocument();
      expect(screen.getByDisplayValue("These Walls")).toBeInTheDocument();
    });

    // Verify accessible labels on track inputs
    expect(screen.getByLabelText("Track 1 title")).toBeInTheDocument();
    expect(screen.getByLabelText("Track 1 artist")).toBeInTheDocument();
    expect(screen.getByLabelText("Track 2 title")).toBeInTheDocument();
    expect(screen.getByLabelText("Track 2 artist")).toBeInTheDocument();

    // Inline edit track title
    const firstTitleInput = screen.getByDisplayValue("Training Season");
    fireEvent.change(firstTitleInput, { target: { value: "Training Season (Live)" } });
    expect(screen.getByDisplayValue("Training Season (Live)")).toBeInTheDocument();

    // Scrobble
    const scrobbleBtn = screen.getByRole("button", { name: /Scrobble 2 Tracks/i });
    fireEvent.click(scrobbleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Scrobbled 2 tracks/i)).toBeInTheDocument();
    });
  });

  it("renders accessible unfollow button for followed channels", async () => {
    vi.spyOn(global, "fetch").mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            channels: [
              {
                channel_id: "UC_channel1",
                title: "NPR Music",
                handle: "@nprmusic",
                image_url: "https://example.com/npr.jpg",
              },
            ],
          }),
      })
    );

    render(
      <MemoryRouter>
        <YouTubeScrobblerTools />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("NPR Music")).toBeInTheDocument();
    });

    const unfollowBtn = screen.getByRole("button", { name: /Unfollow NPR Music/i });
    expect(unfollowBtn).toBeInTheDocument();
    expect(unfollowBtn).toHaveClass("youtube-unfollow-btn");
  });
});
