import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import VenuesLeaderboard from "./VenuesLeaderboard";

const renderLeaderboard = (props) =>
  render(
    <MemoryRouter>
      <VenuesLeaderboard {...props} />
    </MemoryRouter>
  );

const venues = [
  {
    venue_name: "Southsea Common",
    city: "Portsmouth",
    country: "United Kingdom",
    count: 2,
    gigs: [
      {
        id: 1,
        artist_name: "Local Band",
        event_date: "2026-05-02T00:00:00",
        date: "02 May 2026",
        is_support: false,
        is_festival: false,
      },
      {
        id: 2,
        artist_name: "Big Festival Act",
        event_date: "2026-06-20T00:00:00",
        date: "20 Jun 2026",
        is_support: false,
        is_festival: true,
      },
    ],
  },
  {
    venue_name: "Weston Park",
    city: "Weston-under-Lizard",
    country: "United Kingdom",
    count: 1,
    gigs: [
      {
        id: 3,
        artist_name: "Other Festival Act",
        event_date: "2026-08-01T00:00:00",
        date: "01 Aug 2026",
        is_support: false,
        is_festival: true,
      },
    ],
  },
];

describe("VenuesLeaderboard festivals", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists festival gigs under a Festivals heading, newest first", () => {
    renderLeaderboard({ venues, onOpenGig: vi.fn() });

    const heading = screen.getByRole("heading", { name: "Festivals" });
    expect(heading).toBeInTheDocument();
    const festivalSection = heading.closest(".sfm-festivals");
    const titles = Array.from(festivalSection.querySelectorAll(".sfm-gig-title")).map(
      (node) => node.textContent
    );
    expect(titles).toEqual(["Other Festival Act", "Big Festival Act"]);
  });

  it("opens a festival gig from the Festivals section", () => {
    const onOpenGig = vi.fn();
    renderLeaderboard({ venues, onOpenGig });

    const heading = screen.getByRole("heading", { name: "Festivals" });
    const festivalSection = heading.closest(".sfm-festivals");
    fireEvent.click(festivalSection.querySelector("button.sfm-link"));

    expect(onOpenGig).toHaveBeenCalledWith(3);
  });

  it("hides the Festivals heading when no gig is a festival", () => {
    const noFestivals = venues.map((venue) => ({
      ...venue,
      gigs: venue.gigs.map((gig) => ({ ...gig, is_festival: false })),
    }));
    renderLeaderboard({ venues: noFestivals });

    expect(screen.queryByRole("heading", { name: "Festivals" })).not.toBeInTheDocument();
  });
});
