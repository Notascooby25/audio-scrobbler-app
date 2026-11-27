import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ReportsPage from "./ReportsPage";

vi.mock("../api", () => ({
  fetchReportsSummary: vi.fn().mockResolvedValue({}),
  fetchReportsCharts: vi.fn().mockResolvedValue({}),
  fetchReportsEntity: vi.fn().mockResolvedValue({ entries: [] }),
  fetchFriendsComparison: vi.fn().mockResolvedValue({}),
  fetchUserProfile: vi.fn().mockResolvedValue({ username: "friend" }),
  fetchUserSettings: vi.fn().mockResolvedValue({ default_date_range: "last.week" }),
}));
vi.mock("../components/reports/GigReportsSection", () => ({ default: () => <p>gig reports</p> }));
vi.mock("../components/wrapped/WrappedYearsCard", () => ({
  default: () => <p>year cards here</p>,
}));
vi.mock("../session", () => ({
  readSession: vi.fn().mockReturnValue({ accessToken: "fake-token", userId: 1 }),
}));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

function renderPage(path = "/reports") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ReportsPage />
    </MemoryRouter>
  );
}

describe("Reports: Wrapped tab", () => {
  it("has a Wrapped tab straight after Gigs", () => {
    renderPage();
    const sections = screen.getByRole("tablist", { name: "Report sections" });
    const tabs = within(sections)
      .getAllByRole("tab")
      .map((tab) => tab.textContent);
    expect(tabs).toEqual(["Listening", "Gigs", "Wrapped"]);
  });

  it("keeps the year cards out of the Listening tab and shows them on the Wrapped tab", () => {
    renderPage();
    expect(screen.queryByText("year cards here")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Wrapped" }));
    expect(screen.getByText("year cards here")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Wrapped" })).toHaveAttribute("aria-selected", "true");
  });

  it("has no Wrapped tab on someone else's reports", () => {
    renderPage("/reports?userId=2");
    expect(screen.queryByRole("tab", { name: "Wrapped" })).not.toBeInTheDocument();
  });
});
