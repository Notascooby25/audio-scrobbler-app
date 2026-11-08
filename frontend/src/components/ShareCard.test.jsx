import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ShareCard from "./ShareCard";

describe("ShareCard", () => {
  afterEach(() => cleanup());

  const mockEntries = [
    {
      label: "Artist 1",
      secondary: "Rock",
      play_count: 50,
      artwork_url: "https://example.com/1.png",
    },
    {
      label: "Artist 2",
      secondary: "Pop",
      play_count: 35,
      artwork_url: "https://example.com/2.png",
    },
    {
      label: "Artist 3",
      secondary: "Indie",
      play_count: 20,
      artwork_url: "https://example.com/3.png",
    },
    {
      label: "Artist 4",
      secondary: "Jazz",
      play_count: 15,
      artwork_url: "https://example.com/4.png",
    },
    {
      label: "Artist 5",
      secondary: "Electronic",
      play_count: 10,
      artwork_url: "https://example.com/5.png",
    },
    {
      label: "Artist 6",
      secondary: "Folk",
      play_count: 5,
      artwork_url: "https://example.com/6.png",
    },
  ];

  it("renders 3x3 dimension class by default or when specified", () => {
    const { container } = render(
      <ShareCard
        entries={mockEntries}
        kind="artists"
        layout="grid"
        dimension="3x3"
        dateRangeLabel="Last 7 Days"
      />
    );
    expect(container.querySelector(".share-card-dim-3x3")).not.toBeNull();
    expect(screen.getByText("Top Artists")).toBeInTheDocument();
    expect(screen.getByText("Last 7 Days")).toBeInTheDocument();
  });

  it("renders 2x3 dimension class when specified", () => {
    const { container } = render(
      <ShareCard
        entries={mockEntries}
        kind="artists"
        layout="grid"
        dimension="2x3"
        dateRangeLabel="Last 7 Days"
      />
    );
    expect(container.querySelector(".share-card-dim-2x3")).not.toBeNull();
  });

  it("renders stats banner when infusions are enabled", () => {
    const stats = {
      listeningMinutes: 1122, // 18h 42m
      listeningMinutesComparisonPercent: 14.2,
      sourceBreakdown: [
        { source: "spotify", count: 82, percent: 82.0 },
        { source: "bbc_sounds", count: 18, percent: 18.0 },
      ],
      newDiscoveries: { artists: 8, albums: 3, tracks: 12 },
    };
    const enabledStats = {
      listeningTime: true,
      sources: true,
      discoveries: true,
    };

    const { container } = render(
      <ShareCard
        entries={mockEntries}
        kind="artists"
        layout="grid"
        dimension="3x3"
        dateRangeLabel="Last 7 Days"
        stats={stats}
        enabledStats={enabledStats}
      />
    );

    expect(container.querySelector(".share-card-stats-banner")).not.toBeNull();
    expect(screen.getByText("18h 42m")).toBeInTheDocument();
    expect(screen.getByText("▲ +14%")).toBeInTheDocument();
    expect(screen.getByText("Spotify 82%")).toBeInTheDocument();
    expect(screen.getByText("BBC Sounds 18%")).toBeInTheDocument();
    expect(screen.getByText("8 new artists")).toBeInTheDocument();
  });

  it("omits stats banner when no infusions are enabled", () => {
    const { container } = render(
      <ShareCard
        entries={mockEntries}
        kind="artists"
        layout="grid"
        dimension="3x3"
        dateRangeLabel="Last 7 Days"
        enabledStats={{ listeningTime: false, sources: false, discoveries: false }}
      />
    );
    expect(container.querySelector(".share-card-stats-banner")).toBeNull();
  });
});
