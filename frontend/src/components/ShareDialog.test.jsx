import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShareDialog from "./ShareDialog";
import { fetchLibraryCollection, fetchReportsSummary } from "../api";

vi.mock("../api", () => ({
  fetchLibraryCollection: vi.fn(),
  fetchReportsSummary: vi.fn(),
}));

vi.mock("html-to-image", () => ({
  toBlob: vi.fn(),
}));

import { toBlob } from "html-to-image";

const dateRange = {
  range: "last.week",
  start_date: null,
  end_date: null,
  compare_to_previous: false,
};

const baseEntries = [
  { label: "M83", secondary: null, play_count: 42, artwork_url: "/m83.jpg" },
  { label: "The National", secondary: null, play_count: 12, artwork_url: "/tn.jpg" },
];

beforeEach(() => {
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  });
  toBlob.mockResolvedValue(new Blob(["fake"], { type: "image/png" }));
  fetchReportsSummary.mockResolvedValue({
    listening_minutes: 360,
    listening_minutes_comparison_percent: 10,
    source_breakdown: [{ source: "spotify", count: 10, percent: 100 }],
    new_discoveries: { artists: 2, albums: 1, tracks: 5 },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ShareDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ShareDialog
        open={false}
        kind="artists"
        entries={baseEntries}
        dateRange={dateRange}
        token="t"
        totalCount={2}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to 3x3 dimension (9 items)", async () => {
    fetchLibraryCollection.mockResolvedValue({ entries: [...baseEntries] });
    render(
      <ShareDialog
        open
        kind="artists"
        entries={baseEntries}
        dateRange={dateRange}
        token="t"
        totalCount={10}
      />
    );

    expect(screen.getByRole("button", { name: "3 × 3" })).toHaveClass("active");
    await waitFor(() =>
      expect(fetchLibraryCollection).toHaveBeenCalledWith(
        expect.objectContaining({ token: "t", entity: "artists", limit: 9, offset: 0, dateRange })
      )
    );
  });

  it("switches dimension to 2x2 when selected", async () => {
    fetchLibraryCollection.mockResolvedValue({ entries: [...baseEntries] });
    render(
      <ShareDialog
        open
        kind="artists"
        entries={baseEntries}
        dateRange={dateRange}
        token="t"
        totalCount={10}
      />
    );

    const btn2x2 = screen.getByRole("button", { name: "2 × 2" });
    fireEvent.click(btn2x2);
    expect(btn2x2).toHaveClass("active");
  });

  it("fetches reports summary when infusion checkbox is toggled", async () => {
    fetchLibraryCollection.mockResolvedValue({ entries: [...baseEntries] });
    render(
      <ShareDialog
        open
        kind="artists"
        entries={baseEntries}
        dateRange={dateRange}
        token="t"
        totalCount={10}
      />
    );

    const timeCheckbox = screen.getByLabelText(/Listening time/i);
    expect(timeCheckbox).not.toBeChecked();
    fireEvent.click(timeCheckbox);
    expect(timeCheckbox).toBeChecked();

    await waitFor(() => expect(fetchReportsSummary).toHaveBeenCalled());
  });

  it("clamps the size and shows a note when fewer entries are available than requested", async () => {
    render(
      <ShareDialog
        open
        kind="artists"
        entries={baseEntries}
        dateRange={dateRange}
        token="t"
        totalCount={2}
      />
    );

    await waitFor(() => expect(screen.getByText(/Only 2 artists available/)).toBeInTheDocument());
  });

  it("enables the download button once an image has been generated", async () => {
    render(
      <ShareDialog
        open
        kind="artists"
        entries={baseEntries}
        dateRange={dateRange}
        token="t"
        totalCount={2}
      />
    );

    await waitFor(() => expect(toBlob).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download PNG" })).not.toBeDisabled()
    );
  });
});
