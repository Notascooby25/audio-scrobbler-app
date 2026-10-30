import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import VenueFestivals from "./VenueFestivals";

const gigs = [
  {
    id: 1,
    artist_name: "The Wombats",
    is_festival: true,
    festival_name: "V Festival – 2009",
    event_date: "2009-08-23",
    date: "23 Aug 2009",
  },
  {
    id: 2,
    artist_name: "Oasis",
    is_festival: true,
    festival_name: "V Festival – 2009",
    event_date: "2009-08-22",
    date: "22 Aug 2009",
  },
  {
    id: 3,
    artist_name: "Shed Seven",
    is_festival: true,
    festival_name: "V Festival - 2008",
    event_date: "2008-08-17",
    date: "17 Aug 2008",
  },
  {
    id: 4,
    artist_name: "Doves",
    is_festival: false,
    festival_name: null,
    event_date: "2019-05-01",
    date: "01 May 2019",
  },
];

describe("VenueFestivals", () => {
  afterEach(() => {
    cleanup();
  });

  it("groups festival gigs by festival, ignoring the year", () => {
    render(<VenueFestivals gigs={gigs} />);

    expect(screen.getByRole("button", { name: "V Festival · 3 gigs" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Oasis" })).not.toBeInTheDocument();
  });

  it("opens a festival to list all of its gigs", () => {
    render(<VenueFestivals gigs={gigs} />);

    fireEvent.click(screen.getByRole("button", { name: "V Festival · 3 gigs" }));

    const list = screen.getByRole("button", { name: "V Festival · 3 gigs" }).parentElement;
    expect(within(list).getByText("The Wombats")).toBeInTheDocument();
    expect(within(list).getByText("Shed Seven")).toBeInTheDocument();
  });

  it("shows nothing when the venue has no festival gigs", () => {
    const { container } = render(<VenueFestivals gigs={[gigs[3]]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
