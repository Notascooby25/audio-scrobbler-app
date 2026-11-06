import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import WhatsNewModal from "./WhatsNewModal";

vi.mock("../changelogData", () => ({
  CHANGELOG: [
    {
      version: "9.9.9",
      date: "2026-11-06",
      changes: [
        "Feature Alpha: Added support for magical things.",
        "Fix Beta: Resolved layout issue on mobile header.",
      ],
    },
    {
      version: "9.9.8",
      date: "2026-11-01",
      changes: ["Older release note that should not show in What's New modal."],
    },
  ],
}));

describe("WhatsNewModal", () => {
  afterEach(() => {
    cleanup();
  });
  it("does not render when isOpen is false", () => {
    render(
      <MemoryRouter>
        <WhatsNewModal isOpen={false} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders latest release changes, title, and buttons when isOpen is true", () => {
    render(
      <MemoryRouter>
        <WhatsNewModal isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("What's New in v9.9.9")).toBeInTheDocument();
    expect(screen.getByText("2026-11-06")).toBeInTheDocument();
    expect(screen.getByText(/Feature Alpha: Added support for magical things/)).toBeInTheDocument();
    expect(
      screen.getByText(/Fix Beta: Resolved layout issue on mobile header/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Older release note/)).not.toBeInTheDocument();

    const viewAllLink = screen.getByRole("link", { name: "View all changes" });
    expect(viewAllLink).toHaveAttribute("href", "/changelog");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("calls onClose when Close button or close icon is clicked", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <WhatsNewModal isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it("calls onClose when clicking the backdrop, but not inside dialog content", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <WhatsNewModal isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    // Clicking inside the dialog does not close it
    fireEvent.click(screen.getByRole("dialog"));
    expect(handleClose).not.toHaveBeenCalled();

    // Clicking the backdrop closes it
    fireEvent.click(screen.getByTestId("whats-new-backdrop"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when pressing Escape key", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <WhatsNewModal isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking View all changes link", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <WhatsNewModal isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("link", { name: "View all changes" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
