import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LikedHeart from "./LikedHeart";

describe("LikedHeart", () => {
  afterEach(() => cleanup());

  it("renders a static span badge by default", () => {
    render(<LikedHeart liked={true} />);
    const badge = screen.getByRole("img", { name: "Liked on Spotify" });
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveClass("liked-heart-active");
  });

  it("renders an interactive button when interactive={true}", () => {
    const handleToggle = vi.fn();
    render(<LikedHeart liked={false} interactive={true} onToggle={handleToggle} />);
    const btn = screen.getByRole("button", { name: "Like on Spotify" });
    expect(btn.tagName).toBe("BUTTON");

    fireEvent.click(btn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("displays Unlike on Spotify when liked={true} in interactive mode", () => {
    const handleToggle = vi.fn();
    render(<LikedHeart liked={true} interactive={true} onToggle={handleToggle} />);
    const btn = screen.getByRole("button", { name: "Unlike on Spotify" });
    expect(btn).toHaveClass("liked-heart-active");

    fireEvent.click(btn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("prevents clicks when busy={true}", () => {
    const handleToggle = vi.fn();
    render(<LikedHeart liked={false} interactive={true} onToggle={handleToggle} busy={true} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(handleToggle).not.toHaveBeenCalled();
  });

  it("prevents clicks when disabled={true}", () => {
    const handleToggle = vi.fn();
    render(<LikedHeart liked={false} interactive={true} onToggle={handleToggle} disabled={true} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(handleToggle).not.toHaveBeenCalled();
  });
});
