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

describe("buildSlides: order and parts", () => {
  it("runs intro, Part 1 music, Part 2 gigs, then the summary", () => {
    const all = ids(sampleSnapshot());
    expect(all[0]).toBe("intro");
    expect(all.indexOf("part-music")).toBeLessThan(all.indexOf("minutes"));
    expect(all.indexOf("minutes")).toBeLessThan(all.indexOf("part-gigs"));
    expect(all.indexOf("part-gigs")).toBeLessThan(all.indexOf("gigs-glance"));
    expect(all[all.length - 1]).toBe("summary");
  });

  it("tags every slide with the part it belongs to", () => {
    const slides = buildSlides(sampleSnapshot());
    const part = (id) => slides.find((s) => s.id === id).part;
    expect(part("minutes")).toBe(1);
    expect(part("part-gigs")).toBe(2);
    expect(part("gigs-miles")).toBe(2);
    expect(part("summary")).toBe(2);
  });

  it("uses a different background for each part and an accent card to open each one", () => {
    const slides = buildSlides(sampleSnapshot());
    const tone = (id) => slides.find((s) => s.id === id).tone;
    expect(tone("minutes")).toBe("dark");
    expect(tone("gigs-glance")).toBe("light");
    expect(tone("part-music")).toBe("accent");
    expect(tone("part-gigs")).toBe("accent");
  });

  it("labels each slide's section", () => {
    const slides = buildSlides(sampleSnapshot());
    expect(slides.find((s) => s.id === "artists").label).toBe("Music");
    expect(slides.find((s) => s.id === "gigs-calendar").label).toBe("Gigs");
  });

  it("skips the gig slides and the part cards when there are no gigs", () => {
    const all = ids(sampleSnapshot({ gigs: null }));
    expect(all.some((id) => id.startsWith("gigs"))).toBe(false);
    expect(all).not.toContain("part-music");
    expect(all).not.toContain("part-gigs");
  });

  it("skips the music slides when there is no music", () => {
    const all = ids(sampleSnapshot({ music: null }));
    expect(all).toContain("gigs-glance");
    expect(all).not.toContain("minutes");
    expect(all).not.toContain("part-gigs");
  });

  it("skips slides with nothing to show", () => {
    const snapshot = sampleSnapshot();
    snapshot.music.top_albums = [];
    snapshot.music.top_genres = [];
    snapshot.gigs.miles = null;
    delete snapshot.gigs.gig_list;
    const all = ids(snapshot);
    expect(all).not.toContain("albums");
    expect(all).not.toContain("genres");
    expect(all).not.toContain("gigs-miles");
    expect(all.some((id) => id.startsWith("gigs-list"))).toBe(false);
  });

  it("skips the miles slide when no venue could be placed", () => {
    const snapshot = sampleSnapshot();
    snapshot.gigs.miles = { total: 0, furthest: null, left_out: 3, by_city: 0 };
    expect(ids(snapshot)).not.toContain("gigs-miles");
  });

  it("shares gigs evenly across pages so the last page isn't nearly empty", () => {
    const snapshot = sampleSnapshot();
    snapshot.gigs.gig_list = Array.from({ length: 13 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      artist: `Act ${i + 1}`,
      venue: `Venue ${i + 1}`,
      city: "Leeds",
      festival: null,
    }));
    const sizes = [1, 2, 3].map((page) => {
      cleanup();
      renderSlide(snapshot, `gigs-list-${page}`);
      return document.querySelectorAll(".wrapped-gigs li").length;
    });
    expect(sizes).toEqual([5, 4, 4]);
  });

  it("splits a long gig list into pages of six at most", () => {
    const snapshot = sampleSnapshot();
    snapshot.gigs.gig_list = Array.from({ length: 13 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      artist: `Act ${i + 1}`,
      venue: `Venue ${i + 1}`,
      city: "Leeds",
      festival: null,
    }));
    snapshot.gigs.nights = 20;
    const pages = ids(snapshot).filter((id) => id.startsWith("gigs-list"));
    expect(pages).toEqual(["gigs-list-1", "gigs-list-2", "gigs-list-3"]);
    renderSlide(snapshot, "gigs-list-3");
    expect(screen.getByText("Act 13")).toBeInTheDocument();
    expect(screen.getByText(/and 7 more/i)).toBeInTheDocument();
  });
});

describe("intro", () => {
  it("labels a year that starts part way through", () => {
    renderSlide(sampleSnapshot({ partial_from: "2026-03-14" }), "intro");
    expect(screen.getByText(/from 14 March 2026/i)).toBeInTheDocument();
  });

  it("shows the year big and says what the story covers", () => {
    renderSlide(sampleSnapshot(), "intro");
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText(/your year in music and gigs/i)).toBeInTheDocument();
  });
});

describe("music slides", () => {
  it("opens with a title card for each part", () => {
    renderSlide(sampleSnapshot(), "part-music");
    expect(screen.getByRole("heading", { name: "Your music" })).toBeInTheDocument();
    cleanup();
    renderSlide(sampleSnapshot(), "part-gigs");
    expect(screen.getByRole("heading", { name: "Your gigs" })).toBeInTheDocument();
  });

  it("says minutes are estimated from track length", () => {
    renderSlide(sampleSnapshot(), "minutes");
    expect(screen.getByText("61,420")).toBeInTheDocument();
    expect(screen.getByText(/estimated from track length/i)).toBeInTheDocument();
  });

  it("names the busiest month", () => {
    renderSlide(sampleSnapshot(), "months");
    expect(screen.getByText(/busiest month was/i)).toHaveTextContent("May");
  });

  it("makes the top artist a big picture slide", () => {
    renderSlide(sampleSnapshot(), "top-artist");
    expect(screen.getByRole("heading", { name: "Your top artist" })).toBeInTheDocument();
    expect(screen.getByText("Artist A", { selector: "p" })).toBeInTheDocument();
    expect(document.querySelector(".wrapped-cover-hero img")).toHaveAttribute(
      "src",
      "https://img.example/a.jpg"
    );
  });

  it("lists the top five artists with plays and a cover each", () => {
    renderSlide(sampleSnapshot(), "artists");
    expect(screen.getByText("Artist E")).toBeInTheDocument();
    expect(screen.getByText(/812/)).toBeInTheDocument();
    expect(document.querySelectorAll(".wrapped-rows .wrapped-cover")).toHaveLength(5);
  });

  it("shows the listening clock label", () => {
    renderSlide(sampleSnapshot(), "clock");
    expect(screen.getByText("Night owl")).toBeInTheDocument();
    expect(screen.getByText(/11pm/)).toBeInTheDocument();
  });

  it("shows full names, never cut off", () => {
    const long = "An Extremely Long Album Title That Would Once Have Been Cut Off With Dots";
    const snapshot = sampleSnapshot();
    snapshot.music.top_albums = [{ name: long, artist: "Some Artist", plays: 10 }];
    renderSlide(snapshot, "albums");
    expect(screen.getByText(long)).toBeInTheDocument();
    expect(document.querySelector(".wrapped-truncate")).toBeNull();
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

  it("lists each gig with artist, venue, city, date and festival name", () => {
    renderSlide(sampleSnapshot(), "gigs-list-1");
    expect(screen.getByRole("heading", { name: "Your gigs" })).toBeInTheDocument();
    expect(screen.getByText("17 Jan")).toBeInTheDocument();
    expect(screen.getByText("Artist A")).toBeInTheDocument();
    expect(screen.getByText("Venue One, Leeds")).toBeInTheDocument();
    expect(screen.getByText("Big Weekend, The Field, Pilton")).toBeInTheDocument();
  });

  it("says the miles are there and back, as the crow flies", () => {
    renderSlide(sampleSnapshot(), "gigs-miles");
    expect(screen.getByText("2,310")).toBeInTheDocument();
    expect(screen.getByText(/there and back, as the crow flies/i)).toBeInTheDocument();
    expect(screen.getByText(/Venue X/)).toBeInTheDocument();
  });

  it("only mentions left-out and city-placed gigs when there are some", () => {
    renderSlide(sampleSnapshot(), "gigs-miles");
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

  it("shows highlights with the whole artist name", () => {
    const snapshot = sampleSnapshot();
    snapshot.gigs.most_seen = { artist: "A".repeat(80), times: 3 };
    renderSlide(snapshot, "gigs-highlights");
    expect(screen.getByText(new RegExp(`A{80} \\(3x\\)`))).toBeInTheDocument();
    expect(screen.getByText(/17 January/)).toBeInTheDocument();
    expect(screen.getByText(/71 days/)).toBeInTheDocument();
    expect(screen.getByText(/312/)).toBeInTheDocument();
  });
});
