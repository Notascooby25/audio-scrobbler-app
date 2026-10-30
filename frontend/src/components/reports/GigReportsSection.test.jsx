import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GigReportsSection from "./GigReportsSection";
import * as setlistsApi from "../../api/setlists";

vi.mock("../../api/setlists", () => ({
  fetchGigsByPeriod: vi.fn(),
  fetchLiveGap: vi.fn(),
  fetchGigBump: vi.fn(),
}));

const periods = {
  by_year: [
    { period: "2025", gigs: 1, festivals: 0 },
    { period: "2026", gigs: 3, festivals: 1 },
  ],
  by_month: [
    { period: "2025-12", gigs: 1, festivals: 0 },
    { period: "2026-01", gigs: 0, festivals: 0 },
    { period: "2026-02", gigs: 3, festivals: 1 },
  ],
};

describe("GigReportsSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows gig totals, the live gap and the gig bump", async () => {
    setlistsApi.fetchGigsByPeriod.mockResolvedValue(periods);
    setlistsApi.fetchLiveGap.mockResolvedValue([{ artist_name: "Unseen Band", plays: 42 }]);
    setlistsApi.fetchGigBump.mockResolvedValue({
      window_days: 14,
      gigs_analysed: 4,
      average_plays_before: 10,
      average_plays_after: 15,
      change_percent: 50,
    });

    render(<GigReportsSection token="test-token" userId={7} />);

    expect(await screen.findByText("Gigs per month")).toBeInTheDocument();
    expect(setlistsApi.fetchGigsByPeriod).toHaveBeenCalledWith({ token: "test-token", userId: 7 });
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Unseen Band")).toBeInTheDocument();
    expect(screen.getByText("+50%")).toBeInTheDocument();
  });

  it("asks for a first gig when there is nothing to report", async () => {
    setlistsApi.fetchGigsByPeriod.mockResolvedValue({ by_year: [], by_month: [] });
    setlistsApi.fetchLiveGap.mockResolvedValue([]);
    setlistsApi.fetchGigBump.mockResolvedValue({
      window_days: 14,
      gigs_analysed: 0,
      average_plays_before: 0,
      average_plays_after: 0,
      change_percent: null,
    });

    render(<GigReportsSection token="test-token" />);

    expect(await screen.findByText("Log some gigs to see your gig reports.")).toBeInTheDocument();
  });

  it("shows the error when the report cannot load", async () => {
    setlistsApi.fetchGigsByPeriod.mockRejectedValue(
      new Error("Follow this user to see their gigs.")
    );
    setlistsApi.fetchLiveGap.mockResolvedValue([]);
    setlistsApi.fetchGigBump.mockResolvedValue(null);

    render(<GigReportsSection token="test-token" userId={9} />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Follow this user to see their gigs.")
    );
  });
});
