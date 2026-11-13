import React from "react";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import FriendRecommendationsCard from "./FriendRecommendationsCard";
import * as api from "../../api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const alice = {
  id: 1,
  sender_name: "Alice",
  item_type: "track",
  title: "Glasgow",
  artist_name: "The Snuts",
  album_name: "W.L.",
  note: "Brilliant track!",
  image_url: "https://example.com/art.jpg",
  spotify_uri: "spotify:track:123",
  spotify_url: "https://open.spotify.com/track/123",
  status: "pending",
};

const bob = {
  id: 2,
  sender_name: "Bob",
  item_type: "album",
  title: "W.L.",
  artist_name: "The Snuts",
  note: null,
  spotify_url: "https://open.spotify.com/album/456",
  status: "pending",
};

function makePicks(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: 100 + i,
    sender_name: `Friend${i + 1}`,
    item_type: "album",
    title: `Album ${i + 1}`,
    artist_name: `Artist ${i + 1}`,
    note: null,
    spotify_url: `https://open.spotify.com/album/${i + 1}`,
    status: "pending",
  }));
}

async function renderCard(picks) {
  vi.spyOn(api, "fetchActiveRecommendations").mockResolvedValue(picks);
  const view = render(<FriendRecommendationsCard token="test-token" />);
  await waitFor(() => {
    expect(view.container.querySelector(".friend-recs")).not.toBeNull();
  });
  return view;
}

const featured = (container) => container.querySelector(".friend-recs__featured");

describe("FriendRecommendationsCard", () => {
  it("renders null when there are no recommendations", async () => {
    vi.spyOn(api, "fetchActiveRecommendations").mockResolvedValue([]);
    const { container } = render(<FriendRecommendationsCard token="test-token" />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("shows the heading, the count and the featured pick", async () => {
    const { container } = await renderCard([alice, bob]);

    expect(screen.getByRole("heading", { name: "Recommendations", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("2 new")).toBeInTheDocument();

    const hero = within(featured(container));
    expect(featured(container)).toHaveTextContent("Alice recommends");
    expect(hero.getByText("Glasgow")).toBeInTheDocument();
    expect(hero.getByText(/Song by The Snuts/)).toBeInTheDocument();
    expect(hero.getByText(/Brilliant track!/)).toBeInTheDocument();
  });

  it("lists the other picks as rows and has no pager", async () => {
    await renderCard([alice, bob]);

    expect(screen.getByText("Also waiting for you")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play W.L. on Spotify" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not for me: W.L." })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /next recommendation|previous recommendation/i })
    ).toBeNull();
    expect(screen.queryByText(/\d of \d/)).toBeNull();
  });

  it("shows no list when there is only one pick", async () => {
    await renderCard([alice]);
    expect(screen.queryByText("Also waiting for you")).toBeNull();
    expect(screen.getByText("1 new")).toBeInTheDocument();
  });

  it("promotes a row to the featured slot when clicked", async () => {
    const { container } = await renderCard([alice, bob]);

    fireEvent.click(screen.getByRole("button", { name: "Show Bob's recommendation: W.L." }));

    expect(featured(container)).toHaveTextContent("Bob recommends");
    expect(within(featured(container)).getByText("W.L.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show Alice's recommendation: Glasgow" })
    ).toBeInTheDocument();
  });

  it("Play on Spotify marks the pick listened, opens Spotify and promotes the next pick", async () => {
    const updateSpy = vi
      .spyOn(api, "updateRecommendationStatus")
      .mockResolvedValue({ id: 1, status: "listened" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = await renderCard([alice, bob]);

    fireEvent.click(screen.getByRole("button", { name: /^Play on Spotify$/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        token: "test-token",
        recommendationId: 1,
        status: "listened",
      });
      expect(featured(container)).toHaveTextContent("Bob recommends");
    });
    expect(openSpy).toHaveBeenCalledWith(
      "https://open.spotify.com/track/123",
      "_blank",
      "noopener,noreferrer"
    );
    expect(screen.queryByText("Glasgow")).toBeNull();
    expect(screen.getByText("1 new")).toBeInTheDocument();
  });

  it("a row's Play marks that pick listened and removes only that row", async () => {
    const updateSpy = vi
      .spyOn(api, "updateRecommendationStatus")
      .mockResolvedValue({ id: 2, status: "listened" });
    vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = await renderCard([alice, bob]);

    fireEvent.click(screen.getByRole("button", { name: "Play W.L. on Spotify" }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        token: "test-token",
        recommendationId: 2,
        status: "listened",
      });
      expect(screen.queryByText("Also waiting for you")).toBeNull();
    });
    expect(featured(container)).toHaveTextContent("Alice recommends");
  });

  it("Not for me marks the pick dismissed and removes the whole card for the last pick", async () => {
    const updateSpy = vi
      .spyOn(api, "updateRecommendationStatus")
      .mockResolvedValue({ id: 1, status: "dismissed" });
    const { container } = await renderCard([alice]);

    fireEvent.click(screen.getByRole("button", { name: "Not for me" }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        token: "test-token",
        recommendationId: 1,
        status: "dismissed",
      });
      expect(container.firstChild).toBeNull();
    });
  });

  it("shows four rows and reveals the rest with Show more", async () => {
    await renderCard(makePicks(6));

    expect(screen.getAllByRole("button", { name: /^Show .*'s recommendation/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Show 1 more" }));
    expect(screen.getAllByRole("button", { name: /^Show .*'s recommendation/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.getAllByRole("button", { name: /^Show .*'s recommendation/ })).toHaveLength(4);
  });

  it("copes with missing sender, image and note, and with artist picks", async () => {
    const { container } = await renderCard([
      {
        id: 7,
        sender_name: null,
        item_type: "artist",
        title: "A Very Long Artist Name That Goes On And On",
        artist_name: "A Very Long Artist Name That Goes On And On",
        note: null,
        image_url: null,
        spotify_url: "https://open.spotify.com/artist/7",
        status: "pending",
      },
    ]);

    expect(featured(container)).toHaveTextContent("A friend recommends");
    expect(featured(container).querySelector("img")).toBeNull();
    expect(within(featured(container)).getByText("Artist")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open on Spotify" })).toBeInTheDocument();
  });

  it("keeps the pick when the status update fails, and still opens Spotify", async () => {
    vi.spyOn(api, "updateRecommendationStatus").mockRejectedValue(new Error("boom"));
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = await renderCard([alice, bob]);

    fireEvent.click(screen.getByRole("button", { name: /^Play on Spotify$/i }));

    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Play on Spotify$/i })).not.toBeDisabled();
    });
    expect(featured(container)).toHaveTextContent("Alice recommends");
    expect(screen.getByText("2 new")).toBeInTheDocument();
  });

  it("sends only one status update when a button is clicked twice", async () => {
    let finish;
    const updateSpy = vi.spyOn(api, "updateRecommendationStatus").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    vi.spyOn(window, "open").mockImplementation(() => null);
    await renderCard([alice, bob]);

    const play = screen.getByRole("button", { name: /^Play on Spotify$/i });
    fireEvent.click(play);
    fireEvent.click(play);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    finish({ id: 1, status: "listened" });
    await waitFor(() => expect(screen.queryByText("Glasgow")).toBeNull());
  });

  it("uses no inline styles", async () => {
    const { container } = await renderCard([alice, bob]);
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });
});
