import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import RoughTradeChecklistModal from "./RoughTradeChecklistModal";

describe("RoughTradeChecklistModal", () => {
  afterEach(cleanup);

  it("renders year tabs, filters by year, and toggles album completion", () => {
    const mockToggle = vi.fn();
    const albums = [
      {
        id: "rt-2020-1",
        rank: 1,
        album_name: "Untitled (Black Is)",
        artist_name: "SAULT",
        year: 2020,
        is_completed: true,
        artwork_url: "",
      },
      {
        id: "rt-2025-1",
        rank: 1,
        album_name: "Future Vintage",
        artist_name: "Test Artist",
        year: 2025,
        is_completed: false,
        artwork_url: "",
      },
    ];

    render(
      <RoughTradeChecklistModal
        isOpen={true}
        onClose={vi.fn()}
        albums={albums}
        completedCount={1}
        totalCount={2}
        onToggleCompleted={mockToggle}
      />
    );

    expect(screen.getByText(/Rough Trade Top 100 Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();

    // Default is All Years, both show
    expect(screen.getByText(/Untitled \(Black Is\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Future Vintage/i)).toBeInTheDocument();

    // Switch to 2025 tab
    const tab2025 = screen.getByRole("button", { name: /2025/i });
    fireEvent.click(tab2025);
    expect(screen.queryByText(/Untitled \(Black Is\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Future Vintage/i)).toBeInTheDocument();

    // Click checkbox for Future Vintage
    const checkbox = screen.getByRole("checkbox", { name: /Future Vintage/i });
    fireEvent.click(checkbox);
    expect(mockToggle).toHaveBeenCalledWith("rt-2025-1", true);
  });

  it("does not render when isOpen is false", () => {
    render(
      <RoughTradeChecklistModal
        isOpen={false}
        onClose={vi.fn()}
        albums={[]}
        completedCount={0}
        totalCount={0}
        onToggleCompleted={vi.fn()}
      />
    );
    expect(screen.queryByText(/Rough Trade Top 100 Progress/i)).not.toBeInTheDocument();
  });

  it("filters albums by search query", () => {
    const albums = [
      {
        id: "rt-2020-1",
        rank: 1,
        album_name: "Untitled (Black Is)",
        artist_name: "SAULT",
        year: 2020,
        is_completed: false,
        artwork_url: "",
      },
      {
        id: "rt-2020-2",
        rank: 2,
        album_name: "Song for Our Daughter",
        artist_name: "Laura Marling",
        year: 2020,
        is_completed: false,
        artwork_url: "",
      },
    ];

    render(
      <RoughTradeChecklistModal
        isOpen={true}
        onClose={vi.fn()}
        albums={albums}
        completedCount={0}
        totalCount={2}
        onToggleCompleted={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Search all Rough Trade albums/i);
    fireEvent.change(input, { target: { value: "Marling" } });

    expect(screen.queryByText(/Untitled \(Black Is\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Song for Our Daughter/i)).toBeInTheDocument();
  });
});
