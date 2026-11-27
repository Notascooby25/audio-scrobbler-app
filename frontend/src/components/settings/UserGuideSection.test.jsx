import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import UserGuideSection from "./UserGuideSection";

describe("UserGuideSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all guide chapters and quick jump navigation", () => {
    render(<UserGuideSection />);
    expect(
      screen.getByRole("heading", { name: /1\. getting started & how it works/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /2\. connecting & importing history/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /3\. listening with friends & copying scrobbles/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /4\. bbc sounds & radio tracklists/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /5\. exploring your music & reports/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /6\. privacy, cleanup & data ownership/i })
    ).toBeInTheDocument();
  });

  it("highlights specific instructions for car journeys and radio extraction", () => {
    render(<UserGuideSection />);
    expect(screen.getByText(/car journey or road trip/i)).toBeInTheDocument();
    expect(screen.getByText(/scope creep/i)).toBeInTheDocument();
  });

  it("provides quick-jump anchor navigation to each chapter", () => {
    render(<UserGuideSection />);
    expect(screen.getByRole("link", { name: /^getting started$/i })).toHaveAttribute(
      "href",
      "#guide-getting-started"
    );
    expect(screen.getByRole("link", { name: /^copying scrobbles$/i })).toHaveAttribute(
      "href",
      "#guide-friends"
    );
    expect(screen.getByRole("link", { name: /^bbc sounds$/i })).toHaveAttribute(
      "href",
      "#guide-radio"
    );
  });

  it("explains recommending music and the Reports info hints", () => {
    render(<UserGuideSection />);
    expect(screen.getByText(/recommend music to friends/i)).toBeInTheDocument();
    expect(screen.getByText(/tap the ⓘ next to a chart or card title/i)).toBeInTheDocument();
  });

  it("explains Lucky Dip rolls and the Flat and Arcade views", () => {
    render(<UserGuideSection />);
    expect(screen.getByText(/up to three rolls/i)).toBeInTheDocument();
    expect(screen.getByText(/flat and arcade views/i)).toBeInTheDocument();
  });

  it("explains the Today page rail and the Library List and Grid buttons", () => {
    render(<UserGuideSection />);
    expect(screen.getByText(/the today page/i)).toBeInTheDocument();
    expect(screen.getByText(/list and grid buttons/i)).toBeInTheDocument();
  });

  it("says Timeline is the default skin", () => {
    render(<UserGuideSection />);
    expect(screen.getByText(/timeline is the default skin for new accounts/i)).toBeInTheDocument();
  });

  it("says Share Scrobbles cannot be undone", () => {
    render(<UserGuideSection />);
    expect(screen.getByText(/sharing cannot be undone/i)).toBeInTheDocument();
  });

  it("names the gig report widgets and says earlier Wrapped years have no banner", () => {
    render(<UserGuideSection />);
    expect(screen.getByText(/setlist replay tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/venue stomping grounds/i)).toBeInTheDocument();
    expect(screen.getByText(/earlier years have no banner/i)).toBeInTheDocument();
  });

  it("explains follower alerts and removing a follower", () => {
    render(<UserGuideSection />);
    expect(screen.getByText(/see who follows you/i)).toBeInTheDocument();
  });
});
