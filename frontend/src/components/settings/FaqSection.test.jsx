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
    expect(screen.getByText(/what does 'check line-up' mean/i)).toBeInTheDocument();
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

  it("explains the Discover filters", () => {
    render(<FaqSection />);
    const answer = screen
      .getByText(/how do i use the filters on the discover tab/i)
      .closest("details");
    expect(answer).toHaveTextContent(/local radar/i);
    expect(answer).toHaveTextContent(/newly announced/i);
    expect(answer).toHaveTextContent(/artist criteria/i);
    expect(answer).toHaveTextContent(/save these as my default/i);
  });

  it("finds the Discover filters answer by keyword", () => {
    render(<FaqSection />);
    fireEvent.change(screen.getByPlaceholderText(/search questions/i), {
      target: { value: "discover" },
    });
    expect(screen.getByText(/how do i use the filters on the discover tab/i)).toBeInTheDocument();
  });

  it("explains the cover band or tribute act tick box", () => {
    render(<FaqSection />);
    const answer = screen
      .getByText(/what does the cover band or tribute act tick box do/i)
      .closest("details");
    expect(answer).toHaveTextContent(/cover band/i);
  });

  it("explains Lucky Dip, the three-roll limit and the Flat and Arcade views", () => {
    render(<FaqSection />);
    const answer = screen.getByText(/how do lucky dip and re-roll work/i).closest("details");
    expect(answer).toHaveTextContent(/three/i);
    expect(answer).toHaveTextContent(/arcade/i);
    expect(answer).toHaveTextContent(/flat/i);
  });

  it("names the gig report widgets and the customiser", () => {
    render(<FaqSection />);
    const answer = screen
      .getByText(/what are the widgets on the gigs report, and can i hide them/i)
      .closest("details");
    expect(answer).toHaveTextContent(/gig odyssey map/i);
    expect(answer).toHaveTextContent(/post-gig surge/i);
    expect(answer).toHaveTextContent(/setlist replay tracker/i);
  });

  it("says where past Wrapped years live and how to share a slide", () => {
    render(<FaqSection />);
    const answer = screen.getByText(/where do i find my past wrapped years/i).closest("details");
    expect(answer).toHaveTextContent(/wrapped tab/i);
    expect(answer).toHaveTextContent(/2020/);
    expect(answer).toHaveTextContent(/share/i);
  });

  it("explains the Timeline source markers, quiet gaps and Library Grid or List", () => {
    render(<FaqSection />);
    const answer = screen
      .getByText(/what do the markers and quiet gaps on the today page mean/i)
      .closest("details");
    expect(answer).toHaveTextContent(/quiet gap/i);
    expect(answer).toHaveTextContent(/grid/i);
  });

  it("says Timeline is the default skin and existing accounts keep theirs", () => {
    render(<FaqSection />);
    const answer = screen
      .getByText(/what are visual skins, and which skins are available/i)
      .closest("details");
    expect(answer).toHaveTextContent(/timeline is the default/i);
    expect(answer).toHaveTextContent(/keep the skin they already have/i);
  });

  it("says Share Scrobbles cannot be undone", () => {
    render(<FaqSection />);
    const answer = screen.getByText(/can i undo share scrobbles/i).closest("details");
    expect(answer).toHaveTextContent(/cannot be undone|can't be undone/i);
  });

  it("page map lists Today, Discover and the Wrapped tab", () => {
    render(<FaqSection />);
    const answer = screen.getByText(/what does each page in the app do/i).closest("details");
    expect(answer).toHaveTextContent(/today/i);
    expect(answer).toHaveTextContent(/discover/i);
    expect(answer).toHaveTextContent(/wrapped/i);
  });
});
