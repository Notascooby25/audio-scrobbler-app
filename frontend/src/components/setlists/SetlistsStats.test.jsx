import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as setlistsApi from "../../api/setlists";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ArtistsSeenLeaderboard from "./ArtistsSeenLeaderboard";
import DeleteGigConfirmModal from "./DeleteGigConfirmModal";
import ImportExportModal from "./ImportExportModal";
import MyGigsTimeline from "./MyGigsTimeline";
import GigCard from "./GigCard";
import RankedBarList from "./RankedBarList";
import SongsHeardLeaderboard from "./SongsHeardLeaderboard";
import VenuesLeaderboard from "./VenuesLeaderboard";

vi.mock("../../api/setlists", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    previewSetlistsImport: vi.fn(),
    importSetlistsFromFile: vi.fn(),
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

    render(
      <MemoryRouter>
        <ArtistsSeenLeaderboard artists={artists} />
      </MemoryRouter>
    );

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

  it("renders MyGigsTimeline rows that open the gig and filter by upcoming", () => {
    const onOpenGig = vi.fn();
    const gigs = [
      {
        id: 1,
        artist_name: "Elbow",
        venue_name: "Apollo",
        city: "Manchester",
        country: "United Kingdom",
        event_date: "2020-11-15T20:00:00",
        song_count: 2,
      },
      {
        id: 2,
        artist_name: "Shed Seven",
        venue_name: "O2 Academy",
        city: "Birmingham",
        country: "United Kingdom",
        event_date: "2099-11-14T20:00:00",
        song_count: 0,
      },
    ];

    render(
      <MemoryRouter>
        <MyGigsTimeline gigs={gigs} onOpenGig={onOpenGig} />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "All Gigs (2)" })).toBeInTheDocument();
    expect(screen.getByText("Apollo, Manchester, United Kingdom")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Elbow" }));
    expect(onOpenGig).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Upcoming (1)" }));
    expect(screen.getByRole("heading", { name: "Upcoming Shows (1)" })).toBeInTheDocument();
    expect(screen.queryByText("Elbow")).not.toBeInTheDocument();
  });

  it("paginates My Gigs 15 per page with a page size option", () => {
    const gigs = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      artist_name: `Band ${i + 1}`,
      venue_name: "Rock City",
      city: "Nottingham",
      country: "United Kingdom",
      event_date: `20${String(10 + Math.floor(i / 12)).padStart(2, "0")}-01-${String((i % 12) + 1).padStart(2, "0")}T20:00:00`,
    }));

    render(
      <MemoryRouter>
        <MyGigsTimeline gigs={gigs} />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "All Gigs (40)" })).toBeInTheDocument();
    expect(screen.getByText("Band 15")).toBeInTheDocument();
    expect(screen.queryByText("Band 16")).not.toBeInTheDocument();
    expect([...screen.getByLabelText(/gigs shown per page/i).options].map((o) => o.value)).toEqual([
      "10",
      "15",
      "25",
      "50",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByText("Band 31")).toBeInTheDocument();
    expect(screen.getByText("Band 40")).toBeInTheDocument();
    expect(screen.queryByText("Band 30")).not.toBeInTheDocument();

    // Changing the filter goes back to page 1
    fireEvent.click(screen.getByRole("button", { name: "Attended (40)" }));
    expect(screen.getByText("Band 1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/gigs shown per page/i), { target: { value: "50" } });
    expect(screen.getByText("Band 40")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
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

  it("imports gigs from a JSON file and shows what happened", async () => {
    setlistsApi.importSetlistsFromFile.mockResolvedValueOnce({
      imported: 12,
      skipped_existing: 3,
      without_songs: 0,
      quota_reached: false,
      invalid: [{ line: 7, error: "event_date: date must look like 2026-10-16" }],
      invalid_count: 1,
    });
    const onFileImported = vi.fn();
    render(
      <ImportExportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        onFileImported={onFileImported}
        isImporting={false}
        token="test-token"
      />
    );

    const content = JSON.stringify([{ artist_name: "Doves" }]);
    const file = new File([content], "attended_gigs.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText(/gigs file/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import File" }));

    expect(
      await screen.findByText("12 imported, 3 already logged (skipped), 1 invalid row.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Line 7: event_date: date must look like 2026-10-16")
    ).toBeInTheDocument();
    expect(setlistsApi.importSetlistsFromFile).toHaveBeenCalledWith({
      token: "test-token",
      format: "json",
      content,
    });
    expect(onFileImported).toHaveBeenCalled();
  });

  it("rejects files that aren't CSV or JSON before uploading", async () => {
    render(
      <ImportExportModal isOpen={true} onClose={vi.fn()} onImport={vi.fn()} token="test-token" />
    );
    const file = new File(["x"], "gigs.xlsx");
    fireEvent.change(screen.getByLabelText(/gigs file/i), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import File" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/\.csv or \.json/));
    expect(setlistsApi.importSetlistsFromFile).not.toHaveBeenCalled();
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

  it("opens a gig from an expanded artist row", () => {
    const onOpenGig = vi.fn();
    const artists = [
      {
        artist_name: "Shed Seven",
        count: 1,
        gigs: [
          {
            id: 42,
            setlist_id: "shed_42",
            date: "14 Nov 2026",
            venue: "O2 Academy Birmingham",
            city: "Birmingham",
            country: "United Kingdom",
            is_support: false,
            song_count: 3,
          },
        ],
      },
    ];

    render(
      <MemoryRouter>
        <ArtistsSeenLeaderboard artists={artists} onOpenGig={onOpenGig} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Shed Seven"));
    expect(screen.getByLabelText("14 NOV 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /O2 Academy Birmingham, Birmingham/i }));
    expect(onOpenGig).toHaveBeenCalledWith(42);
  });

  it("shows tie-aware ranks and proportional bars in RankedBarList", () => {
    const items = [
      { key: "a", label: "The Lottery Winners", count: 4 },
      { key: "b", label: "Red Rum Club", count: 1 },
      { key: "c", label: "The Black Keys", count: 1 },
      { key: "d", label: "Doves", count: 2 },
    ].sort((x, y) => y.count - x.count);

    const { container } = render(
      <MemoryRouter>
        <RankedBarList items={items} noun="artists" />
      </MemoryRouter>
    );

    const ranks = [...container.querySelectorAll(".sfm-rank")].map((el) => el.textContent);
    expect(ranks).toEqual(["1", "2", "3", ""]);
    const widths = [...container.querySelectorAll(".sfm-bar")].map((el) => el.style.width);
    expect(widths).toEqual(["100%", "50%", "25%", "25%"]);
  });

  it("paginates RankedBarList from the page query string", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      key: `artist-${i}`,
      label: `Artist ${i + 1}`,
      count: 12 - i,
    }));

    render(
      <MemoryRouter initialEntries={["/setlists?tab=artists&size=10&page=2"]}>
        <RankedBarList items={items} noun="artists" />
      </MemoryRouter>
    );

    expect(screen.queryByText("Artist 1")).not.toBeInTheDocument();
    expect(screen.getByText("Artist 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: /previous page/i }));
    expect(screen.getByText("Artist 1")).toBeInTheDocument();
  });

  const lotteryGig = (id, venue, iso) => ({
    id,
    setlist_id: `tlw_${id}`,
    artist_name: "The Lottery Winners",
    venue_name: venue,
    city: "Birmingham",
    country: "United Kingdom",
    event_date: iso,
    date: "",
  });
  const songs = [
    {
      track_name: "Burning House",
      artist_name: "The Lottery Winners",
      count: 2,
      gigs: [
        lotteryGig(1, "Victorious Festival", "2026-08-29T20:00:00"),
        lotteryGig(2, "HMV Empire", "2025-11-25T20:00:00"),
      ],
    },
    {
      track_name: "Always Like This",
      artist_name: "Bombay Bicycle Club",
      count: 1,
      gigs: [
        {
          id: 3,
          setlist_id: "bbc_3",
          artist_name: "Bombay Bicycle Club",
          venue_name: "Cambridge Corn Exchange",
          city: "Cambridge",
          country: "United Kingdom",
          event_date: "2024-02-10T20:00:00",
          date: "",
        },
      ],
    },
  ];

  it("filters Songs Heard by artist and year from the sidebar", () => {
    render(
      <MemoryRouter>
        <SongsHeardLeaderboard songs={songs} />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Total songs" })).toBeInTheDocument();
    const allLink = screen.getByRole("button", { name: "All setlist songs" });
    expect(allLink.parentElement).toHaveTextContent("All setlist songs (3)");

    fireEvent.click(screen.getByRole("button", { name: "Bombay Bicycle Club" }));
    expect(
      screen.getByRole("heading", { name: "Songs at Bombay Bicycle Club concerts" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Burning House")).not.toBeInTheDocument();
    expect(screen.getByText("Always Like This")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All setlist songs" }));
    fireEvent.click(screen.getByRole("button", { name: "2025" }));
    expect(screen.getByRole("heading", { name: "Songs heard in 2025" })).toBeInTheDocument();
    expect(screen.getByText("Burning House")).toBeInTheDocument();
    expect(screen.queryByText("Always Like This")).not.toBeInTheDocument();
    // Only the 2025 gig counts towards the bar
    expect(document.querySelector(".sfm-bar")).toHaveTextContent("1");
  });

  it("expands a song to the gigs it was heard at and opens one", () => {
    const onOpenGig = vi.fn();
    render(
      <MemoryRouter>
        <SongsHeardLeaderboard songs={songs} onOpenGig={onOpenGig} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Burning House" }));
    expect(screen.getByRole("button", { name: "Burning House" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: /HMV Empire, Birmingham/i }));
    expect(onOpenGig).toHaveBeenCalledWith(2);
  });

  it("expands a venue to every act seen there", () => {
    const venues = [
      {
        venue_name: "Anfield",
        city: "Liverpool",
        country: "United Kingdom",
        count: 1,
        gigs: [
          { ...lotteryGig(8, "Anfield", "2026-06-27T20:00:00"), artist_name: "Foo Fighters" },
          {
            ...lotteryGig(9, "Anfield", "2026-06-27T19:00:00"),
            artist_name: "Royel Otis",
            is_support: true,
          },
        ],
      },
    ];
    render(
      <MemoryRouter>
        <VenuesLeaderboard venues={venues} />
      </MemoryRouter>
    );

    expect(screen.getByText("Liverpool, United Kingdom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anfield" }));
    expect(screen.getByText("Foo Fighters")).toBeInTheDocument();
    expect(screen.getByText("Royel Otis")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });
});
