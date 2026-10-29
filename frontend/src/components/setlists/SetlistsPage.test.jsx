import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SetlistsPage from "./SetlistsPage";
import * as setlistsApi from "../../api/setlists";

vi.mock("../../api/setlists", () => ({
  searchSetlists: vi.fn(),
  fetchVenueSupportActs: vi.fn(),
  logConcertAttendance: vi.fn(),
  logManualConcert: vi.fn(),
  fetchAttendances: vi.fn().mockResolvedValue([]),
  deleteAttendance: vi.fn().mockResolvedValue({ deleted_count: 1 }),
  refreshConcertSetlist: vi.fn().mockResolvedValue({}),
  fetchArtistsSeenLeaderboard: vi.fn().mockResolvedValue([]),
  fetchSongsHeardLeaderboard: vi.fn().mockResolvedValue([]),
  fetchVenuesVisitedLeaderboard: vi.fn().mockResolvedValue([]),
  fetchSetlistStatus: vi
    .fn()
    .mockResolvedValue({ configured: true, daily_quota: 1400, daily_count: 0 }),
}));

vi.mock("../../session", () => ({
  readSession: () => ({ accessToken: "test-token" }),
}));

describe("SetlistsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders tabs and switches to Log a Gig tab", async () => {
    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: /my gigs/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /artists seen/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /songs heard/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /venues/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ log a gig/i })).toBeInTheDocument();

    // Switch to Log a Gig tab
    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));
    expect(screen.getByPlaceholderText(/search artist/i)).toBeInTheDocument();
  });

  it("opens the tab named in the ?tab= query string", async () => {
    render(
      <MemoryRouter initialEntries={["/setlists?tab=venues"]}>
        <SetlistsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: /venues/i })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(setlistsApi.fetchVenuesVisitedLeaderboard).toHaveBeenCalled());
    expect(setlistsApi.fetchAttendances).not.toHaveBeenCalled();
  });

  it('performs gig search and displays results with "I WAS THERE" button', async () => {
    setlistsApi.searchSetlists.mockResolvedValueOnce({
      total: 1,
      setlist: [
        {
          id: "foo_anfield_2026",
          artist: { name: "Foo Fighters" },
          venue: {
            id: "v123",
            name: "Anfield",
            city: { name: "Liverpool", country: { name: "United Kingdom" } },
          },
          eventDate: "27-06-2026",
          tour: { name: "Take Cover" },
          sets: { set: [{ song: [{ name: "All My Life" }, { name: "Everlong" }] }] },
        },
      ],
    });

    setlistsApi.fetchVenueSupportActs.mockResolvedValueOnce([
      {
        id: "supp_die_spitz",
        artist: { name: "Die Spitz" },
        venue: { name: "Anfield" },
        eventDate: "27-06-2026",
        sets: { set: [{ song: [{ name: "Hair of Dog" }] }] },
      },
    ]);

    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));

    const searchInput = screen.getByPlaceholderText(/search artist/i);
    fireEvent.change(searchInput, { target: { value: "Foo Fighters" } });

    const searchBtn = screen.getByRole("button", { name: /^search$/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/foo fighters at anfield/i)).toBeInTheDocument();
    });

    // Click "I WAS THERE"
    const wasThereBtn = screen.getByRole("button", { name: /i was there/i });
    fireEvent.click(wasThereBtn);

    // Support acts modal opens
    await waitFor(() => {
      expect(screen.getByText(/did you catch any support bands/i)).toBeInTheDocument();
      expect(screen.getByText("Die Spitz")).toBeInTheDocument();
    });
  });

  it("renders Setlist.fm attribution link complying with Terms of Service", () => {
    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    const attributionLink = screen.getByRole("link", { name: "setlist.fm" });
    expect(attributionLink).toBeInTheDocument();
    expect(attributionLink).toHaveAttribute("href", "https://www.setlist.fm");

    const termsLink = screen.getByRole("link", { name: "Terms of Service" });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute("href", "https://www.setlist.fm/help/terms");
  });

  it("renders warning banner when Setlist.fm API key is not configured", async () => {
    setlistsApi.fetchSetlistStatus.mockResolvedValueOnce({
      configured: false,
      daily_quota: 1400,
      daily_count: 0,
    });
    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("unconfigured-warning")).toBeInTheDocument();
      expect(screen.getByText(/Setlist.fm API key is not detected/i)).toBeInTheDocument();
    });
  });

  it("shows explicit empty state feedback when concert search yields 0 matches", async () => {
    setlistsApi.searchSetlists.mockResolvedValueOnce({ total: 0, setlist: [] });

    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));

    const searchInput = screen.getByPlaceholderText(/search artist/i);
    fireEvent.change(searchInput, { target: { value: "Unknown Band" } });

    const searchBtn = screen.getByRole("button", { name: /^search$/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText(/No concerts found matching/i)).toBeInTheDocument();
      expect(screen.getByText(/Unknown Band/i)).toBeInTheDocument();
    });
  });

  it("passes month filter to searchSetlists API", async () => {
    setlistsApi.searchSetlists.mockResolvedValueOnce({ total: 0, setlist: [] });

    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));

    const artistInput = screen.getByPlaceholderText(/search artist/i);
    fireEvent.change(artistInput, { target: { value: "Public Service Broadcasting" } });

    // Select Month November (value "11")
    const monthSelect = screen.getByRole("combobox", { name: /month/i });
    fireEvent.change(monthSelect, { target: { value: "11" } });

    const searchBtn = screen.getByRole("button", { name: /^search$/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(setlistsApi.searchSetlists).toHaveBeenCalledWith(
        expect.objectContaining({
          artistName: "Public Service Broadcasting",
          month: 11,
          p: 1,
        })
      );
    });
  });

  it("groups search results into Upcoming Shows and Past Shows with View More Shows pagination", async () => {
    setlistsApi.searchSetlists.mockResolvedValueOnce({
      total: 25,
      setlist: [
        {
          id: "psb_future_1",
          artist: { name: "Public Service Broadcasting" },
          venue: { name: "Alexandra Palace", city: { name: "London" } },
          eventDate: "15-11-2026",
          sets: { set: [] },
        },
        {
          id: "psb_past_1",
          artist: { name: "Public Service Broadcasting" },
          venue: { name: "Brixton Academy", city: { name: "London" } },
          eventDate: "10-10-2023",
          sets: { set: [{ song: [{ name: "Spitfire" }] }] },
        },
      ],
    });

    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));

    const artistInput = screen.getByPlaceholderText(/search artist/i);
    fireEvent.change(artistInput, { target: { value: "Public Service Broadcasting" } });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByText(/upcoming shows/i)).toBeInTheDocument();
      expect(screen.getByText(/past shows/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /view more shows \(\+20\)/i })).toBeInTheDocument();
    });

    // Test clicking pagination "View More Shows (+20)"
    setlistsApi.searchSetlists.mockResolvedValueOnce({
      total: 25,
      setlist: [
        {
          id: "psb_past_2",
          artist: { name: "Public Service Broadcasting" },
          venue: { name: "Roundhouse", city: { name: "London" } },
          eventDate: "12-10-2023",
          sets: { set: [{ song: [{ name: "Gagarin" }] }] },
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /view more shows \(\+20\)/i }));

    await waitFor(() => {
      expect(setlistsApi.searchSetlists).toHaveBeenCalledWith(
        expect.objectContaining({
          artistName: "Public Service Broadcasting",
          p: 2,
        })
      );
      expect(screen.getByText(/Public Service Broadcasting at Roundhouse/i)).toBeInTheDocument();
    });
  });

  it("expands a search result's songs in place", async () => {
    setlistsApi.searchSetlists.mockResolvedValueOnce({
      total: 1,
      setlist: [
        {
          id: "psb_gig_1",
          artist: { name: "Public Service Broadcasting" },
          venue: { name: "Alexandra Palace", city: { name: "London" } },
          eventDate: "10-10-2023",
          sets: {
            set: [
              {
                name: "Main Set",
                song: [{ name: "Spitfire" }, { name: "Theme from PSB" }],
              },
            ],
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));
    fireEvent.change(screen.getByPlaceholderText(/search artist/i), {
      target: { value: "Public Service Broadcasting" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Public Service Broadcasting at Alexandra Palace/i)
      ).toBeInTheDocument();
    });

    // The result title expands the songs inline
    fireEvent.click(
      screen.getByRole("button", { name: /Public Service Broadcasting at Alexandra Palace/i })
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Main Set" })).toBeInTheDocument();
      expect(screen.getByText("Spitfire")).toBeInTheDocument();
      expect(screen.getByText("Theme from PSB")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /hide songs/i })).toBeInTheDocument();
    });
  });

  it("opens a gig's setlist page from My Gigs", async () => {
    setlistsApi.fetchAttendances.mockResolvedValueOnce([
      {
        id: 77,
        setlist_id: "psb_brixton",
        artist_name: "Public Service Broadcasting",
        venue_name: "Brixton Academy",
        city: "London",
        country: "United Kingdom",
        event_date: "2025-05-10T20:00:00",
        song_count: 12,
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/setlists"]}>
        <Routes>
          <Route path="/setlists" element={<SetlistsPage />} />
          <Route path="/gigs/:concertId" element={<div>Gig page for concert</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Brixton Academy, London/i)).toBeInTheDocument();
    // No per-row Refresh/Delete buttons any more; those live on the gig page
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Public Service Broadcasting" }));
    expect(await screen.findByText("Gig page for concert")).toBeInTheDocument();
  });

  it("handles direct Setlist.fm URL or ID search in GigSearchBar", async () => {
    setlistsApi.searchSetlists.mockResolvedValueOnce({
      total: 1,
      setlist: [
        {
          id: "334a28f1",
          artist: { name: "Shed Seven" },
          venue: {
            name: "O2 Academy Birmingham",
            city: { name: "Birmingham", country: { name: "United Kingdom" } },
          },
          eventDate: "14-11-2026",
          sets: { set: [] },
        },
      ],
    });

    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    // Switch to Log a Gig
    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));

    const artistInput = screen.getByPlaceholderText(/search artist or paste setlist\.fm link/i);
    fireEvent.change(artistInput, {
      target: {
        value: "https://www.setlist.fm/show/2026-11-14/o2-academy-birmingham-england-334a28f1.html",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(setlistsApi.searchSetlists).toHaveBeenCalledWith(
        expect.objectContaining({
          setlistUrlOrId:
            "https://www.setlist.fm/show/2026-11-14/o2-academy-birmingham-england-334a28f1.html",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/O2 Academy Birmingham/i)).toBeInTheDocument();
    });
  });

  it("opens manual concert modal and logs an upcoming gig", async () => {
    setlistsApi.logManualConcert.mockResolvedValueOnce({
      id: 99,
      setlist_id: "manual-abc123",
      artist_name: "Shed Seven",
      venue_name: "O2 Academy Birmingham",
      city: "Birmingham",
      country: "United Kingdom",
      event_date: "2026-11-14T00:00:00",
      notes: "Balcony seats booked",
      song_count: 0,
    });

    render(
      <MemoryRouter>
        <SetlistsPage />
      </MemoryRouter>
    );

    // Switch to Log a Gig
    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));

    // Click "+ Add Upcoming Show Manually"
    const addManualBtn = screen.getByRole("button", { name: /\+ add upcoming show manually/i });
    fireEvent.click(addManualBtn);

    expect(screen.getByText(/Log Upcoming or Custom Gig/i)).toBeInTheDocument();

    // Fill in required fields
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Shed Seven/i), {
      target: { value: "Shed Seven" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. O2 Academy Birmingham/i), {
      target: { value: "O2 Academy Birmingham" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Birmingham/i), {
      target: { value: "Birmingham" },
    });
    fireEvent.change(screen.getByLabelText(/event date/i), {
      target: { value: "2026-11-14" },
    });

    // Submit modal
    const saveBtn = screen.getByRole("button", { name: /log concert/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(setlistsApi.logManualConcert).toHaveBeenCalledWith(
        expect.objectContaining({
          artistName: "Shed Seven",
          venueName: "O2 Academy Birmingham",
          city: "Birmingham",
          eventDate: "2026-11-14",
        })
      );
    });
  });
});
