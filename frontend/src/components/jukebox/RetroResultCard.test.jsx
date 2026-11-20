import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RetroResultCard from "./RetroResultCard";

const pick = {
  id: 7,
  album_name: "Abbey Road",
  artist_name: "The Beatles",
  release_year: 1969,
  play_count: 42,
  spotify_url: "https://open.spotify.com/album/7",
};

const baseProps = {
  currentPick: pick,
  sessionActive: false,
  sourceMode: "library",
  mode: "any",
  rollsLeft: 3,
  busy: false,
  outOfRolls: false,
  spotifyLink: pick.spotify_url,
  onReroll: vi.fn(),
  onCommit: vi.fn(),
  onToggle1001Completed: vi.fn(),
  onToggleRoughTradeCompleted: vi.fn(),
};

describe("RetroResultCard", () => {
  afterEach(() => cleanup());

  describe("tag", () => {
    it("says it is today's featured pick before any Lucky Dip", () => {
      render(<RetroResultCard {...baseProps} />);
      expect(screen.getByText("Today's featured pick")).toBeInTheDocument();
    });

    it("names the Pick from mode during a library session", () => {
      render(<RetroResultCard {...baseProps} sessionActive mode="least" />);
      expect(screen.getByText("Lucky dip · Least played")).toBeInTheDocument();
    });

    it("names the list in 1001 and Rough Trade modes", () => {
      const { rerender } = render(
        <RetroResultCard {...baseProps} sessionActive sourceMode="1001" />
      );
      expect(screen.getByText("Lucky dip · 1001 Albums")).toBeInTheDocument();
      rerender(<RetroResultCard {...baseProps} sessionActive sourceMode="rough_trade" />);
      expect(screen.getByText("Lucky dip · Rough Trade Top 100")).toBeInTheDocument();
    });
  });

  describe("cover", () => {
    it("falls back to a generated cover with initials when there is no artwork", () => {
      render(<RetroResultCard {...baseProps} />);
      expect(screen.getByTestId("retro-cover")).toHaveTextContent("AR");
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("shows the artwork and drops back to initials if the image fails", () => {
      render(
        <RetroResultCard
          {...baseProps}
          currentPick={{ ...pick, artwork_url: "https://example.test/cover.jpg" }}
        />
      );
      const image = screen.getByTestId("retro-cover").querySelector("img");
      expect(image).toHaveAttribute("src", "https://example.test/cover.jpg");

      fireEvent.error(image);
      expect(screen.getByTestId("retro-cover").querySelector("img")).toBeNull();
      expect(screen.getByTestId("retro-cover")).toHaveTextContent("AR");
    });
  });

  describe("title, artist and details", () => {
    it("keeps explicit high-contrast colours on the title and artist", () => {
      render(<RetroResultCard {...baseProps} />);
      expect(screen.getByRole("heading", { level: 3, name: "Abbey Road" })).toHaveStyle({
        color: "#24212b",
      });
      expect(screen.getByText("The Beatles (1969)")).toHaveStyle({ color: "#394651" });
    });

    it("shows plays when the album has a play count and leaves the row out otherwise", () => {
      const { rerender } = render(<RetroResultCard {...baseProps} />);
      expect(screen.getByText("Plays")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();

      rerender(<RetroResultCard {...baseProps} currentPick={{ ...pick, play_count: undefined }} />);
      expect(screen.queryByText("Plays")).not.toBeInTheDocument();
    });

    it("shows decade and genres for a 1001 pick and rank and year for Rough Trade", () => {
      const { rerender } = render(
        <RetroResultCard
          {...baseProps}
          sourceMode="1001"
          currentPick={{ ...pick, decade: 1960, genres: ["Rock", "Pop"] }}
        />
      );
      expect(screen.getByText("1960s")).toBeInTheDocument();
      expect(screen.getByText("Rock, Pop")).toBeInTheDocument();

      rerender(
        <RetroResultCard
          {...baseProps}
          sourceMode="rough_trade"
          currentPick={{ ...pick, rank: 12, year: 2024 }}
        />
      );
      expect(screen.getByText("#12")).toBeInTheDocument();
      expect(screen.getByText("Rough Trade 2024")).toBeInTheDocument();
    });

    it("wraps a very long title inside the card", () => {
      const longTitle =
        "The Rise and Fall of Ziggy Stardust and the Spiders from Mars and Other Long Things";
      render(<RetroResultCard {...baseProps} currentPick={{ ...pick, album_name: longTitle }} />);
      expect(screen.getByRole("heading", { level: 3, name: longTitle })).toBeInTheDocument();
    });

    it("says so when nothing has been picked", () => {
      render(<RetroResultCard {...baseProps} currentPick={null} />);
      expect(
        screen.getByRole("heading", { level: 3, name: "No Album Picked" })
      ).toBeInTheDocument();
    });
  });

  describe("Mark Played", () => {
    it("toggles a 1001 album", () => {
      const onToggle1001Completed = vi.fn();
      render(
        <RetroResultCard
          {...baseProps}
          sourceMode="1001"
          onToggle1001Completed={onToggle1001Completed}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: "Mark Abbey Road as played" }));
      expect(onToggle1001Completed).toHaveBeenCalledWith(7, true);
    });

    it("un-marks a completed Rough Trade album and shows it as played", () => {
      const onToggleRoughTradeCompleted = vi.fn();
      render(
        <RetroResultCard
          {...baseProps}
          sourceMode="rough_trade"
          currentPick={{ ...pick, is_completed: true }}
          onToggleRoughTradeCompleted={onToggleRoughTradeCompleted}
        />
      );
      const button = screen.getByRole("button", { name: "Mark Abbey Road as unplayed" });
      expect(button).toHaveTextContent("✓ Played");
      fireEvent.click(button);
      expect(onToggleRoughTradeCompleted).toHaveBeenCalledWith(7, false);
    });

    it("is not offered in Library mode", () => {
      render(<RetroResultCard {...baseProps} />);
      expect(screen.queryByRole("button", { name: /Mark Abbey Road/ })).not.toBeInTheDocument();
    });
  });

  describe("Re-roll and Open in Spotify", () => {
    it("disables Re-roll until a session is running and when rolls run out", () => {
      const { rerender } = render(<RetroResultCard {...baseProps} />);
      expect(screen.getByRole("button", { name: "Re-roll (3)" })).toBeDisabled();

      rerender(<RetroResultCard {...baseProps} sessionActive />);
      expect(screen.getByRole("button", { name: "Re-roll (3)" })).toBeEnabled();

      rerender(<RetroResultCard {...baseProps} sessionActive rollsLeft={0} outOfRolls />);
      expect(screen.getByRole("button", { name: "Re-roll (0)" })).toBeDisabled();
    });

    it("calls the re-roll handler", () => {
      const onReroll = vi.fn();
      render(<RetroResultCard {...baseProps} sessionActive onReroll={onReroll} />);
      fireEvent.click(screen.getByRole("button", { name: "Re-roll (3)" }));
      expect(onReroll).toHaveBeenCalledTimes(1);
    });

    it("opens Spotify in a new tab safely and commits the session", () => {
      const onCommit = vi.fn();
      render(<RetroResultCard {...baseProps} onCommit={onCommit} />);
      const link = screen.getByRole("link", { name: "Open in Spotify" });
      expect(link).toHaveAttribute("href", pick.spotify_url);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      fireEvent.click(link);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe("status line", () => {
    it("counts the re-rolls left during a session", () => {
      render(<RetroResultCard {...baseProps} sessionActive rollsLeft={2} />);
      expect(screen.getByText("Re-rolls left: 2")).toBeInTheDocument();
    });

    it("says when the rolls have run out", () => {
      render(<RetroResultCard {...baseProps} sessionActive rollsLeft={0} outOfRolls />);
      expect(screen.getByText("No more rolls – give it a spin!")).toBeInTheDocument();
    });

    it("invites a Lucky Dip before a session starts", () => {
      render(<RetroResultCard {...baseProps} />);
      expect(screen.getByText("Hit Lucky Dip for a random record.")).toBeInTheDocument();
    });
  });
});
