import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TimelineChart from "./TimelineChart";

describe("TimelineChart", () => {
  afterEach(() => cleanup());
  it("renders notice when entries array is empty", () => {
    render(<TimelineChart entries={[]} />);
    expect(screen.getByText("No timeline data yet.")).toBeInTheDocument();
  });

  it("renders all years when 5 or fewer years are provided", () => {
    const data = [
      { period: "2024", count: 100 },
      { period: "2025", count: 200 },
      { period: "2026", count: 300 },
    ];
    render(<TimelineChart entries={data} />);
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("renders only the last 5 years when more than 5 years are provided", () => {
    const data = [
      { period: "2018", count: 10 },
      { period: "2019", count: 20 },
      { period: "2021", count: 30 },
      { period: "2022", count: 40 },
      { period: "2023", count: 50 },
      { period: "2024", count: 60 },
      { period: "2025", count: 70 },
      { period: "2026", count: 80 },
    ];
    render(<TimelineChart entries={data} />);
    expect(screen.queryByText("2018")).not.toBeInTheDocument();
    expect(screen.queryByText("2019")).not.toBeInTheDocument();
    expect(screen.queryByText("2021")).not.toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("calculates maximum bar height relative to visible 5 years", () => {
    const data = [
      { period: "2018", count: 50000 }, // hidden older year
      { period: "2022", count: 10 },
      { period: "2023", count: 20 },
      { period: "2024", count: 50 },
      { period: "2025", count: 100 },
      { period: "2026", count: 100 },
    ];
    const { container } = render(<TimelineChart entries={data} />);
    const bars = container.querySelectorAll(".timeline-bar");
    expect(bars.length).toBe(5);
    // 2026 has count 100 which is the max of the visible items, so height should be 100%
    expect(bars[4].getAttribute("style")).toContain("height: 100%");
  });
});
