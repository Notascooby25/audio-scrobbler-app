import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import BarTrendChart from "../charts/BarTrendChart";
import ListeningClockChart from "../charts/ListeningClockChart";
import GigDayOfWeekChart from "./GigDayOfWeekChart";
import LiveArtistsSeenList from "./LiveArtistsSeenList";
import Report1001Milestone from "./Report1001Milestone";
import ReportLiveConnection from "./ReportLiveConnection";
import ReportMilestones from "./ReportMilestones";
import ReportRoughTradeMilestone from "./ReportRoughTradeMilestone";
import ReportRatios from "./ReportRatios";
import VenueRoyaltyList from "./VenueRoyaltyList";
import { REPORT_HINTS } from "../../reportHints";

const aboutButton = (name) => screen.getByRole("button", { name: `About ${name}`, exact: true });

describe("Reports info hints wiring", () => {
  afterEach(() => cleanup());

  it("ratio cards show hints with the right text", () => {
    render(<ReportRatios summary={{ period_scrobbles: 10, unique_artists: 2 }} />);
    fireEvent.click(aboutButton("Singles vs. Albums"));
    expect(screen.getByRole("note")).toHaveTextContent(REPORT_HINTS["ratios.singles"]);
    expect(aboutButton("Explorer vs. Repeater")).toBeInTheDocument();
    expect(aboutButton("New vs. Familiar")).toBeInTheDocument();
  });

  it("milestone cards each have a hint", () => {
    render(<ReportMilestones summary={{}} />);
    for (const name of [
      "Current Streak",
      "Peak Listening Day",
      "Heavy Rotation",
      "Period Persona",
    ]) {
      expect(aboutButton(name)).toBeInTheDocument();
    }
  });

  it("crossover cards have hints", () => {
    render(
      <MemoryRouter>
        <Report1001Milestone challenge1001={{}} />
        <ReportRoughTradeMilestone challengeRoughTrade={{}} />
        <ReportLiveConnection liveArtists={{}} />
      </MemoryRouter>
    );
    expect(aboutButton("1001 Albums Challenge")).toBeInTheDocument();
    expect(aboutButton("Rough Trade Top 100")).toBeInTheDocument();
    expect(aboutButton("Live Artist Connection")).toBeInTheDocument();
  });

  it("BarTrendChart shows a hint only when given one", () => {
    const points = [{ label: "a", count: 1 }];
    const { rerender } = render(<BarTrendChart title="Plain" points={points} />);
    expect(screen.queryByRole("button", { name: /^About/ })).not.toBeInTheDocument();
    rerender(
      <BarTrendChart title="Scrobbles over time" hint="scrobbles.over-time" points={points} />
    );
    expect(aboutButton("Scrobbles over time")).toBeInTheDocument();
  });

  it("ListeningClockChart shows its hint", () => {
    render(<ListeningClockChart points={[{ label: "1", count: 3 }]} />);
    expect(aboutButton("Listening clock")).toBeInTheDocument();
  });

  it("gig widgets show hints", () => {
    render(
      <div>
        <GigDayOfWeekChart cadence={[{ day_index: 4, day_name: "Fri", count: 2, percent: 100 }]} />
        <LiveArtistsSeenList artists={[{ artist_name: "A", count: 2 }]} />
        <VenueRoyaltyList venues={[{ venue_name: "V", count: 2 }]} />
      </div>
    );
    expect(aboutButton("Gig Rhythm & Cadence")).toBeInTheDocument();
    expect(aboutButton("Live Artist Rankings")).toBeInTheDocument();
    expect(aboutButton("Venue Stomping Grounds")).toBeInTheDocument();
  });
});
