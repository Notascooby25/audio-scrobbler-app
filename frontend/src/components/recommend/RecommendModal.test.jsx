import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import RecommendModal from "./RecommendModal";
import * as api from "../../api";

afterEach(() => cleanup());

describe("RecommendModal", () => {
  const item = {
    itemType: "track",
    title: "Glasgow",
    artist: "The Snuts",
    album: "W.L.",
    imageUrl: "https://example.com/art.jpg",
    spotifyUri: "spotify:track:12345",
  };

  it("loads following list and sends recommendation", async () => {
    vi.spyOn(api, "fetchFollowing").mockResolvedValue({
      results: [
        { id: 2, display_name: "Bob", username: "bob" },
        { id: 3, display_name: "Charlie", username: "charlie" },
      ],
    });
    const sendSpy = vi.spyOn(api, "sendRecommendation").mockResolvedValue({ id: 10 });
    const onClose = vi.fn();

    render(<RecommendModal token="test-token" item={item} onClose={onClose} />);

    expect(screen.getByText(/Recommend to a Friend/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    // Select Bob
    fireEvent.click(screen.getByText("Bob"));

    // Add optional note
    const textarea = screen.getByPlaceholderText(/Add a note/i);
    fireEvent.change(textarea, { target: { value: "Listen to track 3!" } });

    // Click Send
    const sendBtn = screen.getByRole("button", { name: /Send Recommendation/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith({
        token: "test-token",
        payload: {
          receiver_id: 2,
          item_type: "track",
          title: "Glasgow",
          artist_name: "The Snuts",
          album_name: "W.L.",
          image_url: "https://example.com/art.jpg",
          spotify_uri: "spotify:track:12345",
          spotify_url: null,
          note: "Listen to track 3!",
        },
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("displays error message if sending recommendation fails", async () => {
    vi.spyOn(api, "fetchFollowing").mockResolvedValue({
      results: [{ id: 2, display_name: "Bob", username: "bob" }],
    });
    vi.spyOn(api, "sendRecommendation").mockRejectedValue(
      new Error("You can only recommend music to users you follow")
    );
    const onClose = vi.fn();

    render(<RecommendModal token="test-token" item={item} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Bob"));
    fireEvent.click(screen.getByRole("button", { name: /Send Recommendation/i }));

    await waitFor(() => {
      expect(
        screen.getByText("You can only recommend music to users you follow")
      ).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
