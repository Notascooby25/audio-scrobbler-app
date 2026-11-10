import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GigBadgesCatalog from "./GigBadgesCatalog";

afterEach(() => cleanup());

describe("GigBadgesCatalog", () => {
  const sampleBadges = [
    {
      id: "solo_explorer",
      name: "Solo Explorer",
      emoji: "🧭",
      description: "Attended a headline concert on your own",
      unlocked: true,
      progress: 4,
      target: 1,
    },
    {
      id: "century_club",
      name: "Century Club",
      emoji: "💯",
      description: "Reach 100 total logged concerts",
      unlocked: false,
      progress: 42,
      target: 100,
    },
  ];

  it("renders unlocked badge and locked badge with progress bar", () => {
    render(<GigBadgesCatalog badges={sampleBadges} />);

    expect(screen.getByText("Solo Explorer")).toBeInTheDocument();
    expect(screen.getByText("Century Club")).toBeInTheDocument();
    expect(screen.getByText("Unlocked")).toBeInTheDocument();
    expect(screen.getByText("42 / 100")).toBeInTheDocument();
  });
});
