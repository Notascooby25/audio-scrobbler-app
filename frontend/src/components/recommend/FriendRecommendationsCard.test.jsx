import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import FriendRecommendationsCard from "./FriendRecommendationsCard";
import * as api from "../../api";

afterEach(() => cleanup());

describe("FriendRecommendationsCard", () => {
  const recommendations = [
    {
      id: 1,
      sender_name: "Alice",
      item_type: "track",
      title: "Glasgow",
      artist_name: "The Snuts",
      note: "Brilliant track!",
      image_url: "https://example.com/art.jpg",
      spotify_uri: "spotify:track:123",
      spotify_url: "https://open.spotify.com/track/123",
      status: "pending",
    },
    {
      id: 2,
      sender_name: "Bob",
      item_type: "album",
      title: "W.L.",
      artist_name: "The Snuts",
      note: null,
      spotify_url: "https://open.spotify.com/album/456",
      status: "pending",
    },
  ];

  it("renders null when there are no recommendations", async () => {
    vi.spyOn(api, "fetchActiveRecommendations").mockResolvedValue([]);
    const { container } = render(<FriendRecommendationsCard token="test-token" />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders recommendation item and handles Play on Spotify click", async () => {
    vi.spyOn(api, "fetchActiveRecommendations").mockResolvedValue(recommendations);
    const updateSpy = vi.spyOn(api, "updateRecommendationStatus").mockResolvedValue({ id: 1, status: "listened" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => {});

    render(<FriendRecommendationsCard token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText(/Recommended by Friends/i)).toBeInTheDocument();
      expect(screen.getByText("Glasgow")).toBeInTheDocument();
      expect(screen.getByText(/Alice recommended/i)).toBeInTheDocument();
      expect(screen.getByText(/Brilliant track!/i)).toBeInTheDocument();
    });

    // Pager shows 1 of 2
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    // Click Play on Spotify
    const playBtn = screen.getByRole("button", { name: /Play on Spotify/i });
    fireEvent.click(playBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        token: "test-token",
        recommendationId: 1,
        status: "listened",
      });
      expect(openSpy).toHaveBeenCalled();
    });

    openSpy.mockRestore();
  });

  it("handles dismiss click", async () => {
    vi.spyOn(api, "fetchActiveRecommendations").mockResolvedValue([recommendations[0]]);
    const updateSpy = vi.spyOn(api, "updateRecommendationStatus").mockResolvedValue({ id: 1, status: "dismissed" });

    render(<FriendRecommendationsCard token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText("Glasgow")).toBeInTheDocument();
    });

    const dismissBtn = screen.getByRole("button", { name: /Dismiss recommendation/i });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        token: "test-token",
        recommendationId: 1,
        status: "dismissed",
      });
    });
  });
});
