import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import BlockedItemsSection from "./BlockedItemsSection";

describe("BlockedItemsSection", () => {
  afterEach(cleanup);

  const sampleBlocks = [
    { id: 1, name: "Artist One", entity_type: "artist" },
    { id: 2, name: "Album Two", entity_type: "album" },
    { id: 3, name: "Track Three", entity_type: "track" },
  ];

  it("is collapsed by default and shows item count", () => {
    render(<BlockedItemsSection blocks={sampleBlocks} onUnblock={vi.fn()} />);
    expect(screen.getByText(/Blocked items \(3\)/i)).toBeInTheDocument();
    expect(screen.queryByText("Artist One")).not.toBeInTheDocument();
  });

  it("expands to show blocked items when clicked", () => {
    render(<BlockedItemsSection blocks={sampleBlocks} onUnblock={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Blocked items/i }));

    expect(screen.getByText("Artist One")).toBeInTheDocument();
    expect(screen.getByText("Album Two")).toBeInTheDocument();
    expect(screen.getByText("Track Three")).toBeInTheDocument();
  });

  it("allows selecting multiple items and unblocking batch", async () => {
    const handleUnblock = vi.fn().mockResolvedValue();
    render(<BlockedItemsSection blocks={sampleBlocks} onUnblock={handleUnblock} />);
    fireEvent.click(screen.getByRole("button", { name: /Blocked items/i }));

    const checkboxes = screen.getAllByRole("checkbox");
    // Check first two items
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const batchBtn = screen.getByRole("button", { name: /Unblock selected \(2\)/i });
    expect(batchBtn).toBeInTheDocument();

    fireEvent.click(batchBtn);

    // Confirm dialog
    const confirmBtn = screen.getByRole("button", { name: /^Confirm Unblock$/i });
    fireEvent.click(confirmBtn);

    expect(handleUnblock).toHaveBeenCalledWith([1, 2]);
  });
});
