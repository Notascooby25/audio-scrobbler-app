import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getAllByText(/Home: Leeds/i)[0]).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Manchester Academy \(5 gigs\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    // No international pins, so no zoom toggle
    expect(screen.queryByRole("button", { name: /Zoom out/i })).not.toBeInTheDocument();
  });

  it("defaults to UK focus and displays zoom toggle when international gigs exist", () => {
    const pinsWithAbroad = [
      {
        lat: 53.4808,
        lng: -2.2426,
        venue_name: "Manchester Academy",
        city: "Manchester",
        country: "United Kingdom",
        gig_count: 5,
        artists: ["Fontaines D.C."],
      },
      {
        lat: 36.1699,
        lng: -115.1398,
        venue_name: "Zappos Theater",
        city: "Las Vegas",
        country: "United States",
        gig_count: 1,
        artists: ["Gwen Stefani"],
      },
    ];

    const { getByRole, queryByRole } = render(
      <GigOdysseyMap
        homeSet={true}
        homeCity="Leeds"
        homeCoords={[53.8008, -1.5491]}
        pins={pinsWithAbroad}
      />
    );

    // In UK focus mode, only UK pin is visible on the stage, and zoom toggle shows
    const zoomToggle = getByRole("button", { name: /1 gig abroad.*Zoom out/i });
    expect(zoomToggle).toBeInTheDocument();
    expect(getByRole("button", { name: /Manchester Academy/i })).toBeInTheDocument();
    expect(queryByRole("button", { name: /Zappos Theater/i })).not.toBeInTheDocument();

    // Click zoom out to enter World view
    fireEvent.click(zoomToggle);
    expect(getByRole("button", { name: /Focus UK/i })).toBeInTheDocument();
    expect(getByRole("button", { name: /Zappos Theater/i })).toBeInTheDocument();
  });

  it("toggles festival venues on and off when festival pins exist", () => {
    const pinsWithFestival = [
      {
        lat: 53.4808,
        lng: -2.2426,
        venue_name: "Manchester Academy",
        city: "Manchester",
        country: "United Kingdom",
        gig_count: 5,
        is_festival: false,
        artists: ["Fontaines D.C."],
      },
      {
        lat: 50.785,
        lng: -1.09,
        venue_name: "Southsea Common",
        city: "Portsmouth",
        country: "United Kingdom",
        gig_count: 42,
        is_festival: true,
        artists: ["Various Artists"],
      },
    ];

    render(
      <GigOdysseyMap
        homeSet={true}
        homeCity="Warwick"
        homeCoords={[52.28, -1.58]}
        pins={pinsWithFestival}
      />
    );

    const festivalToggle = screen.getByRole("button", { name: /Festivals on/i });
    expect(festivalToggle).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Southsea Common/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manchester Academy/i })).toBeInTheDocument();

    // Toggle festivals off
    fireEvent.click(festivalToggle);
    expect(screen.getByRole("button", { name: /Festivals off/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Southsea Common/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manchester Academy/i })).toBeInTheDocument();

    // Toggle festivals back on
    fireEvent.click(screen.getByRole("button", { name: /Festivals off/i }));
    expect(screen.getByRole("button", { name: /Southsea Common/i })).toBeInTheDocument();
  });
});
