import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SourceBadge, { resolveSourceType, getSourceLabel } from "./SourceBadge";

describe("SourceBadge", () => {
  it("resolves source types correctly", () => {
    expect(resolveSourceType(null)).toBeNull();
    expect(resolveSourceType([])).toBeNull();
    expect(resolveSourceType("spotify")).toBe("spotify");
    expect(resolveSourceType("spotify_realtime")).toBe("spotify");
    expect(resolveSourceType(["spotify"])).toBe("spotify");
    expect(resolveSourceType("youtube")).toBe("youtube");
    expect(resolveSourceType(["youtube"])).toBe("youtube");
    expect(resolveSourceType(["spotify", "youtube"])).toBe("split");
    expect(resolveSourceType(["youtube", "spotify"])).toBe("split");
    expect(resolveSourceType("bbc_sounds")).toBe("bbc");
    expect(resolveSourceType(["bbc_sounds"])).toBe("bbc");
    expect(resolveSourceType("bbc")).toBe("bbc");
    expect(resolveSourceType("apple")).toBe("apple");
    expect(resolveSourceType("apple_music")).toBe("apple");
    expect(resolveSourceType("itunes")).toBe("apple");
    expect(resolveSourceType("setlistfm")).toBe("gig");
    expect(resolveSourceType("setlist")).toBe("gig");
    expect(resolveSourceType("gig")).toBe("gig");
    expect(resolveSourceType(["setlistfm"])).toBe("gig");
    expect(resolveSourceType("import")).toBe("import");
    expect(resolveSourceType(["custom_source"])).toBe("fallback");
    expect(resolveSourceType(["other"])).toBe("fallback");
  });

  it("returns human-readable labels", () => {
    expect(getSourceLabel("split")).toBe("Scrobbled via Spotify and YouTube");
    expect(getSourceLabel("spotify")).toBe("Scrobbled via Spotify");
    expect(getSourceLabel("youtube")).toBe("Scrobbled via YouTube Music");
    expect(getSourceLabel("apple")).toBe("Scrobbled via Apple Music");
    expect(getSourceLabel("bbc")).toBe("Scrobbled via BBC Sounds");
    expect(getSourceLabel("gig")).toBe("Scrobbled from live gig");
    expect(getSourceLabel("import")).toBe("Imported scrobble");
    expect(getSourceLabel("fallback")).toBe("Scrobbled track");
  });

  it("renders nothing when no sources are provided", () => {
    const { container } = render(<SourceBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Spotify badge with accessible label", () => {
    render(<SourceBadge source="spotify" />);
    const badge = screen.getByRole("img", { name: "Scrobbled via Spotify" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("source-badge-spotify");
    expect(badge).toHaveClass("source-badge-list");
  });

  it("renders YouTube badge with accessible label", () => {
    render(<SourceBadge source="youtube" />);
    const badge = screen.getByRole("img", { name: "Scrobbled via YouTube Music" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("source-badge-youtube");
  });

  it("renders Apple Music badge with accessible label", () => {
    render(<SourceBadge source="apple" />);
    const badge = screen.getByRole("img", { name: "Scrobbled via Apple Music" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("source-badge-apple");
    expect(badge).toHaveClass("source-badge-list");
  });

  it("renders BBC Sounds badge with accessible label", () => {
    render(<SourceBadge source="bbc_sounds" />);
    const badge = screen.getByRole("img", { name: "Scrobbled via BBC Sounds" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("source-badge-bbc");
    expect(badge).toHaveClass("source-badge-list");
  });

  it("renders Gig badge with accessible label", () => {
    render(<SourceBadge source="setlistfm" />);
    const badge = screen.getByRole("img", { name: "Scrobbled from live gig" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("source-badge-gig");
    expect(badge).toHaveClass("source-badge-list");
  });

  it("renders split badge when both Spotify and YouTube are present", () => {
    render(<SourceBadge sources={["spotify", "youtube"]} size="grid" />);
    const badge = screen.getByRole("img", { name: "Scrobbled via Spotify and YouTube" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("source-badge-split");
    expect(badge).toHaveClass("source-badge-grid");
  });

  it("renders import badge for imported data", () => {
    render(<SourceBadge source="import" />);
    const badge = screen.getByRole("img", { name: "Imported scrobble" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("source-badge-import");
  });

  it("renders geometric fallback badge for unknown custom sources", () => {
    render(<SourceBadge source="my_custom_tracker" />);
    const badge = screen.getByRole("img", { name: "Scrobbled track" });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("source-badge-fallback");
  });
});
