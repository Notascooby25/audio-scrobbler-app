import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { buildSlides } from "./buildSlides";
import { sampleSnapshot } from "./sampleSnapshot";

afterEach(() => cleanup());

function ids(snapshot) {
  return buildSlides(snapshot).map((slide) => slide.id);
}

function renderSlide(snapshot, id) {
  const slide = buildSlides(snapshot).find((s) => s.id === id);
  render(<div>{slide.node}</div>);
}

describe("buildSlides", () => {
  it("orders music, then gigs, then the summary", () => {
    const all = ids(sampleSnapshot());
    expect(all[0]).toBe("intro");
    expect(all.indexOf("minutes")).toBeLessThan(all.indexOf("gigs-glance"));
    expect(all[all.length - 1]).toBe("summary");
  });

  it("skips the gig slides when there are no gigs", () => {
    const all = ids(sampleSnapshot({ gigs: null }));
    expect(all.some((id) => id.startsWith("gigs"))).toBe(false);
  });

  it("skips the music slides when there is no music", () => {
    const all = ids(sampleSnapshot({ music: null }));
    expect(all).toContain("gigs-glance");
    expect(all).not.toContain("minutes");
  });

  it("skips slides with nothing to show", () => {
    const snapshot = sampleSnapshot();
    snapshot.music.top_albums = [];
    snapshot.music.top_genres = [];
    snapshot.gigs.miles = null;
    const all = ids(snapshot);
    expect(all).not.toContain("albums");
    expect(all).not.toContain("genres");
    expect(all).not.toContain("gigs-miles");
  });

  it("skips the miles slide when no venue could be placed", () => {
    const snapshot = sampleSnapshot();
    snapshot.gigs.miles = { total: 0, furthest: null, left_out: 3, by_city: 0 };
    expect(ids(snapshot)).not.toContain("gigs-miles");
  });

  it("labels a year that starts part way through", () => {
    renderSlide(sampleSnapshot({ partial_from: "2026-03-14" }), "intro");
    expect(screen.getByText(/from 14 March 2026/i)).toBeInTheDocument();
  });
});

describe("music slides", () => {
  it("says minutes are estimated from track length", () => {
    renderSlide(sampleSnapshot(), "minutes");
    expect(screen.getByText("61,420")).toBeInTheDocument();
    expect(screen.getByText(/estimated from track length/i)).toBeInTheDocument();
  });

  it("names the busiest month", () => {
    renderSlide(sampleSnapshot(), "months");
    expect(screen.getByText(/busiest month was/i)).toHaveTextContent("May");
  });

  it("lists the top five artists with plays", () => {
    renderSlide(sampleSnapshot(), "artists");
    expect(screen.getByText("Artist A")).toBeInTheDocument();
    expect(screen.getByText(/812/)).toBeInTheDocument();
    expect(screen.getByText("Artist E")).toBeInTheDocument();
  });

  it("shows the listening clock label", () => {
    renderSlide(sampleSnapshot(), "clock");
    expect(screen.getByText("Night owl")).toBeInTheDocument();
    expect(screen.getByText(/11pm/)).toBeInTheDocument();
  });
});

describe("gig slides", () => {
  it("shows nights, artists, venues, festival nights and new venues", () => {
    renderSlide(sampleSnapshot(), "gigs-glance");
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText(/11 different artists/)).toBeInTheDocument();
    expect(screen.getByText(/9 venues/)).toBeInTheDocument();
    expect(screen.getByText(/2 festival nights/)).toBeInTheDocument();
    expect(screen.getByText(/3 venues new to you/)).toBeInTheDocument();
  });

  it("says the miles are there and back, as the crow flies", () => {
    renderSlide(sampleSnapshot(), "gigs-miles");
    expect(screen.getByText("2,310")).toBeInTheDocument();
    expect(screen.getByText(/there and back, as the crow flies/i)).toBeInTheDocument();
    expect(screen.getByText(/Venue X/)).toBeInTheDocument();
  });

  it("only mentions left-out and city-placed gigs when there are some", () => {
    const quiet = sampleSnapshot();
    renderSlide(quiet, "gigs-miles");
    expect(screen.queryByText(/left out/i)).not.toBeInTheDocument();
    cleanup();
    const noisy = sampleSnapshot();
    noisy.gigs.miles.left_out = 2;
    noisy.gigs.miles.by_city = 1;
    renderSlide(noisy, "gigs-miles");
    expect(screen.getByText(/2 gigs left out/i)).toBeInTheDocument();
    expect(screen.getByText(/1 placed by city/i)).toBeInTheDocument();
  });

  it("marks the months with a gig and names the busiest", () => {
    renderSlide(sampleSnapshot(), "gigs-calendar");
    expect(screen.getByText(/8 of 12/)).toBeInTheDocument();
    expect(screen.getByText(/June \(4\)/)).toBeInTheDocument();
    expect(screen.getByText("Jun").closest("[data-active]")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Feb").closest("[data-active]")).toHaveAttribute(
      "data-active",
      "false"
    );
  });

  it("shows highlights", () => {
    renderSlide(sampleSnapshot(), "gigs-highlights");
    expect(screen.getByText(/Artist A \(3x\)/)).toBeInTheDocument();
    expect(screen.getByText(/17 January/)).toBeInTheDocument();
    expect(screen.getByText(/71 days/)).toBeInTheDocument();
    expect(screen.getByText(/312/)).toBeInTheDocument();
  });

  it("copes with very long names", () => {
    const snapshot = sampleSnapshot();
    snapshot.gigs.most_seen = { artist: "A".repeat(200), times: 2 };
    renderSlide(snapshot, "gigs-highlights");
    expect(screen.getByText(/A{50}/)).toHaveClass("wrapped-truncate");
  });
});
