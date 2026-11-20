import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Report1001Milestone from "./Report1001Milestone";
import ReportLiveConnection from "./ReportLiveConnection";
import ReportRoughTradeMilestone from "./ReportRoughTradeMilestone";

describe("ReportCrossOvers components", () => {
  afterEach(() => cleanup());

  it("renders 1001 album challenge stats and album chips", () => {
    const challenge1001 = {
      completed_in_period: 3,
      total_completed: 72,
      recent_albums: ["The Queen Is Dead", "Rumours", "Disintegration"],
    };

    render(
      <MemoryRouter>
        <Report1001Milestone challenge1001={challenge1001} />
      </MemoryRouter>
    );

    expect(screen.getByText(/3 Completed This Period/i)).toBeInTheDocument();
    expect(screen.getByText(/72 \/ 1001/i)).toBeInTheDocument();
    expect(screen.getByText(/The Queen Is Dead/i)).toBeInTheDocument();
    expect(screen.getByText(/Rumours/i)).toBeInTheDocument();
  });

  it("renders live gig artist connection with attended artists", () => {
    const liveArtists = {
      attended_artists_played: 2,
      total_scrobbles: 80,
      top_artists: [
        { artist_name: "Pulp", count: 42 },
        { artist_name: "The Cure", count: 38 },
      ],
    };

    render(<ReportLiveConnection liveArtists={liveArtists} />);

    expect(screen.getByText(/2 Seen-Live Artists Played/i)).toBeInTheDocument();
    expect(screen.getByText(/80 scrobbles for bands/i)).toBeInTheDocument();
    expect(screen.getByText(/Pulp \(42\)/i)).toBeInTheDocument();
    expect(screen.getByText(/The Cure \(38\)/i)).toBeInTheDocument();
  });
});

const albumLabels = (count) =>
  Array.from({ length: count }, (_, index) => `Artist ${index + 1} – Album ${index + 1}`);
const viewAllButton = () => screen.queryByRole("button", { name: /^View all/ });

describe("Rough Trade card", () => {
  afterEach(() => cleanup());

  it("shows progress out of 700 and the first chips", () => {
    render(
      <MemoryRouter>
        <ReportRoughTradeMilestone
          challengeRoughTrade={{
            completed_in_period: 2,
            total_completed: 3,
            recent_albums: ["SAULT – Untitled (Black Is)", "Fontaines D.C. – Skinty Fia"],
            all_albums: ["SAULT – Untitled (Black Is)", "Fontaines D.C. – Skinty Fia"],
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/3 \/ 700/)).toBeInTheDocument();
    expect(screen.getByText(/2 Completed This Period/i)).toBeInTheDocument();
    expect(screen.getByText(/SAULT – Untitled \(Black Is\)/)).toBeInTheDocument();
    expect(viewAllButton()).not.toBeInTheDocument();
  });

  it("links to the Jukebox when nothing is completed", () => {
    render(
      <MemoryRouter>
        <ReportRoughTradeMilestone challengeRoughTrade={{}} />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /Browse in Jukebox/i })).toHaveAttribute(
      "href",
      "/jukebox"
    );
    expect(viewAllButton()).not.toBeInTheDocument();
  });
});

describe("View all buttons", () => {
  afterEach(() => cleanup());

  it("1001 card: no button at 5 albums, a button at 6 that opens every album", () => {
    const five = albumLabels(5);
    const { rerender } = render(
      <MemoryRouter>
        <Report1001Milestone
          challenge1001={{
            completed_in_period: 5,
            total_completed: 5,
            recent_albums: five,
            all_albums: five,
          }}
        />
      </MemoryRouter>
    );
    expect(viewAllButton()).not.toBeInTheDocument();

    const six = albumLabels(6);
    rerender(
      <MemoryRouter>
        <Report1001Milestone
          challenge1001={{
            completed_in_period: 6,
            total_completed: 6,
            recent_albums: six.slice(0, 5),
            all_albums: six,
          }}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Artist 6 – Album 6/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View all 6", exact: true }));
    const dialog = screen.getByRole("dialog", { name: /1001 Albums completed this period/i });
    expect(within(dialog).getByText("Artist 6 – Album 6")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Rough Trade card: the button opens the full list", () => {
    const seven = albumLabels(7);
    render(
      <MemoryRouter>
        <ReportRoughTradeMilestone
          challengeRoughTrade={{
            completed_in_period: 7,
            total_completed: 7,
            recent_albums: seven.slice(0, 5),
            all_albums: seven,
          }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "View all 7", exact: true }));
    const dialog = screen.getByRole("dialog", {
      name: /Rough Trade Top 100 completed this period/i,
    });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(7);
  });

  it("Live card: the button opens every artist with play counts", () => {
    const artists = Array.from({ length: 6 }, (_, index) => ({
      artist_name: `Band ${index + 1}`,
      count: 10 - index,
    }));
    render(
      <ReportLiveConnection
        liveArtists={{
          attended_artists_played: 6,
          total_scrobbles: 45,
          top_artists: artists.slice(0, 5),
          all_artists: artists,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "View all 6", exact: true }));
    const dialog = screen.getByRole("dialog", { name: /Seen-live artists played this period/i });
    expect(within(dialog).getByText("Band 6 (5)")).toBeInTheDocument();
  });

  it("falls back to the first-5 fields when the backend has no full list", () => {
    render(
      <MemoryRouter>
        <Report1001Milestone
          challenge1001={{
            completed_in_period: 3,
            total_completed: 3,
            recent_albums: ["Artist A – One", "Artist B – Two", "Artist C – Three"],
          }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/Artist C – Three/)).toBeInTheDocument();
    expect(viewAllButton()).not.toBeInTheDocument();

    cleanup();
    render(
      <ReportLiveConnection
        liveArtists={{
          attended_artists_played: 1,
          total_scrobbles: 4,
          top_artists: [{ artist_name: "Pulp", count: 4 }],
        }}
      />
    );
    expect(screen.getByText(/Pulp \(4\)/)).toBeInTheDocument();
    expect(viewAllButton()).not.toBeInTheDocument();
  });
});
