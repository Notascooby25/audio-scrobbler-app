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
});
