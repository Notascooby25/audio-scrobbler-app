import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
        festival_name: "Victorious Festival 2026",
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
        festival_name: "Victorious Festival 2026",
      },
      {
        id: 4,
        artist_name: "The Wombats",
        event_date: "2009-08-23T00:00:00",
        date: "23 Aug 2009",
        is_support: false,
        is_festival: true,
        festival_name: "V Festival – 2009",
      },
    ],
  },
];

const festivalOnlyVenue = {
  venue_name: "Weston Park",
  city: "Weston-under-Lizard",
  country: "United Kingdom",
  count: 1,
  gigs: [
    {
      id: 5,
      artist_name: "The Wombats",
      is_festival: true,
      festival_name: "V Festival – 2009",
      event_date: "2009-08-23",
      date: "23 Aug 2009",
    },
  ],
};

const mixedVenue = {
  venue_name: "Southsea Common",
  city: "Portsmouth",
  country: "United Kingdom",
  count: 2,
  gigs: [
    {
      id: 6,
      artist_name: "Doves",
      is_festival: true,
      festival_name: "Victorious Festival 2026",
      event_date: "2026-08-29",
      date: "29 Aug 2026",
    },
    {
      id: 7,
      artist_name: "Doves",
      is_festival: false,
      festival_name: null,
      event_date: "2019-05-01",
      date: "01 May 2019",
    },
  ],
};

describe("VenuesLeaderboard festivals", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists each festival edition once, with its year and act count, newest first", () => {
    renderLeaderboard({ venues });

    const heading = screen.getByRole("heading", { name: "Festivals" });
    const section = heading.closest(".sfm-festivals");
    const labels = within(section)
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(labels).toEqual(["Victorious Festival 2026 · 2 acts", "V Festival 2009 · 1 act"]);
  });

  it("opens a festival edition to show the acts seen there and opens a gig", () => {
    const onOpenGig = vi.fn();
    renderLeaderboard({ venues, onOpenGig });

    const section = screen.getByRole("heading", { name: "Festivals" }).closest(".sfm-festivals");
    fireEvent.click(
      within(section).getByRole("button", { name: "Victorious Festival 2026 · 2 acts" })
    );
    fireEvent.click(within(section).getByRole("button", { name: "Big Festival Act" }));

    expect(within(section).getByText("Other Festival Act")).toBeInTheDocument();
    expect(onOpenGig).toHaveBeenCalledWith(2);
  });

  it("hides the Festivals heading when no gig is a festival", () => {
    const noFestivals = venues.map((venue) => ({
      ...venue,
      gigs: venue.gigs.map((gig) => ({ ...gig, is_festival: false, festival_name: null })),
    }));
    renderLeaderboard({ venues: noFestivals });

    expect(screen.queryByRole("heading", { name: "Festivals" })).not.toBeInTheDocument();
  });

  it("heads a venue with its festival when every gig there is a festival", () => {
    renderLeaderboard({ venues: [festivalOnlyVenue] });

    expect(screen.getByText("V Festival")).toBeInTheDocument();
    expect(
      screen.getByText("Weston Park, Weston-under-Lizard, United Kingdom")
    ).toBeInTheDocument();
  });

  it("keeps the venue name as the heading when the venue also has ordinary gigs", () => {
    renderLeaderboard({ venues: [mixedVenue] });

    expect(screen.getByText("Southsea Common")).toBeInTheDocument();
    expect(screen.queryByText("Victorious Festival")).not.toBeInTheDocument();
  });
});
