import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import GigOdysseyMap from "./GigOdysseyMap";

afterEach(() => cleanup());

describe("GigOdysseyMap", () => {
  it("renders empty state notice when home city is not configured", () => {
    render(
      <MemoryRouter>
        <GigOdysseyMap homeSet={false} pins={[]} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Set your home city in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("renders map container with home city and pin markers when home city is set", () => {
    const samplePins = [
      {
        lat: 53.4808,
        lng: -2.2426,
        venue_name: "Manchester Academy",
        city: "Manchester",
        country: "United Kingdom",
        gig_count: 5,
        artists: ["Fontaines D.C.", "IDLES"],
      },
    ];

    render(
      <GigOdysseyMap
        homeSet={true}
        homeCity="Leeds"
        homeCoords={[53.8008, -1.5491]}
        pins={samplePins}
      />
    );

    expect(screen.getByText(/Gig Odyssey Map/i)).toBeInTheDocument();
    expect(screen.getByText(/Home: Leeds/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Manchester Academy \(5 gigs\)/i)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
