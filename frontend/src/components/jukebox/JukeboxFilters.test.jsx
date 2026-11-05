import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import JukeboxFilters from "./JukeboxFilters";

describe("JukeboxFilters", () => {
  afterEach(cleanup);
  const defaultFilters = {
    artist: "",
    decade: new Set(),
    genre: new Set(),
    length: new Set(),
    added: new Set(),
  };

  it("renders top 10 parent genres when expanded", () => {
    const toggleFilter = vi.fn();
    render(
      <JukeboxFilters
        albums={[]}
        filters={defaultFilters}
        toggleFilter={toggleFilter}
        clearFilters={vi.fn()}
        mode="any"
        setMode={vi.fn()}
      />
    );

    // Expand filters
    const filterBtn = screen.getByRole("button", { name: /Filters/i });
    fireEvent.click(filterBtn);

    // Check for some parent genres
    expect(screen.getByRole("button", { name: /^Rock$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pop$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Jazz$/i })).toBeInTheDocument();
  });

  it("renders exclude played checkbox in 1001 mode and calls setExcludeCompleted", () => {
    const setExcludeCompleted = vi.fn();
    render(
      <JukeboxFilters
        albums={[]}
        filters={defaultFilters}
        toggleFilter={vi.fn()}
        clearFilters={vi.fn()}
        mode="any"
        setMode={vi.fn()}
        sourceMode="1001"
        excludeCompleted={false}
        setExcludeCompleted={setExcludeCompleted}
      />
    );

    // Expand filters
    const filterBtn = screen.getByRole("button", { name: /Filters/i });
    fireEvent.click(filterBtn);

    const checkbox = screen.getByLabelText(/Exclude previously played albums/i);
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(setExcludeCompleted).toHaveBeenCalledWith(true);
  });

  it("renders exclude played checkbox label with flexDirection row", () => {
    render(
      <JukeboxFilters
        albums={[]}
        filters={defaultFilters}
        toggleFilter={vi.fn()}
        clearFilters={vi.fn()}
        mode="any"
        setMode={vi.fn()}
        sourceMode="1001"
        excludeCompleted={false}
        setExcludeCompleted={vi.fn()}
      />
    );

    // Expand filters
    const filterBtn = screen.getByRole("button", { name: /Filters/i });
    fireEvent.click(filterBtn);

    const checkbox = screen.getByLabelText(/Exclude previously played albums/i);
    const label = checkbox.closest("label");
    expect(label).toHaveStyle({ flexDirection: "row" });
  });

  it("renders retro variant with arcade borders and colors", () => {
    render(
      <JukeboxFilters
        albums={[]}
        filters={defaultFilters}
        toggleFilter={vi.fn()}
        clearFilters={vi.fn()}
        mode="any"
        setMode={vi.fn()}
        variant="retro"
      />
    );

    const filterBtn = screen.getByRole("button", { name: /Filters/i });
    expect(filterBtn).toHaveStyle({
      border: "2px solid #394651",
      background: "#fffdf8",
      color: "#24212b",
    });

    fireEvent.click(filterBtn);
    const drawer = screen.getByTestId("jukebox-filters-drawer");
    expect(drawer).toHaveStyle({
      background: "#fffdf8",
      border: "2px solid #394651",
    });
  });
});

