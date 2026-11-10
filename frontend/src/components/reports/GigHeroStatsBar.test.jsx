import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import GigHeroStatsBar from "./GigHeroStatsBar";

afterEach(() => cleanup());

describe("GigHeroStatsBar", () => {
  it("renders gigs count, travel distance, and active streak", () => {
    render(
      <GigHeroStatsBar
        totalGigs={42}
        totalFestivals={5}
        yearsActive={7}
        travelStats={{
          home_set: true,
          total_distance_km: 7750,
          active_streak_months: 6,
        }}
        badgeCount={8}
      />
    );

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/Gigs logged/i)).toBeInTheDocument();
    expect(screen.getByText(/6-mo active streak/i)).toBeInTheDocument();
    expect(screen.getByText("4,816")).toBeInTheDocument(); // 7750 km * 0.621371 = 4816 miles
    expect(screen.getByText(/Total travel logged/i)).toBeInTheDocument();
  });

  it("handles missing home city gracefully", () => {
    render(
      <MemoryRouter>
        <GigHeroStatsBar
          totalGigs={12}
          totalFestivals={2}
          yearsActive={3}
          travelStats={{
            home_set: false,
            total_distance_km: 0,
            active_streak_months: 0,
          }}
          badgeCount={2}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/Set home city/i)).toBeInTheDocument();
  });
});
