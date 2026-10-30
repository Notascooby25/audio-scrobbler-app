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
}));

const bump = {
  window_days: 14,
  gigs_analysed: 4,
  average_plays_before: 10,
  average_plays_after: 15,
  change_percent: 50,
};

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
}) {
  setlistsApi.fetchGigsByPeriod.mockResolvedValue({
    by_year: byYear,
    by_month: [{ period: `${currentYear}-01`, gigs: 1, festivals: 0 }],
  });
  setlistsApi.fetchLiveGap.mockResolvedValue(liveGap);
  setlistsApi.fetchGigBump.mockResolvedValue(bump);
  setlistsApi.fetchFurthestGigs.mockResolvedValue(furthest);
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
});
