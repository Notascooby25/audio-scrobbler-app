import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FaqSection from "./FaqSection";

describe("FaqSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders FAQ questions and categories", () => {
    render(<FaqSection />);
    expect(screen.getByPlaceholderText(/search questions/i)).toBeInTheDocument();
    expect(screen.getByText(/why is there a delay before my song appears/i)).toBeInTheDocument();
    expect(
      screen.getByText(/how do i scrobble music a friend played in the car/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/can i add bbc sounds tracks directly to my spotify playlists/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/what's the difference between blocking an artist and deleting scrobbles/i)
    ).toBeInTheDocument();
  });

  it("filters questions by keyword search", () => {
    render(<FaqSection />);
    const searchInput = screen.getByPlaceholderText(/search questions/i);
    fireEvent.change(searchInput, { target: { value: "car" } });
    expect(
      screen.getByText(/how do i scrobble music a friend played in the car/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/how do i fix missing album artwork/i)).not.toBeInTheDocument();
  });

  it("shows empty search state when no questions match", () => {
    render(<FaqSection />);
    const searchInput = screen.getByPlaceholderText(/search questions/i);
    fireEvent.change(searchInput, { target: { value: "xyznonexistent123" } });
    expect(screen.getByText(/no questions matched your search/i)).toBeInTheDocument();
  });
});
