import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  updateConcert: vi.fn(),
  fetchGigCompanions: vi.fn().mockResolvedValue({ companions: [], following: [] }),
  addGigCompanions: vi.fn(),
  removeGigCompanion: vi.fn().mockResolvedValue(null),
  fetchGigBill: vi.fn().mockResolvedValue({ acts: [], complete: true, capped: false }),
  logBillAct: vi.fn(),
  addFriendsGig: vi.fn(),
  alreadyLoggedInfo: (err) =>
    err?.status === 409 && err?.detail?.code === "already_logged" ? err.detail : null,
}));

vi.mock("../../api", () => ({
  fetchUserProfile: vi.fn().mockResolvedValue({ id: 2, username: "sam" }),
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

  it("edits the gig's details and shows them straight away", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    setlistsApi.updateConcert.mockResolvedValueOnce({
      ...gig,
      venue_name: "Junction",
      event_date: "2024-02-11T00:00:00",
    });
    renderGigPage();

    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    const dialog = screen.getByRole("dialog", { name: "Edit gig details" });
    expect(within(dialog).getByLabelText("Date *")).toHaveValue("2024-02-10");
    fireEvent.change(within(dialog).getByLabelText("Venue *"), { target: { value: "Junction" } });
    fireEvent.change(within(dialog).getByLabelText("Date *"), { target: { value: "2024-02-11" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(setlistsApi.updateConcert).toHaveBeenCalledWith({
        token: "test-token",
        concertId: 12,
        artistName: "Bombay Bicycle Club",
        venueName: "Junction",
        city: "Cambridge",
        country: "England",
        eventDate: "2024-02-11",
        tourName: "My Big Day",
        allowDuplicate: false,
      })
    );
    expect(await screen.findByText("Gig details saved.")).toBeInTheDocument();
    expect(screen.getByText(/at Junction, Cambridge, England/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit gig details" })).not.toBeInTheDocument();
  });

  it("asks before saving an edit that clashes with another gig", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    const clash = Object.assign(new Error("HTTP 409: Gig already logged."), {
      status: 409,
      detail: {
        code: "already_logged",
        same_show: false,
        existing: {
          id: 99,
          artist_name: "Bombay Bicycle Club",
          venue_name: "Junction",
          city: "Cambridge",
          event_date: "2024-02-11T00:00:00",
        },
      },
    });
    setlistsApi.updateConcert.mockRejectedValueOnce(clash).mockResolvedValueOnce(gig);
    renderGigPage();

    fireEvent.click(await screen.findByRole("button", { name: "Edit details" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const ask = await screen.findByRole("alertdialog", { name: "Gig already logged" });
    expect(within(ask).getByText(/Save your changes anyway\?/)).toBeInTheDocument();
    fireEvent.click(within(ask).getByRole("button", { name: "Save anyway" }));

    await waitFor(() =>
      expect(setlistsApi.updateConcert).toHaveBeenLastCalledWith(
        expect.objectContaining({ allowDuplicate: true })
      )
    );
  });

  it("adds people you follow to the gig, with ones who logged it first", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    setlistsApi.fetchGigCompanions.mockResolvedValueOnce({
      companions: [{ user_id: 3, username: "jo", display_name: "Jo", status: "added" }],
      following: [
        { user_id: 2, username: "sam", display_name: "Sam", logged_it: false },
        { user_id: 4, username: "kit", display_name: "Kit", logged_it: true },
      ],
    });
    setlistsApi.addGigCompanions.mockResolvedValueOnce({
      companions: [
        { user_id: 3, username: "jo", display_name: "Jo", status: "added" },
        { user_id: 2, username: "sam", display_name: "Sam", status: "pending" },
      ],
      following: [{ user_id: 4, username: "kit", display_name: "Kit", logged_it: true }],
    });
    renderGigPage();

    const section = (await screen.findByRole("heading", { name: "Went with" })).closest("section");
    expect(within(section).getByText("✓ Added it")).toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "+ Add people" }));
    expect(within(section).getByText("Logged this gig")).toBeInTheDocument();
    fireEvent.click(within(section).getByLabelText("Sam"));
    fireEvent.click(within(section).getByRole("button", { name: "Add (1)" }));

    await waitFor(() =>
      expect(setlistsApi.addGigCompanions).toHaveBeenCalledWith({
        token: "test-token",
        concertId: 12,
        friendIds: [2],
      })
    );
    expect(await within(section).findByText("Invited")).toBeInTheDocument();
    fireEvent.click(within(section).getByRole("button", { name: "Remove Sam" }));
    await waitFor(() =>
      expect(setlistsApi.removeGigCompanion).toHaveBeenCalledWith({
        token: "test-token",
        concertId: 12,
        friendId: 2,
      })
    );
    expect(within(section).queryByText("Invited")).not.toBeInTheDocument();
  });

  it("hides Went with if it can't load", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    setlistsApi.fetchGigCompanions.mockRejectedValueOnce(new Error("boom"));
    renderGigPage();

    expect(await screen.findByText("Bombay Bicycle Club Setlist")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Went with" })).not.toBeInTheDocument()
    );
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

  it("shows who else was on the bill and logs one with I was there", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    setlistsApi.fetchGigBill.mockResolvedValueOnce({
      acts: [
        {
          setlist_id: "sp_1",
          artist_name: "Royel Otis",
          logged: true,
          concert_id: 40,
          role: "support",
        },
        {
          setlist_id: "sp_2",
          artist_name: "Die Spitz",
          logged: false,
          concert_id: null,
          role: null,
        },
      ],
      complete: true,
      capped: false,
    });
    setlistsApi.logBillAct.mockResolvedValueOnce({ id: 41, is_support_act: true });
    renderGigPage();

    expect(await screen.findByRole("heading", { name: "On the bill" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Royel Otis" })).toHaveAttribute("href", "/gigs/40");
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getAllByText("✓ I was there")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "I was there for Die Spitz" }));
    await waitFor(() =>
      expect(setlistsApi.logBillAct).toHaveBeenCalledWith({
        token: "test-token",
        concertId: 12,
        setlistId: "sp_2",
      })
    );
    expect(await screen.findByRole("link", { name: "Die Spitz" })).toHaveAttribute(
      "href",
      "/gigs/41"
    );
    expect(screen.getAllByText("✓ I was there")).toHaveLength(2);

    // A just-logged act can be undone from the same row
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(setlistsApi.deleteAttendance).toHaveBeenCalledWith({
        token: "test-token",
        concertId: 41,
        includeSupportActs: false,
      })
    );
    expect(
      await screen.findByRole("button", { name: "I was there for Die Spitz" })
    ).toBeInTheDocument();
  });

  it("hides the bill when nobody else played and notes when it may be incomplete", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    renderGigPage();
    await screen.findByRole("heading", { name: "Bombay Bicycle Club Setlist" });
    await waitFor(() => expect(setlistsApi.fetchGigBill).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "On the bill" })).not.toBeInTheDocument();

    cleanup();
    setlistsApi.fetchAttendance.mockResolvedValueOnce(gig);
    setlistsApi.fetchGigBill.mockResolvedValueOnce({ acts: [], complete: false, capped: false });
    renderGigPage();
    expect(await screen.findByText(/may be incomplete/i)).toBeInTheDocument();
  });

  it("shows a followed person's gig read-only and adds it to yours", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce({ ...gig, notes: null });
    setlistsApi.fetchGigBill.mockResolvedValueOnce({
      acts: [
        {
          setlist_id: "s1",
          artist_name: "Pip Blom",
          logged: true,
          concert_id: 13,
          role: "support",
        },
        { setlist_id: "s2", artist_name: "Die Spitz", logged: false, concert_id: null, role: null },
      ],
      complete: true,
      capped: false,
    });
    setlistsApi.addFriendsGig.mockResolvedValueOnce({ id: 501 });
    renderGigPage(["/gigs/12?userId=2"]);

    await screen.findByRole("heading", { name: "Bombay Bicycle Club Setlist" });
    expect(setlistsApi.fetchAttendance).toHaveBeenCalledWith({
      token: "test-token",
      concertId: "12",
      userId: 2,
    });
    expect(await screen.findByText("From @sam's gigs")).toBeInTheDocument();
    for (const name of [/refresh from setlist\.fm/i, /edit details/i, /delete gig/i, /add note/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("heading", { name: "My notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Went with" })).not.toBeInTheDocument();
    expect(setlistsApi.fetchGigCompanions).not.toHaveBeenCalled();

    // Their bill is read-only and links stay on their gigs
    expect(await screen.findByRole("link", { name: "Pip Blom" })).toHaveAttribute(
      "href",
      "/gigs/13?userId=2"
    );
    expect(screen.getByText("✓ Saw them")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I was there for Die Spitz" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ I was there too" }));
    expect(await screen.findByText(/Added to your gigs\./)).toBeInTheDocument();
    expect(setlistsApi.addFriendsGig).toHaveBeenCalledWith({
      token: "test-token",
      concertId: 12,
      userId: 2,
    });
    expect(screen.getByRole("link", { name: "View your gig" })).toHaveAttribute(
      "href",
      "/gigs/501"
    );
    expect(screen.queryByRole("button", { name: "+ I was there too" })).not.toBeInTheDocument();
  });

  it("says so when you already logged a friend's gig", async () => {
    setlistsApi.fetchAttendance.mockResolvedValueOnce({ ...gig, notes: null });
    setlistsApi.addFriendsGig.mockRejectedValueOnce(
      Object.assign(new Error("HTTP 409: Gig already logged."), {
        status: 409,
        detail: { code: "already_logged", same_show: true, existing: { id: 7 } },
      })
    );
    renderGigPage(["/gigs/12?userId=2"]);
    fireEvent.click(await screen.findByRole("button", { name: "+ I was there too" }));
    expect(await screen.findByText(/already logged this gig/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View your gig" })).toHaveAttribute("href", "/gigs/7");
  });
});
