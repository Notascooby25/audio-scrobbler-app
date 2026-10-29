import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArtistsSeenLeaderboard from "./ArtistsSeenLeaderboard";
import DeleteGigConfirmModal from "./DeleteGigConfirmModal";
import ImportExportModal from "./ImportExportModal";
import MyGigsTimeline from "./MyGigsTimeline";

vi.mock("../../api/setlists", () => ({
  previewSetlistsImport: vi.fn(),
}));

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
    expect(screen.getByText("2 gigs")).toBeInTheDocument();

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

    const refreshBtn = screen.getByRole("button", { name: /refresh setlist/i });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledWith(gigs[0]);

    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(gigs[0]);
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
});
