import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WrappedStory from "./WrappedStory";
import { sampleSnapshot } from "./sampleSnapshot";
import { buildSlides } from "./buildSlides";

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));

afterEach(() => cleanup());

function position() {
  return Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
}

describe("WrappedStory", () => {
  it("starts on the first slide and shows the position", () => {
    const snapshot = sampleSnapshot();
    render(<WrappedStory snapshot={snapshot} onClose={() => {}} />);
    expect(position()).toBe(1);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      String(buildSlides(snapshot).length)
    );
    expect(screen.getByText("Your 2026 in music")).toBeInTheDocument();
  });

  it("goes on with the right side and back with the left side", () => {
    render(<WrappedStory snapshot={sampleSnapshot()} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(position()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(position()).toBe(1);
  });

  it("can't go back from the first slide or on from the last", () => {
    const snapshot = sampleSnapshot();
    render(<WrappedStory snapshot={snapshot} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeDisabled();
    for (let i = 1; i < buildSlides(snapshot).length; i += 1) {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    }
    expect(screen.getByRole("button", { name: "Next slide" })).toBeDisabled();
  });

  it("works with the arrow keys and closes on Escape", () => {
    const onClose = vi.fn();
    render(<WrappedStory snapshot={sampleSnapshot()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(position()).toBe(2);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(position()).toBe(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("never moves on by itself", () => {
    vi.useFakeTimers();
    render(<WrappedStory snapshot={sampleSnapshot()} onClose={() => {}} />);
    vi.advanceTimersByTime(120000);
    expect(position()).toBe(1);
    vi.useRealTimers();
  });

  it("tags slides whose numbers changed in the full-year version", () => {
    const snapshot = sampleSnapshot({ changed: ["music.estimated_minutes"] });
    render(<WrappedStory snapshot={snapshot} onClose={() => {}} />);
    expect(screen.queryByText(/updated with the full year/i)).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText(/updated with the full year/i)).toBeInTheDocument();
  });

  it("has a Share button and a Close button", () => {
    render(<WrappedStory snapshot={sampleSnapshot()} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
