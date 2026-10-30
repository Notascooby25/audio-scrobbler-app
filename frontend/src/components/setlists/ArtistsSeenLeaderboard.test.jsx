import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ArtistsSeenLeaderboard from "./ArtistsSeenLeaderboard";

describe("ArtistsSeenLeaderboard", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the festival alongside the venue for a festival gig", async () => {
    const artists = [
      {
        artist_name: "Doves",
        count: 1,
        gigs: [
          {
            id: 9,
            date: "29 Aug 2026",
            event_date: "2026-08-29T00:00:00",
            venue: "Castle Stage",
            city: "Portsmouth",
            is_support: false,
            festival_name: "Victorious Festival 2026",
            song_count: 6,
          },
        ],
      },
    ];
    render(
      <MemoryRouter>
        <ArtistsSeenLeaderboard artists={artists} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Doves" }));

    expect(
      await screen.findByText("Victorious Festival 2026 · Castle Stage, Portsmouth")
    ).toBeInTheDocument();
  });
});
