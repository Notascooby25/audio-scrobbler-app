import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import Albums1001ChecklistModal from "./1001AlbumsChecklistModal";

describe("1001AlbumsChecklistModal", () => {
  afterEach(cleanup);

  it("renders decade tabs, switches decades, and toggles album completion", () => {
    const mockToggle = vi.fn();
    const albums = [
      {
        id: 1,
        album_name: "Abbey Road",
        artist_name: "The Beatles",
        release_year: 1969,
        decade: 1960,
        is_completed: true,
        artwork_url: "",
      },
      {
        id: 2,
        album_name: "Dark Side",
        artist_name: "Pink Floyd",
        release_year: 1973,
        decade: 1970,
        is_completed: false,
        artwork_url: "",
      },
    ];

    render(
      <Albums1001ChecklistModal
        isOpen={true}
        onClose={vi.fn()}
        albums={albums}
        completedCount={1}
        totalCount={2}
        onToggleCompleted={mockToggle}
      />
    );

    expect(screen.getByText(/1001 Albums Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();

    // Click on 70s decade tab
    const tab70s = screen.getByRole("button", { name: /70s/i });
    fireEvent.click(tab70s);
    expect(screen.getByText("Dark Side")).toBeInTheDocument();

    // Click checkbox on Dark Side
    const checkbox = screen.getByRole("checkbox", { name: /Dark Side/i });
    fireEvent.click(checkbox);
    expect(mockToggle).toHaveBeenCalledWith(2, true);
  });

  it("does not render when isOpen is false", () => {
    render(
      <Albums1001ChecklistModal
        isOpen={false}
        onClose={vi.fn()}
        albums={[]}
        completedCount={0}
        totalCount={0}
        onToggleCompleted={vi.fn()}
      />
    );
    expect(screen.queryByText(/1001 Albums Progress/i)).not.toBeInTheDocument();
  });
});
