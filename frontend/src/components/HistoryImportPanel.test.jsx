import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import HistoryImportPanel, { detectImportSource } from "./HistoryImportPanel";
import { submitUnifiedImport } from "../api";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitUnifiedImport: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("detectImportSource", () => {
  it('detects explicit "Spotify" source from prep-script JSON even when "song" key is present', () => {
    const entries = [
      {
        source: "Spotify",
        artist: "Foals",
        song: "Spanish Sahara",
        release: "Total Life Forever",
        artwork: "https://cdn.example/art.jpg",
        time: "2012-11-24T15:31:53Z",
      },
    ];
    expect(detectImportSource(entries, "Streaming_History_Audio_2012_processed.json")).toBe(
      "spotify"
    );
  });

  it('detects "youtube" from explicit "YouTube Music" source or raw Takeout fields', () => {
    const preppedYt = [
      {
        source: "YouTube Music",
        artist: "Foals",
        song: "Spanish Sahara",
        time: "2025-10-20T12:33:20.422Z",
      },
    ];
    const rawYt = [
      {
        header: "YouTube Music",
        title: "Watched Spanish Sahara",
        subtitles: [{ name: "Foals - Topic" }],
        time: "2025-10-20T12:33:20.422Z",
      },
    ];
    expect(detectImportSource(preppedYt, "history_processed.json")).toBe("youtube");
    expect(detectImportSource(rawYt, "watch-history.json")).toBe("youtube");
  });

  it('detects "spotify" from raw Extended Streaming History fields', () => {
    const rawSpotify = [
      {
        ts: "2012-04-27T18:59:45Z",
        master_metadata_track_name: "I Don't Love You No More",
        master_metadata_album_artist_name: "Jimmy Norman",
      },
    ];
    expect(detectImportSource(rawSpotify, "Streaming_History_Audio_2012_0.json")).toBe("spotify");
  });
});

describe("HistoryImportPanel", () => {
  it("submits detected source and renders ImportSummaryPanel on completion", async () => {
    const onImportComplete = vi.fn();
    submitUnifiedImport.mockResolvedValue({
      status: "ok",
      source: "spotify",
      summary: { inserted: 3, skipped: 1, duplicate: 0 },
    });

    render(<HistoryImportPanel token="test-token" onImportComplete={onImportComplete} />);

    const entries = [
      {
        source: "Spotify",
        artist: "Foals",
        song: "Spanish Sahara",
        time: "2012-11-24T15:31:53Z",
      },
    ];
    const file = new File([JSON.stringify(entries)], "spotify_processed.json", {
      type: "application/json",
    });
    file.text = async () => JSON.stringify(entries);

    const input = screen.getByLabelText("Import history JSON");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(submitUnifiedImport).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "test-token",
          source: "spotify",
          entries,
        })
      )
    );

    const summary = await screen.findByRole("status", { name: "Import Summary" });
    expect(within(summary).getByText("spotify", { exact: false })).toBeInTheDocument();
    expect(within(summary).getByText("3")).toBeInTheDocument();
    expect(onImportComplete).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("");
  });

  it("shows an error when the uploaded JSON has no entries", async () => {
    render(<HistoryImportPanel token="test-token" />);

    const file = new File(["[]"], "empty.json", { type: "application/json" });
    file.text = async () => "[]";

    fireEvent.change(screen.getByLabelText("Import history JSON"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByText("No history entries found in this JSON file.")).toBeInTheDocument()
    );
  });

  it("supports bulk uploading multiple JSON files sequentially and aggregates counts", async () => {
    const onImportComplete = vi.fn();
    submitUnifiedImport
      .mockResolvedValueOnce({
        status: "ok",
        source: "spotify",
        summary: { inserted: 4, skipped: 1, duplicate: 2 },
      })
      .mockResolvedValueOnce({
        status: "ok",
        source: "spotify",
        summary: { inserted: 6, skipped: 0, duplicate: 1 },
      });

    render(<HistoryImportPanel token="test-token" onImportComplete={onImportComplete} />);

    const input = screen.getByLabelText("Import history JSON");
    expect(input).toHaveAttribute("multiple");

    const entries1 = [
      {
        ts: "2012-04-27T18:59:45Z",
        master_metadata_track_name: "Track 1",
        master_metadata_album_artist_name: "Artist 1",
      },
    ];
    const entries2 = [
      {
        ts: "2013-05-01T10:00:00Z",
        master_metadata_track_name: "Track 2",
        master_metadata_album_artist_name: "Artist 2",
      },
    ];
    const file1 = new File([JSON.stringify(entries1)], "Streaming_History_Audio_2012_0.json", {
      type: "application/json",
    });
    file1.text = async () => JSON.stringify(entries1);
    const file2 = new File([JSON.stringify(entries2)], "Streaming_History_Audio_2013_1.json", {
      type: "application/json",
    });
    file2.text = async () => JSON.stringify(entries2);

    fireEvent.change(input, { target: { files: [file1, file2] } });

    await waitFor(() => expect(submitUnifiedImport).toHaveBeenCalledTimes(2));

    const summary = await screen.findByRole("status", { name: "Import Summary" });
    expect(within(summary).getByText("spotify (2 files)", { exact: false })).toBeInTheDocument();
    expect(within(summary).getByText("10")).toBeInTheDocument();
    expect(within(summary).getByText("3")).toBeInTheDocument();
    expect(within(summary).getByText("1")).toBeInTheDocument();
    expect(onImportComplete).toHaveBeenCalledTimes(1);
  });

  it("continues bulk upload if one file is empty and reports the failed file", async () => {
    submitUnifiedImport.mockResolvedValueOnce({
      status: "ok",
      source: "youtube",
      summary: { inserted: 5, skipped: 0, duplicate: 0 },
    });

    render(<HistoryImportPanel token="test-token" />);

    const badFile = new File(["[]"], "empty.json", { type: "application/json" });
    badFile.text = async () => "[]";
    const goodEntries = [
      { source: "YouTube Music", artist: "Foals", song: "Miami", time: "2025-01-01T12:00:00Z" },
    ];
    const goodFile = new File([JSON.stringify(goodEntries)], "yt_processed.json", {
      type: "application/json",
    });
    goodFile.text = async () => JSON.stringify(goodEntries);

    fireEvent.change(screen.getByLabelText("Import history JSON"), {
      target: { files: [badFile, goodFile] },
    });

    const summary = await screen.findByRole("status", { name: "Import Summary" });
    expect(within(summary).getByText("5")).toBeInTheDocument();
    expect(within(summary).getByText(/empty\.json/i)).toBeInTheDocument();
  });
});
