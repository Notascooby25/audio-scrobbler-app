import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SetlistsPage from "./SetlistsPage";
import * as setlistsApi from "../../api/setlists";

vi.mock("../../api/setlists", () => ({
  searchSetlists: vi.fn(),
  fetchVenueSupportActs: vi.fn(),
  logConcertAttendance: vi.fn(),
  fetchAttendances: vi.fn().mockResolvedValue([]),
  fetchArtistsSeenLeaderboard: vi.fn().mockResolvedValue([]),
  fetchSongsHeardLeaderboard: vi.fn().mockResolvedValue([]),
  fetchVenuesVisitedLeaderboard: vi.fn().mockResolvedValue([]),
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

    expect(screen.getByRole("button", { name: /my gigs/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /artists seen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /songs heard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /venues/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ log a gig/i })).toBeInTheDocument();

    // Switch to Log a Gig tab
    fireEvent.click(screen.getByRole("button", { name: /\+ log a gig/i }));
    expect(screen.getByPlaceholderText(/search artist/i)).toBeInTheDocument();
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
});
