import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ReportMilestones from "./ReportMilestones";

describe("ReportMilestones component", () => {
  afterEach(() => cleanup());

  it("renders streak, peak day, heavy rotation, and persona correctly", () => {
    const summary = {
      current_streak_days: 18,
      period_best_streak_days: 22,
      peak_day: { date: "2026-10-18", count: 94 },
      heavy_rotation: { track_name: "Blue Monday", artist_name: "New Order", count: 26 },
      persona: "Night Owl",
    };

    render(<ReportMilestones summary={summary} />);

    expect(screen.getByText(/18 Days/i)).toBeInTheDocument();
    expect(screen.getByText(/Best in period: 22 days/i)).toBeInTheDocument();
    expect(screen.getByText(/94 Scrobbles/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-18/i)).toBeInTheDocument();
    expect(screen.getByText(/Blue Monday/i)).toBeInTheDocument();
    expect(screen.getByText(/New Order • 26 plays/i)).toBeInTheDocument();
    expect(screen.getByText(/Night Owl/i)).toBeInTheDocument();
  });

  it("renders fallback placeholders gracefully when data is empty", () => {
    render(<ReportMilestones summary={{}} />);
    expect(screen.getByText(/🔥 0 Days/i)).toBeInTheDocument();
    expect(screen.getByText(/No activity/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^None$/i).length).toBeGreaterThan(0);
  });
});
