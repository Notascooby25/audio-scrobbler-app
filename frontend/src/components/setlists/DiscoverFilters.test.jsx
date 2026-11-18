import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  vi.useRealTimers();
});

const SAVED = {
  scope: "my_artists",
  local_only_my_artists: false,
  date_window: "all",
  only_new: false,
  only_interested: false,
  country_code: "",
  my_artists_mode: "top_n",
  my_artists_limit: 100,
  my_artists_min_plays: 5,
  my_artists_months: 12,
  include_seen_live: true,
};

function gig(id, overrides = {}) {
  return {
    id,
    source: "skiddle",
    external_id: `sk-${id}`,
    artist_name: `Band ${id}`,
    attraction_names: [`Band ${id}`],
    event_name: `Band ${id} Live`,
    venue_name: "The Venue",
    city: "Coventry",
    country_code: "GB",
    event_date: "2027-01-01",
    event_time: "19:30",
    ticket_url: `https://www.skiddle.com/e/${id}/`,
    image_url: null,
    distance_miles: 3.2,
    is_my_artist: true,
    is_possible_match: false,
    is_seen_live: false,
    is_newly_announced: false,
    is_interested: false,
    already_going: false,
    concert_id: null,
    ...overrides,
  };
}

function response(items, overrides = {}) {
  return {
    configured: true,
    has_home_city: true,
    home_city: "Warwick",
    saved_radius_miles: 10,
    saved_filters: SAVED,
    countries: ["GB", "IE"],
    items,
    ...overrides,
  };
}

function renderTab() {
  return render(
    <MemoryRouter>
      <DiscoverGigsTab token="tok" onOpenGig={vi.fn()} onGigAdded={vi.fn()} />
    </MemoryRouter>
  );
}

const lastCall = () => setlistApi.fetchDiscoveredGigs.mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
  setlistApi.fetchDiscoveredGigs.mockResolvedValue(response([gig(1)]));
  setlistApi.saveGigDiscoverySettings.mockResolvedValue({});
});

describe("Discover filters", () => {
  it("shows where to look as a two-way switch with the current choice pressed", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");
    const group = screen.getByRole("group", { name: "Where to look" });
    expect(within(group).getByRole("button", { name: "My Artists" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const local = within(group).getByRole("button", { name: "Local Radar" });
    expect(local).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(local);
    await waitFor(() => expect(lastCall().scope).toBe("local"));
    expect(local).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the date window and the Only filters separate and combinable", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");
    fireEvent.click(screen.getByRole("button", { name: "Next 7 days" }));
    await waitFor(() => expect(lastCall().dateWindow).toBe("7d"));

    const only = screen.getByRole("group", { name: "Show only" });
    fireEvent.click(within(only).getByRole("button", { name: "Newly announced" }));
    await waitFor(() => expect(lastCall().onlyNew).toBe(true));
    expect(lastCall().dateWindow).toBe("7d");
    expect(within(only).getByRole("button", { name: "Newly announced" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Next 7 days" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("maps old saved 'newly announced' and 'interested' dates onto the Only filters", async () => {
    setlistApi.fetchDiscoveredGigs.mockResolvedValue(
      response([gig(1)], { saved_filters: { ...SAVED, date_window: "newly_announced" } })
    );
    renderTab();
    await screen.findByText("Band 1 Live");
    const only = screen.getByRole("group", { name: "Show only" });
    await waitFor(() =>
      expect(within(only).getByRole("button", { name: "Newly announced" })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    expect(screen.getByRole("button", { name: "Any time" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("says how many gigs it found and what for", async () => {
    setlistApi.fetchDiscoveredGigs.mockResolvedValue(response([gig(1)]));
    renderTab();
    expect(await screen.findByText("1 gig by your artists")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Local Radar" }));
    expect(await screen.findByText("1 gig within 10 miles of Warwick")).toBeInTheDocument();
  });

  it("names countries rather than showing codes", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");
    const select = screen.getByLabelText("Country");
    expect(within(select).getByRole("option", { name: "United Kingdom" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Ireland" })).toBeInTheDocument();
  });

  it("only offers Save as default once something differs from the saved settings", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");
    expect(screen.queryByRole("button", { name: /Save these as my default/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "This weekend" }));
    const save = await screen.findByRole("button", { name: /Save these as my default/i });
    fireEvent.click(save);
    await waitFor(() => expect(setlistApi.saveGigDiscoverySettings).toHaveBeenCalled());
    const payload = setlistApi.saveGigDiscoverySettings.mock.calls[0][0];
    expect(payload.gigDiscoveryFilters).toMatchObject({
      date_window: "weekend",
      only_new: false,
      only_interested: false,
    });
    expect(await screen.findByText("Saved as your default")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save these as my default/i })).toBeNull();
  });

  it("waits for a pause before searching on a new radius", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");
    fireEvent.click(screen.getByRole("button", { name: "Local Radar" }));
    await waitFor(() => expect(lastCall().scope).toBe("local"));
    vi.useFakeTimers();
    const calls = setlistApi.fetchDiscoveredGigs.mock.calls.length;

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.change(input, { target: { value: "25" } });
    expect(setlistApi.fetchDiscoveredGigs.mock.calls.length).toBe(calls);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(setlistApi.fetchDiscoveredGigs.mock.calls.length).toBe(calls + 1);
    expect(lastCall().radiusMiles).toBe(25);
  });

  it("ignores a slow, out-of-date answer when a newer search has finished", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");

    let resolveOld;
    let resolveNew;
    setlistApi.fetchDiscoveredGigs
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveNew = resolve)));

    fireEvent.click(screen.getByRole("button", { name: "Next 7 days" }));
    fireEvent.click(screen.getByRole("button", { name: "Next 30 days" }));
    await act(async () => {
      resolveNew(response([gig(2)]));
    });
    expect(await screen.findByText("Band 2 Live")).toBeInTheDocument();
    await act(async () => {
      resolveOld(response([gig(3)]));
    });
    expect(screen.queryByText("Band 3 Live")).toBeNull();
    expect(screen.getByText("Band 2 Live")).toBeInTheDocument();
  });

  it("keeps the current list on screen while a new search is running", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");
    setlistApi.fetchDiscoveredGigs.mockImplementationOnce(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "This weekend" }));
    expect(await screen.findByText("Updating...")).toBeInTheDocument();
    expect(screen.getByText("Band 1 Live")).toBeInTheDocument();
  });

  it("shows 20 gigs at a time with a Show more button", async () => {
    const many = Array.from({ length: 25 }, (_, i) => gig(i + 1));
    setlistApi.fetchDiscoveredGigs.mockResolvedValue(response(many));
    renderTab();
    await screen.findByText("Band 1 Live");
    expect(screen.getAllByRole("article")).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: /Show 5 more/i }));
    expect(screen.getAllByRole("article")).toHaveLength(25);
    expect(screen.queryByRole("button", { name: /Show .* more/i })).toBeNull();
  });

  it("explains the labels in a key, including Check line-up", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");
    const toggle = screen.getByRole("button", { name: /What do the labels mean/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/named in the event title, but not in the listed line-up/i)
    ).toBeInTheDocument();
  });

  it("folds the filters behind a summary button on small screens", async () => {
    renderTab();
    await screen.findByText("Band 1 Live");
    const toggle = screen.getByRole("button", { name: /Filters/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("My Artists · Any time");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("does not repeat the artist name when the title already has it", async () => {
    setlistApi.fetchDiscoveredGigs.mockResolvedValue(
      response([gig(1, { event_name: "Band 1", artist_name: "Band 1" })])
    );
    renderTab();
    await screen.findByText("Band 1");
    expect(screen.getAllByText("Band 1")).toHaveLength(1);
  });

  it("announces errors", async () => {
    setlistApi.fetchDiscoveredGigs.mockRejectedValue(new Error("boom"));
    renderTab();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
