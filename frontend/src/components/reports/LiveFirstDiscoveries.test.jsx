import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LiveArtistsSeenList from "./LiveArtistsSeenList";
import GigCadenceHeatmap from "./GigCadenceHeatmap";
import SetlistReplayHighlights from "./SetlistReplayHighlights";
import VenueRoyaltyList from "./VenueRoyaltyList";
import GigDayOfWeekChart from "./GigDayOfWeekChart";

afterEach(() => cleanup());

describe("LiveArtistsSeenList", () => {
  it("renders live artist rankings with show counts and bars", () => {
    const artists = [
      {
        artist_name: "The Lottery Winners",
        count: 5,
      },
    ];

    render(<LiveArtistsSeenList artists={artists} />);

    expect(screen.getByText("Live Artist Rankings")).toBeInTheDocument();
    expect(screen.getByText("The Lottery Winners")).toBeInTheDocument();
    expect(screen.getByText("5 gigs")).toBeInTheDocument();
  });
});

describe("GigCadenceHeatmap", () => {
  it("renders matrix with annual concert stats and month cells", () => {
    const matrix = {
      years: [2026],
      daily_counts: {
        "2026-05-10": 1,
        "2026-07-20": 2,
      },
    };

    render(<GigCadenceHeatmap matrix={matrix} />);

    expect(screen.getByText("Annual Gig Cadence")).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText("May")).toBeInTheDocument();
  });
});

describe("SetlistReplayHighlights", () => {
  it("renders setlist songs heard live", () => {
    const songs = [
      {
        song_name: "Burning Daylight",
        artist_name: "The Lottery Winners",
        count: 4,
      },
    ];

    render(<SetlistReplayHighlights songs={songs} />);

    expect(screen.getByText("Setlist Replay Tracker")).toBeInTheDocument();
    expect(screen.getByText("Burning Daylight")).toBeInTheDocument();
    expect(screen.getByText("4 live plays")).toBeInTheDocument();
  });
});

describe("VenueRoyaltyList", () => {
  it("renders top venues with gig counts and artist numbers", () => {
    const venues = [
      {
        venue_name: "Brudenell Social Club",
        city: "Leeds",
        country: "United Kingdom",
        gig_count: 14,
        festivals: 2,
        distinct_artists: 38,
      },
    ];

    render(<VenueRoyaltyList venues={venues} />);

    expect(screen.getByText("Brudenell Social Club")).toBeInTheDocument();
    expect(screen.getByText(/14 gigs/i)).toBeInTheDocument();
    expect(screen.getByText(/38 distinct artists/i)).toBeInTheDocument();
  });
});

describe("GigDayOfWeekChart", () => {
  it("renders weekday distribution bars", () => {
    const cadence = [
      { day_index: 0, day_name: "Mon", count: 2, percent: 10.0 },
      { day_index: 4, day_name: "Fri", count: 10, percent: 50.0 },
      { day_index: 5, day_name: "Sat", count: 8, percent: 40.0 },
    ];

    render(<GigDayOfWeekChart cadence={cadence} />);

    expect(screen.getByText("Gig Rhythm & Cadence")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
  });
});
