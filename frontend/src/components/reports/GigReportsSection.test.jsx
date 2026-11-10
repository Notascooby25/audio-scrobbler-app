import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import GigReportsSection from "./GigReportsSection";
import * as setlistsApi from "../../api/setlists";

vi.mock("../../api/setlists", () => ({
  fetchGigsByPeriod: vi.fn(),
  fetchLiveGap: vi.fn(),
  fetchGigBump: vi.fn(),
  fetchFurthestGigs: vi.fn(),
  fetchGigTravelAndVenues: vi.fn(),
  fetchGigBadges: vi.fn(),
  fetchLiveFirstDiscoveries: vi.fn(),
  fetchGigSurgeLeaderboard: vi.fn(),
  fetchGigDayOfWeek: vi.fn(),
  fetchGigMapPins: vi.fn(),
}));

const bump = {
  window_days: 14,
  gigs_analysed: 4,
  average_plays_before: 10,
  average_plays_after: 15,
  change_percent: 50,
};

const defaultTravel = {
  home_set: true,
  total_distance_km: 1200,
  located_events: 5,
  pending_events: 0,
  active_streak_months: 4,
  venue_royalty: [
    {
      venue_name: "The Fleece",
      city: "Bristol",
      country: "United Kingdom",
      gig_count: 8,
      festivals: 0,
      distinct_artists: 12,
    },
  ],
};

const defaultBadges = [
  {
    id: "solo_explorer",
    name: "Solo Explorer",
    description: "Attended a gig solo",
    emoji: "🧭",
    unlocked: true,
    progress: 1,
    target: 1,
  },
  {
    id: "road_warrior",
    name: "Road Warrior",
    description: "Travelled far",
    emoji: "🚗",
    unlocked: false,
    progress: 1200,
    target: 5000,
  },
];

const currentYear = new Date().getFullYear();

function renderSection(props = {}) {
  return render(
    <MemoryRouter>
      <GigReportsSection token="test-token" {...props} />
    </MemoryRouter>
  );
}

function mockReports({
  byYear,
  liveGap = [],
  furthest = { home_set: true, located_gigs: 0, pending_gigs: 0, furthest: [] },
  travel = defaultTravel,
  badges = defaultBadges,
  discoveries = [],
  surge = [],
  dayOfWeek = [
    { day_name: "Fri", day_index: 4, gig_count: 5 },
    { day_name: "Sat", day_index: 5, gig_count: 8 },
  ],
  pins = [],
} = {}) {
  setlistsApi.fetchGigsByPeriod.mockResolvedValue({
    by_year: byYear || [{ period: String(currentYear), gigs: 3, festivals: 1 }],
    by_month: [{ period: `${currentYear}-01`, gigs: 1, festivals: 0 }],
  });
  setlistsApi.fetchLiveGap.mockResolvedValue(liveGap);
  setlistsApi.fetchGigBump.mockResolvedValue(bump);
  setlistsApi.fetchFurthestGigs.mockResolvedValue(furthest);
  setlistsApi.fetchGigTravelAndVenues.mockResolvedValue(travel);
  setlistsApi.fetchGigBadges.mockResolvedValue(badges);
  setlistsApi.fetchLiveFirstDiscoveries.mockResolvedValue(discoveries);
  setlistsApi.fetchGigSurgeLeaderboard.mockResolvedValue(surge);
  setlistsApi.fetchGigDayOfWeek.mockResolvedValue(dayOfWeek);
  setlistsApi.fetchGigMapPins.mockResolvedValue(pins);
}

function yearRows() {
  return within(screen.getByRole("heading", { name: "Gigs per year" }).parentElement)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("strong").textContent);
}

describe("GigReportsSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads the report for the viewed user and shows the gig bump", async () => {
    mockReports({ byYear: [{ period: String(currentYear), gigs: 3, festivals: 1 }] });

    renderSection({ userId: 7 });

    expect(await screen.findByText("Gigs per month")).toBeInTheDocument();
    expect(setlistsApi.fetchGigsByPeriod).toHaveBeenCalledWith({ token: "test-token", userId: 7 });
    expect(screen.getByText("+50%")).toBeInTheDocument();
  });

  it("shows the last five calendar years, filling years with no gigs", async () => {
    mockReports({ byYear: [{ period: String(currentYear - 9), gigs: 2, festivals: 0 }] });

    renderSection();

    expect(await screen.findByRole("button", { name: "Show all 10 years" })).toBeInTheDocument();
    const shown = yearRows();
    expect(shown).toEqual([
      String(currentYear - 4),
      String(currentYear - 3),
      String(currentYear - 2),
      String(currentYear - 1),
      String(currentYear),
    ]);
  });

  it("reveals every year on request and collapses back", async () => {
    mockReports({ byYear: [{ period: String(currentYear - 9), gigs: 2, festivals: 0 }] });
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Show all 10 years" }));
    expect(yearRows()).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "Show last 5 years" }));
    expect(yearRows()).toHaveLength(5);
  });

  it("shows the top five live gap artists, with more on request", async () => {
    const liveGap = Array.from({ length: 8 }, (_, index) => ({
      artist_name: `Artist ${index + 1}`,
      plays: 100 - index,
    }));
    mockReports({ byYear: [{ period: String(currentYear), gigs: 1, festivals: 0 }], liveGap });
    renderSection();

    expect(await screen.findByText("Artist 5")).toBeInTheDocument();
    expect(screen.queryByText("Artist 6")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show more (8)" }));
    expect(screen.getByText("Artist 8")).toBeInTheDocument();
  });

  it("asks for a home city before showing furthest gigs", async () => {
    mockReports({
      byYear: [{ period: String(currentYear), gigs: 1, festivals: 0 }],
      furthest: { home_set: false, located_gigs: 0, pending_gigs: 0, furthest: [] },
    });
    renderSection();

    expect(await screen.findByText(/Add your home city in/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("lists the furthest venues with distance, and notes gigs still being located", async () => {
    mockReports({
      byYear: [{ period: String(currentYear), gigs: 1, festivals: 0 }],
      furthest: {
        home_set: true,
        located_gigs: 1,
        pending_gigs: 2,
        furthest: [
          {
            venue_name: "Big Hall",
            city: "Paris",
            country: "France",
            distance_km: 343,
            approximate: false,
            gig_count: 1,
            gigs: [
              {
                id: 1,
                artist_name: "Far Band",
                date: "01 Jan 2026",
                event_date: "2026-01-01T00:00:00",
              },
            ],
          },
        ],
      },
    });
    renderSection();

    expect(await screen.findByRole("button", { name: /Big Hall/ })).toBeInTheDocument();
    expect(screen.getByText("343 km")).toBeInTheDocument();
    expect(screen.getByText(/2 gigs are still being located/)).toBeInTheDocument();
  });

  it("opens a venue to show every band you saw there", async () => {
    mockReports({
      byYear: [{ period: String(currentYear), gigs: 2, festivals: 1 }],
      furthest: {
        home_set: true,
        located_gigs: 2,
        pending_gigs: 0,
        furthest: [
          {
            venue_name: "Watergate Bay",
            city: "Newquay",
            country: "United Kingdom",
            distance_km: 316,
            approximate: false,
            gig_count: 2,
            gigs: [
              {
                id: 7,
                artist_name: "Breaks Co-op",
                date: "05 Aug 2006",
                event_date: "2006-08-05T00:00:00",
              },
              {
                id: 8,
                artist_name: "Starsailor",
                date: "05 Aug 2006",
                event_date: "2006-08-05T00:00:00",
              },
            ],
          },
        ],
      },
    });
    renderSection();

    const toggle = await screen.findByRole("button", { name: /Watergate Bay/ });
    expect(toggle).toHaveTextContent("2 gigs");
    expect(screen.queryByRole("link", { name: "Starsailor" })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole("link", { name: "Breaks Co-op" })).toHaveAttribute("href", "/gigs/7");
    expect(screen.getByRole("link", { name: "Starsailor" })).toHaveAttribute("href", "/gigs/8");
  });

  it("does not show furthest gigs for a followed person's report", async () => {
    mockReports({ byYear: [{ period: String(currentYear), gigs: 1, festivals: 0 }] });
    renderSection({ userId: 7 });

    await screen.findByText("Gigs per month");
    expect(setlistsApi.fetchFurthestGigs).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Furthest gigs" })).not.toBeInTheDocument();
  });

  it("shows the error when the report cannot load", async () => {
    setlistsApi.fetchGigsByPeriod.mockRejectedValue(
      new Error("Follow this user to see their gigs.")
    );
    setlistsApi.fetchLiveGap.mockResolvedValue([]);
    setlistsApi.fetchGigBump.mockResolvedValue(null);
    setlistsApi.fetchFurthestGigs.mockResolvedValue(null);

    renderSection({ userId: 9 });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Follow this user to see their gigs.")
    );
  });

  it("filters panels when switching between sub-tabs", async () => {
    mockReports({
      byYear: [{ period: String(currentYear), gigs: 2, festivals: 1 }],
      badges: defaultBadges,
      travel: defaultTravel,
    });
    renderSection();

    expect(await screen.findByTestId("gig-hero-stats")).toBeInTheDocument();
    expect(screen.getByText("Solo Explorer")).toBeInTheDocument();
    expect(screen.getByText("The Fleece")).toBeInTheDocument();

    // Switch to Badges & Streaks tab
    fireEvent.click(screen.getByRole("button", { name: /Badges & Streaks/ }));
    expect(screen.getByText("Solo Explorer")).toBeInTheDocument();
    // Travel venues should not be rendered on Badges tab
    expect(screen.queryByText("The Fleece")).not.toBeInTheDocument();

    // Switch to Travel & Map tab
    fireEvent.click(screen.getByRole("button", { name: /Travel & Map/ }));
    expect(screen.getByText("The Fleece")).toBeInTheDocument();
    expect(screen.queryByText("Solo Explorer")).not.toBeInTheDocument();

    // Switch back to All Intelligence
    fireEvent.click(screen.getByRole("button", { name: /All Intelligence/ }));
    expect(screen.getByText("Solo Explorer")).toBeInTheDocument();
    expect(screen.getByText("The Fleece")).toBeInTheDocument();
  });

  it("allows toggling widgets on and off via the customizer", async () => {
    mockReports({
      byYear: [{ period: String(currentYear), gigs: 2, festivals: 1 }],
      badges: defaultBadges,
    });
    renderSection();

    expect(await screen.findByText("Solo Explorer")).toBeInTheDocument();

    // Open customizer
    fireEvent.click(screen.getByRole("button", { name: /Customise widgets/ }));
    const badgesCheckbox = screen.getByLabelText(/Badges & Streaks/);
    expect(badgesCheckbox).toBeChecked();

    // Turn badges off
    fireEvent.click(badgesCheckbox);
    expect(badgesCheckbox).not.toBeChecked();
    expect(screen.queryByText("Solo Explorer")).not.toBeInTheDocument();

    // Turn badges back on
    fireEvent.click(badgesCheckbox);
    expect(badgesCheckbox).toBeChecked();
    expect(screen.getByText("Solo Explorer")).toBeInTheDocument();
  });
});
