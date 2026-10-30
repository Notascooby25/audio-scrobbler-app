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

  it("lists the five furthest gigs with distance and notes gigs still being located", async () => {
    mockReports({
      byYear: [{ period: String(currentYear), gigs: 1, festivals: 0 }],
      furthest: {
        home_set: true,
        located_gigs: 1,
        pending_gigs: 2,
        furthest: [
          {
            id: 1,
            artist_name: "Far Band",
            venue_name: "Big Hall",
            city: "Paris",
            country: "France",
            date: "01 Jan 2026",
            event_date: "2026-01-01T00:00:00",
            distance_km: 343,
          },
        ],
      },
    });
    renderSection();

    expect(await screen.findByText("Far Band")).toBeInTheDocument();
    expect(screen.getByText("343 km")).toBeInTheDocument();
    expect(screen.getByText(/2 gigs are still being located/)).toBeInTheDocument();
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
