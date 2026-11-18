import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FaqSection from "./FaqSection";
import { REPORT_HINTS } from "../../reportHints";

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

  it("explains where Discover gigs come from and what a possible match is", () => {
    render(<FaqSection />);
    expect(
      screen.getByText(/where do the gigs on the discover tab come from/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/what does 'possible match' mean/i)).toBeInTheDocument();
  });

  it("shows empty search state when no questions match", () => {
    render(<FaqSection />);
    const searchInput = screen.getByPlaceholderText(/search questions/i);
    fireEvent.change(searchInput, { target: { value: "xyznonexistent123" } });
    expect(screen.getByText(/no questions matched your search/i)).toBeInTheDocument();
  });

  it("covers the previously missing topics", () => {
    render(<FaqSection />);
    const questions = [
      /how do i import my past spotify or youtube listening history/i,
      /what do the numbers and charts on the reports page mean/i,
      /how do i recommend a song or album to a friend/i,
      /what is the rough trade top 100 in the album jukebox/i,
      /how do i get started and connect my spotify account/i,
      /how do i delete, block or clear artwork for a single track/i,
      /what does each page in the app do/i,
      /can i install the app, and does it work offline/i,
      /how do i share an image card of my top music/i,
    ];
    for (const question of questions) {
      expect(screen.getByText(question)).toBeInTheDocument();
    }
  });

  it("finds the history import entry by keyword search", () => {
    render(<FaqSection />);
    fireEvent.change(screen.getByPlaceholderText(/search questions/i), {
      target: { value: "import" },
    });
    expect(
      screen.getByText(/how do i import my past spotify or youtube listening history/i)
    ).toBeInTheDocument();
  });

  it("explains the report widgets using the same wording as the info hints", () => {
    render(<FaqSection />);
    expect(screen.getAllByText(REPORT_HINTS["ratios.explorer"]).length).toBeGreaterThan(0);
  });

  it("sign-out answer no longer points to a Home page", () => {
    render(<FaqSection />);
    const item = screen.getByText(/how do i sign out, and does it clear my browser cache/i);
    const answer = item.closest("details");
    expect(answer).not.toHaveTextContent(/home page/i);
    expect(answer).toHaveTextContent(/connect/i);
  });

  it("privacy answer describes one-way following, not a mutual follow", () => {
    render(<FaqSection />);
    const item = screen.getByText(/can other people see my listening history/i);
    const answer = item.closest("details");
    expect(answer).not.toHaveTextContent(/follow you back/i);
    expect(answer).toHaveTextContent(/anyone who follows you/i);
  });

  it("privacy answer mentions follower alerts and removing followers", () => {
    render(<FaqSection />);
    const item = screen.getByText(/can other people see my listening history/i);
    const answer = item.closest("details");
    expect(answer).toHaveTextContent(/notification when someone follows you/i);
    expect(answer).toHaveTextContent(/remove/i);
    expect(answer).toHaveTextContent(/friends page/i);
  });
});
