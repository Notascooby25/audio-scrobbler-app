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

describe("ImportExportModal file update", () => {
  beforeEach(() => {
    setlistsApi.importSetlistsFromFile.mockResolvedValue({
      imported: 0,
      skipped_existing: 0,
      updated: 2,
      without_songs: 0,
      quota_reached: false,
      invalid: [],
      invalid_count: 0,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks the server to update existing gigs when the box is ticked", async () => {
    render(
      <ImportExportModal
        isOpen
        onClose={vi.fn()}
        onImport={vi.fn()}
        isImporting={false}
        token="test-token"
      />
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Update festival names and ticks on gigs I already have",
      })
    );
    const file = new File(['[{"artist_name":"Doves"}]'], "gigs.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Gigs file (CSV or JSON)"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import File" }));

    await waitFor(() =>
      expect(setlistsApi.importSetlistsFromFile).toHaveBeenCalledWith(
        expect.objectContaining({ format: "json", updateExisting: true })
      )
    );
    expect(await screen.findByText(/2 updated/)).toBeInTheDocument();
  });
});
