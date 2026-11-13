import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "../../pages/OverviewPage";
import SleevePlayPage from "../../skins/sleeve/slots/SleevePlayPage";
import TimelinePlayPage from "../../skins/timeline/slots/TimelinePlayPage";
import * as api from "../../api";
import * as session from "../../session";

const picks = [
  {
    id: 1,
    sender_name: "Alice",
    item_type: "album",
    title: "Blue Lines",
    artist_name: "Massive Attack",
    note: "Play it loud.",
    spotify_url: "https://open.spotify.com/album/1",
    status: "pending",
  },
  {
    id: 2,
    sender_name: "Bob",
    item_type: "track",
    title: "Glasgow",
    artist_name: "The Snuts",
    note: null,
    spotify_url: "https://open.spotify.com/track/2",
    status: "pending",
  },
];

const surfaces = [
  ["Timeline", TimelinePlayPage],
  ["Sleeve", SleevePlayPage],
  ["classic Overview", OverviewPage],
];

describe("friend recommendations on every Play surface", () => {
  beforeEach(() => {
    vi.spyOn(session, "readSession").mockReturnValue({
      accessToken: "test-token",
      userId: 1,
      username: "tester",
    });
    vi.spyOn(api, "fetchActiveRecommendations").mockResolvedValue(picks);
    vi.spyOn(api, "fetchJukeboxAlbums").mockResolvedValue({ albums: [] });
    vi.spyOn(api, "fetch1001Albums").mockResolvedValue({ albums: [] });
    vi.spyOn(api, "fetchRediscoverTracks").mockResolvedValue({ tracks: [] });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each(surfaces)("%s shows the heading, the featured pick and a row", async (_name, Page) => {
    const { container } = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    );

    const card = await waitFor(() => {
      const found = container.querySelector(".friend-recs");
      expect(found).not.toBeNull();
      return found;
    });
    const panel = within(card);

    expect(panel.getByRole("heading", { name: "Recommendations", level: 2 })).toBeInTheDocument();
    expect(card.querySelector(".friend-recs__featured")).toHaveTextContent("Alice recommends");
    expect(panel.getByText("Blue Lines")).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Play Glasgow on Spotify" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Not for me" })).toBeInTheDocument();
  });

  it.each(surfaces)("%s card carries no inline styles", async (_name, Page) => {
    const { container } = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    );

    await waitFor(() => expect(container.querySelector(".friend-recs")).not.toBeNull());
    expect(container.querySelector(".friend-recs").querySelectorAll("[style]")).toHaveLength(0);
    expect(container.querySelector(".friend-recs").getAttribute("style")).toBeNull();
  });
});
