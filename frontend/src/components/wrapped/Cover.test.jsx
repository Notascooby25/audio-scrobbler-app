import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import Cover from "./Cover";

afterEach(() => cleanup());

describe("Cover", () => {
  it("shows the picture on top of the tile", () => {
    const { container } = render(<Cover src="https://img/a.jpg" name="Artist" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://img/a.jpg");
    expect(container.querySelector(".wrapped-cover-initial")).toHaveTextContent("A");
  });

  it("falls back to the tile when there is no picture", () => {
    const { container } = render(<Cover src={null} name="blossoms" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".wrapped-cover-initial")).toHaveTextContent("B");
  });

  it("falls back to the tile when the picture fails to load", () => {
    const { container } = render(<Cover src="https://img/broken.jpg" name="Oasis" />);
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".wrapped-cover-initial")).toHaveTextContent("O");
  });

  it("copes with an empty name", () => {
    const { container } = render(<Cover src={null} name="" />);
    expect(container.querySelector(".wrapped-cover-initial")).toHaveTextContent("?");
  });
});
