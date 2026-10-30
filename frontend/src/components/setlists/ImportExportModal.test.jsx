import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImportExportModal from "./ImportExportModal";
import * as setlistsApi from "../../api/setlists";

vi.mock("../../api/setlists", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    cancelImportJob: vi.fn(),
    fetchImportJob: vi.fn().mockResolvedValue(null),
    importSetlistsFromFile: vi.fn(),
    previewSetlistsImport: vi.fn(),
    downloadProfileExport: vi.fn(),
  };
});

const preview = {
  items: [
    {
      setlist_id: "abc123",
      artist_name: "Band A",
      venue_name: "Venue",
      city: "Leeds",
      country: "United Kingdom",
      event_date: "02-05-2026",
      song_count: 12,
      already_logged: false,
    },
  ],
  page: 1,
  items_per_page: 20,
  total: 1,
  total_pages: 1,
};

function openWithPreview() {
  render(
    <ImportExportModal
      isOpen
      onClose={vi.fn()}
      onImport={vi.fn()}
      isImporting={false}
      token="test-token"
    />
  );
  fireEvent.change(screen.getByLabelText("Setlist.fm username or URL"), {
    target: { value: "crispylettuce" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Fetch Gigs" }));
  return screen.findByRole("button", { name: "Download these gigs" });
}

describe("ImportExportModal profile download", () => {
  beforeEach(() => {
    setlistsApi.previewSetlistsImport.mockResolvedValue(preview);
    window.URL.createObjectURL = vi.fn(() => "blob:profile");
    window.URL.revokeObjectURL = vi.fn();
    // jsdom can't follow a blob download link, so stop the click from navigating
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("downloads the fetched profile as a file", async () => {
    setlistsApi.downloadProfileExport.mockResolvedValue(
      new Blob(["[]"], { type: "application/json" })
    );

    fireEvent.click(await openWithPreview());

    await waitFor(() =>
      expect(setlistsApi.downloadProfileExport).toHaveBeenCalledWith({
        token: "test-token",
        username: "crispylettuce",
      })
    );
    await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalled());
  });

  it("shows the server's message when the download fails", async () => {
    setlistsApi.downloadProfileExport.mockRejectedValue(
      new Error("Setlist.fm daily limit reached.")
    );

    fireEvent.click(await openWithPreview());

    expect(await screen.findByText("Setlist.fm daily limit reached.")).toBeInTheDocument();
  });

  it("explains that the file imports without Setlist.fm calls", async () => {
    await openWithPreview();

    expect(screen.getByText(/uses no Setlist.fm calls/)).toBeInTheDocument();
  });
});
