import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import Footer from "./Footer";

describe("Footer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders brand name and What's new version trigger button", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.getByTestId("app-footer")).toBeInTheDocument();
    expect(screen.getByText("Audio Scrobbler App")).toBeInTheDocument();
    const versionButton = screen.getByRole("button", { name: /What's new/i });
    expect(versionButton).toBeInTheDocument();
    expect(versionButton.textContent).toMatch(/v\d+\.\d+\.\d+\s*•\s*What's new/);
  });

  it("opens WhatsNewModal when clicking the What's new button and closes it on dismiss", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const versionButton = screen.getByRole("button", { name: /What's new/i });
    fireEvent.click(versionButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/What's New in v/)).toBeInTheDocument();

    const viewAllLink = screen.getByRole("link", { name: "View all changes" });
    expect(viewAllLink).toHaveAttribute("href", "/changelog");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
