import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LiveFirstDiscoveries from "./LiveFirstDiscoveries";
import VenueRoyaltyList from "./VenueRoyaltyList";
import GigDayOfWeekChart from "./GigDayOfWeekChart";

afterEach(() => cleanup());

describe("LiveFirstDiscoveries", () => {
  it("renders discoveries with play count and dates", () => {
    const discoveries = [
      {
        artist_name: "Fontaines D.C.",
        venue_name: "Brudenell Social Club",
        city: "Leeds",
        country: "United Kingdom",
        gig_date: "12 Oct 2019",
        first_scrobble_date: "04 Feb 2020",
        lifetime_plays: 380,
      },
    ];

    render(<LiveFirstDiscoveries discoveries={discoveries} />);

    expect(screen.getByText("Fontaines D.C.")).toBeInTheDocument();
    expect(screen.getByText(/380 plays/i)).toBeInTheDocument();
    expect(screen.getByText(/Seen 12 Oct 2019/i)).toBeInTheDocument();
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

    expect(screen.getByText(/Gig Rhythm & Cadence/i)).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
  });
});
