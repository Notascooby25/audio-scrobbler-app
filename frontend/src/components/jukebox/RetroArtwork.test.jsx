import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RetroArtwork from "./RetroArtwork";

const SPOTIFY = "https://i.scdn.co/image/ab67616d0000b273abcdef0123456789abcdef01";
const SPOTIFY_THUMB = "https://i.scdn.co/image/ab67616d00004851abcdef0123456789abcdef01";

describe("RetroArtwork", () => {
  afterEach(() => cleanup());

  it("renders nothing without a source", () => {
    const { container } = render(<RetroArtwork src={undefined} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("asks for the small version first, loading lazily and without blocking", () => {
    const { container } = render(<RetroArtwork src={SPOTIFY} className="x" />);
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", SPOTIFY_THUMB);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveClass("x");
  });

  it("falls back to the full image if the small one fails, then gives up", () => {
    const { container } = render(<RetroArtwork src={SPOTIFY} />);
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toHaveAttribute("src", SPOTIFY);

    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
  });

  it("gives up straight away when there is no smaller version to try", () => {
    const { container } = render(<RetroArtwork src="https://example.test/cover.jpg" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.test/cover.jpg");
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
  });

  it("starts again when the source changes after a failure", () => {
    const { container, rerender } = render(<RetroArtwork src="https://example.test/a.jpg" />);
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();

    rerender(<RetroArtwork src="https://example.test/b.jpg" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.test/b.jpg");
  });
});
