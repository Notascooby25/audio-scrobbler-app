import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as setlistApi from "../../api/setlists";
import DiscoverGigsTab from "./DiscoverGigsTab";

vi.mock("../../api/setlists", async () => {
  const actual = await vi.importActual("../../api/setlists");
  return {
    ...actual,
    fetchDiscoveredGigs: vi.fn(),
    toggleDiscoveredGigInterest: vi.fn(),
    attendDiscoveredGig: vi.fn(),
    saveGigDiscoverySettings: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
});

const SAMPLE_RESPONSE = {
  configured: true,
  has_home_city: true,
  home_city: "London, UK",
  saved_radius_miles: 6,
  saved_filters: {
    scope: "my_artists",
    local_only_my_artists: false,
    date_window: "all",
    country_code: "",
    my_artists_mode: "top_n",
    my_artists_limit: 100,
    my_artists_min_plays: 5,
    my_artists_months: 12,
    include_seen_live: true,
  },
  countries: ["GB", "US"],
  items: [
    {
      id: 11,
      source: "ticketmaster",
      external_id: "tm-11",
      artist_name: "Fontaines D.C.",
      attraction_names: ["Fontaines D.C."],
      event_name: "Fontaines D.C. Live",
      venue_name: "Brixton Academy",
      city: "London",
      country_code: "GB",
      event_date: "2026-12-01",
      event_time: "19:30",
      ticket_url: "https://ticketmaster.co.uk/tm-11",
      image_url: null,
      distance_miles: 3.4,
      is_my_artist: true,
      is_seen_live: true,
      is_newly_announced: true,
      is_interested: false,
      already_going: false,
      concert_id: null,
    },
  ],
};

describe("DiscoverGigsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setlistApi.fetchDiscoveredGigs.mockResolvedValue(SAMPLE_RESPONSE);
    setlistApi.toggleDiscoveredGigInterest.mockResolvedValue({ gig_id: 11, is_interested: true });
    setlistApi.attendDiscoveredGig.mockResolvedValue({
      concert_id: 501,
      artist_name: "Fontaines D.C.",
      event_date: "2026-12-01",
    });
    setlistApi.saveGigDiscoverySettings.mockResolvedValue({ local_gig_radius_miles: 6 });
  });

  it("renders filters, badges, and supports I'm interested and + I'm going", async () => {
    const onOpenGig = vi.fn();
    const onGigAdded = vi.fn();
    render(
      <MemoryRouter>
        <DiscoverGigsTab token="tok" onOpenGig={onOpenGig} onGigAdded={onGigAdded} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Fontaines D.C. Live")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Newly announced").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Your artist")).toBeInTheDocument();
    expect(screen.getByText("Seen live")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I'm interested" }));
    await waitFor(() => {
      expect(setlistApi.toggleDiscoveredGigInterest).toHaveBeenCalledWith({
        token: "tok",
        gigId: 11,
        interested: true,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "+ I'm going" }));
    await waitFor(() => {
      expect(setlistApi.attendDiscoveredGig).toHaveBeenCalledWith({
        token: "tok",
        gigId: 11,
      });
    });
    expect(onGigAdded).toHaveBeenCalled();
  });

  it("opens criteria settings cog with min_plays option and saves", async () => {
    render(
      <MemoryRouter>
        <DiscoverGigsTab token="tok" onOpenGig={vi.fn()} onGigAdded={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Fontaines D.C. Live")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Artist criteria settings/i }));
    expect(screen.getByText(/Played at least X times/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Played at least X times/i));
    fireEvent.click(screen.getByRole("button", { name: "Save criteria" }));

    await waitFor(() => {
      expect(setlistApi.saveGigDiscoverySettings).toHaveBeenCalled();
    });
  });

  it("renders setup notice when Ticketmaster key is not configured", async () => {
    setlistApi.fetchDiscoveredGigs.mockResolvedValue({
      ...SAMPLE_RESPONSE,
      configured: false,
      items: [],
    });

    render(
      <MemoryRouter>
        <DiscoverGigsTab token="tok" onOpenGig={vi.fn()} onGigAdded={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/TICKETMASTER_API_KEY/i)).toBeInTheDocument();
    });
  });
});
