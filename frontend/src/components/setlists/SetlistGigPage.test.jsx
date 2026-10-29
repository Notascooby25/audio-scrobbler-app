import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import SetlistGigPage from "./SetlistGigPage";
import * as setlistsApi from "../../api/setlists";

vi.mock("../../api/setlists", () => ({
  fetchAttendance: vi.fn(),
  fetchSetlistDetail: vi.fn(),
  refreshConcertSetlist: vi.fn(),
  deleteAttendance: vi.fn().mockResolvedValue({ deleted_count: 1 }),
  updateConcertNotes: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../session", () => ({
  readSession: () => ({ accessToken: "test-token" }),
}));

const gig = {
  id: 12,
  setlist_id: "63de4613",
  artist_name: "Bombay Bicycle Club",
  venue_name: "Cambridge Corn Exchange",
  city: "Cambridge",
  country: "England",
  event_date: "2024-02-10T20:00:00",
  tour_name: "My Big Day",
  is_support_act: false,
  setlist_url: "https://www.setlist.fm/setlist/bombay-bicycle-club/2024/x.html",
  notes: "Went with Sam.",
  raw_data: {
    sets: {
      set: [
        {
          song: [
            { name: "Just a Little More Time" },
            { name: "Intro", tape: true },
            { name: "Lose You to Love Me", cover: { name: "Selena Gomez" } },
          ],
        },
        { encore: 1, song: [{ name: "Always Like This" }] },
      ],
    },
  },
};

function ListPage() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/gigs/12")}>
      Open gig
    </button>
  );
}

function renderGigPage(initialEntries = ["/gigs/12"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/setlists" element={<ListPage />} />
        <Route path="/gigs/:concertId" element={<SetlistGigPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SetlistGigPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the setlist.fm-style header, numbered songs and notes", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    renderGigPage();

    expect(
      await screen.findByRole("heading", { name: "Bombay Bicycle Club Setlist" })
    ).toBeInTheDocument();
    expect(setlistsApi.fetchAttendance).toHaveBeenCalledWith({
      token: "test-token",
      concertId: "12",
    });
    expect(screen.getByLabelText("10 FEB 2024")).toBeInTheDocument();
    expect(screen.getByText(/at Cambridge Corn Exchange, Cambridge, England/)).toBeInTheDocument();
    expect(screen.getByText("Tour: My Big Day")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Setlist (3 songs)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Encore" })).toBeInTheDocument();
    expect(screen.getByText("(Selena Gomez cover)")).toBeInTheDocument();

    const numbers = [...document.querySelectorAll(".sfm-song-no")].map((el) => el.textContent);
    expect(numbers).toEqual(["1.", "", "2.", "3."]);
    expect(screen.getByText("Went with Sam.")).toBeInTheDocument();
    expect(setlistsApi.fetchSetlistDetail).not.toHaveBeenCalled();
  });

  it("goes back to the list it came from", async () => {
    setlistsApi.fetchAttendance.mockResolvedValue(gig);
    renderGigPage(["/setlists"]);

    fireEvent.click(screen.getByRole("button", { name: "Open gig" }));
    fireEvent.click(await screen.findByRole("button", { name: /back/i }));
    expect(await screen.findByRole("button", { name: "Open gig" })).toBeInTheDocument();
  });

  it("saves edited notes", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    renderGigPage();

    fireEvent.click(await screen.findByRole("button", { name: "Edit note" }));
    fireEvent.change(screen.getByLabelText("Gig notes"), {
      target: { value: "Front row, got a setlist." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() =>
      expect(setlistsApi.updateConcertNotes).toHaveBeenCalledWith({
        token: "test-token",
        concertId: 12,
        notes: "Front row, got a setlist.",
      })
    );
    expect(await screen.findByText("Front row, got a setlist.")).toBeInTheDocument();
  });

  it("deletes the gig after confirmation and leaves the page", async () => {
    setlistsApi.fetchAttendance.mockResolvedValue(gig);
    renderGigPage(["/setlists"]);
    fireEvent.click(screen.getByRole("button", { name: "Open gig" }));

    fireEvent.click(await screen.findByRole("button", { name: "Delete gig" }));
    fireEvent.click(screen.getByLabelText(/also delete support acts/i));
    fireEvent.click(screen.getByRole("button", { name: "Delete Gig" }));

    await waitFor(() =>
      expect(setlistsApi.deleteAttendance).toHaveBeenCalledWith({
        token: "test-token",
        concertId: 12,
        includeSupportActs: false,
      })
    );
    expect(await screen.findByRole("button", { name: "Open gig" })).toBeInTheDocument();
  });

  it("hides refresh for manual gigs and explains a missing upcoming setlist", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce({
      ...gig,
      setlist_id: "manual-abc123",
      event_date: "2099-11-14T20:00:00",
      raw_data: { is_manual: true },
      notes: null,
    });
    renderGigPage();

    expect(await screen.findByText(/No setlist yet/i)).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refresh/i })).not.toBeInTheDocument();
  });

  it("shows an error when the gig can't be loaded", async () => {
    setlistsApi.fetchAttendance.mockRejectedValueOnce(new Error("Gig not found."));
    renderGigPage();
    expect(await screen.findByText("Gig not found.")).toBeInTheDocument();
  });

  it("never renders a non-http link from stored gig data", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce({
      ...gig,
      setlist_url: "javascript:alert(1)",
      raw_data: { ...gig.raw_data, url: "javascript:alert(2)" },
    });
    renderGigPage();

    await screen.findByRole("heading", { name: "Bombay Bicycle Club Setlist" });
    expect(screen.queryByRole("link", { name: /view on setlist\.fm/i })).not.toBeInTheDocument();
  });
});
