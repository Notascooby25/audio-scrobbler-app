import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArtistsSeenLeaderboard from "./ArtistsSeenLeaderboard";
import DeleteGigConfirmModal from "./DeleteGigConfirmModal";
import ImportExportModal from "./ImportExportModal";
import MyGigsTimeline from "./MyGigsTimeline";
import SetlistDetailModal from "./SetlistDetailModal";
import GigCard from "./GigCard";

vi.mock("../../api/setlists", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    previewSetlistsImport: vi.fn(),
    fetchSetlistDetail: vi.fn(),
    updateConcertNotes: vi.fn().mockResolvedValue({ id: 10, notes: "Updated note" }),
  };
});

describe("SetlistsStats and Modals", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders Artists Seen accordion and toggles gig drilldown", () => {
    const artists = [
      {
        artist_name: "Public Service Broadcasting",
        count: 2,
        gigs: [
          {
            id: 1,
            date: "26 Sep 2026",
            venue: "Alexandra Palace",
            city: "London",
            country: "United Kingdom",
            is_support: false,
            song_count: 5,
          },
          {
            id: 2,
            date: "01 Nov 2025",
            venue: "Barbican Centre",
            city: "London",
            country: "United Kingdom",
            is_support: false,
            song_count: 4,
          },
        ],
      },
    ];

    render(<ArtistsSeenLeaderboard artists={artists} />);

    expect(screen.getByText("Public Service Broadcasting")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Gigs should be collapsed initially
    expect(screen.queryByText(/alexandra palace/i)).not.toBeInTheDocument();

    // Click to expand accordion
    fireEvent.click(screen.getByText("Public Service Broadcasting"));
    expect(screen.getByText(/alexandra palace/i)).toBeInTheDocument();
    expect(screen.getByText(/barbican centre/i)).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(screen.getByText("Public Service Broadcasting"));
    expect(screen.queryByText(/alexandra palace/i)).not.toBeInTheDocument();
  });

  it("renders DeleteGigConfirmModal with support acts checkbox and double confirm", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const gig = {
      id: 10,
      artist_name: "Foo Fighters",
      venue_name: "Anfield",
      song_count: 29,
    };

    render(
      <DeleteGigConfirmModal
        isOpen={true}
        onClose={onClose}
        gig={gig}
        onConfirm={onConfirm}
        isDeleting={false}
      />
    );

    expect(screen.getByText("Delete Attended Gig")).toBeInTheDocument();
    expect(screen.getByText("Foo Fighters")).toBeInTheDocument();
    const checkbox = screen.getByLabelText(/also delete support acts/i);
    expect(checkbox).toBeChecked();

    // Click confirm
    const deleteBtn = screen.getByRole("button", { name: /^delete gig$/i });
    fireEvent.click(deleteBtn);

    expect(onConfirm).toHaveBeenCalledWith(10, true);
  });

  it("renders MyGigsTimeline and handles refresh setlist", () => {
    const onRefresh = vi.fn();
    const onDelete = vi.fn();
    const gigs = [
      {
        id: 1,
        artist_name: "Elbow",
        venue_name: "Apollo",
        city: "Manchester",
        country: "United Kingdom",
        event_date: "2026-11-15T20:00:00",
        song_count: 2,
        raw_data: { sets: { set: [{ song: [{ name: "Grounds for Divorce" }] }] } },
      },
    ];

    render(
      <MyGigsTimeline
        gigs={gigs}
        onRefreshSetlist={onRefresh}
        onDeleteGig={onDelete}
        isRefreshingId={null}
      />
    );

    expect(screen.getByText("Elbow at Apollo")).toBeInTheDocument();

    const refreshBtn = screen.getByRole("button", { name: /^refresh$/i });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledWith(gigs[0]);

    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtn);
    expect(screen.getByText(/Remove this concert from your gigs\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /confirm delete/i });
    fireEvent.click(confirmBtn);
    expect(onDelete).toHaveBeenCalledWith(gigs[0], true);
  });

  it("renders ImportExportModal and handles selective gig preview and import", async () => {
    const onImport = vi.fn();
    const onClose = vi.fn();

    const { previewSetlistsImport } = await import("../../api/setlists");
    vi.mocked(previewSetlistsImport).mockResolvedValueOnce({
      total: 2,
      page: 1,
      total_pages: 1,
      items: [
        {
          setlist_id: "show_1",
          artist_name: "Foo Fighters",
          venue_name: "London Stadium",
          city: "London",
          country: "United Kingdom",
          event_date: "27-06-2024",
          song_count: 20,
          already_logged: false,
        },
        {
          setlist_id: "show_2",
          artist_name: "Green Day",
          venue_name: "Wembley Stadium",
          city: "London",
          country: "United Kingdom",
          event_date: "29-06-2024",
          song_count: 30,
          already_logged: true,
        },
      ],
    });

    render(
      <ImportExportModal
        isOpen={true}
        onClose={onClose}
        onImport={onImport}
        isImporting={false}
        token="test-token"
      />
    );

    const input = screen.getByPlaceholderText(/Setlist\.fm username/i);
    fireEvent.change(input, { target: { value: "crispylettuce" } });

    const fetchBtn = screen.getByRole("button", { name: /fetch gigs/i });
    fireEvent.click(fetchBtn);

    expect(await screen.findByText("Foo Fighters")).toBeInTheDocument();
    expect(screen.getByText("Green Day")).toBeInTheDocument();
    expect(screen.getByText("Added")).toBeInTheDocument();

    // Foo Fighters should be pre-selected (1 selected)
    const importSelectedBtn = screen.getByRole("button", { name: /import selected \(1\)/i });
    fireEvent.click(importSelectedBtn);

    expect(onImport).toHaveBeenCalledWith("crispylettuce", ["show_1"]);
  });

  it("renders SetlistDetailModal with sets, encore, song numbering, and personal notes editor", async () => {
    const onClose = vi.fn();
    const onNotesSaved = vi.fn();
    const initialData = {
      id: 10,
      notes: "Front row, got drumstick!",
      artist: { name: "Public Service Broadcasting" },
      venue: { name: "Alexandra Palace", city: { name: "London" } },
      eventDate: "26-09-2026",
      sets: {
        set: [
          {
            name: "Main Set",
            song: [
              { name: "The Other Side" },
              { name: "Theme From PSB", tape: true },
              { name: "Spitfire", with: { name: "Guest Singer" } },
            ],
          },
          {
            encore: 1,
            song: [{ name: "Everest" }],
          },
        ],
      },
    };

    render(
      <SetlistDetailModal
        setlistId="psb_show"
        initialData={initialData}
        token="test-token"
        onClose={onClose}
        onNotesSaved={onNotesSaved}
      />
    );

    expect(screen.getByText("Public Service Broadcasting")).toBeInTheDocument();
    expect(screen.getByText(/Alexandra Palace/i)).toBeInTheDocument();
    expect(screen.getByText("The Other Side")).toBeInTheDocument();
    expect(screen.getByText("Theme From PSB")).toBeInTheDocument();
    expect(screen.getByText("Tape")).toBeInTheDocument();
    expect(screen.getByText("Spitfire")).toBeInTheDocument();
    expect(screen.getByText("Guest Singer")).toBeInTheDocument();
    expect(screen.getByText("Everest")).toBeInTheDocument();
    expect(screen.getByText(/Front row, got drumstick!/i)).toBeInTheDocument();

    // Click Edit Note
    const editBtn = screen.getByRole("button", { name: /edit note/i });
    fireEvent.click(editBtn);

    const textarea = screen.getByPlaceholderText(/record your memories/i);
    expect(textarea.value).toBe("Front row, got drumstick!");

    fireEvent.change(textarea, { target: { value: "Updated: amazing show!" } });
    const saveBtn = screen.getByRole("button", { name: /save note/i });
    fireEvent.click(saveBtn);

    const { updateConcertNotes } = await import("../../api/setlists");
    expect(updateConcertNotes).toHaveBeenCalledWith({
      token: "test-token",
      concertId: 10,
      notes: "Updated: amazing show!",
    });
  });

  it("renders GigCard with '+ I\\'M GOING' for future gigs and '✓ I WAS THERE' for past gigs", () => {
    const futureGig = {
      id: "fut_1",
      artist: { name: "Future Band" },
      venue: { name: "Wembley Stadium", city: { name: "London" } },
      eventDate: "15-12-2099",
      sets: { set: [] },
    };

    const pastGig = {
      id: "past_1",
      artist: { name: "Past Band" },
      venue: { name: "O2 Academy", city: { name: "London" } },
      eventDate: "01-01-2020",
      sets: { set: [{ song: [{ name: "Hit Song" }] }] },
    };

    const onLog = vi.fn();
    const onView = vi.fn();

    const { rerender } = render(
      <GigCard
        setlist={futureGig}
        onLogAttendance={onLog}
        onViewSetlist={onView}
        isLogging={false}
      />
    );

    expect(screen.getByRole("button", { name: /\+ i'm going/i })).toBeInTheDocument();
    expect(screen.getByText(/upcoming concert • no setlist yet/i)).toBeInTheDocument();

    rerender(
      <GigCard setlist={pastGig} onLogAttendance={onLog} onViewSetlist={onView} isLogging={false} />
    );

    expect(screen.getByRole("button", { name: /✓ i was there/i })).toBeInTheDocument();
    expect(screen.getByText(/Hit Song/i)).toBeInTheDocument();
  });
});
