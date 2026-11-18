import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import InfoHint from "./InfoHint";
import { REPORT_HINTS } from "../reportHints";

describe("InfoHint", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing for an unknown hintId", () => {
    const { container } = render(<InfoHint hintId="does.not.exist" label="Nothing" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts closed with an accessible name", () => {
    render(<InfoHint hintId="ratios.explorer" label="Explorer vs. Repeater" />);
    const button = screen.getByRole("button", { name: "About Explorer vs. Repeater", exact: true });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("opens on click and shows the hint text", () => {
    render(<InfoHint hintId="ratios.explorer" label="Explorer vs. Repeater" />);
    const button = screen.getByRole("button", { name: "About Explorer vs. Repeater", exact: true });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toHaveTextContent(REPORT_HINTS["ratios.explorer"]);
  });

  it("closes on a second click", () => {
    render(<InfoHint hintId="ratios.explorer" label="Explorer vs. Repeater" />);
    const button = screen.getByRole("button", { name: "About Explorer vs. Repeater", exact: true });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the button", () => {
    render(<InfoHint hintId="ratios.explorer" label="Explorer vs. Repeater" />);
    const button = screen.getByRole("button", { name: "About Explorer vs. Repeater", exact: true });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <InfoHint hintId="ratios.explorer" label="Explorer vs. Repeater" />
        <p>elsewhere</p>
      </div>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "About Explorer vs. Repeater", exact: true })
    );
    fireEvent.pointerDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("opening a second hint closes the first", () => {
    render(
      <div>
        <InfoHint hintId="ratios.explorer" label="Explorer vs. Repeater" />
        <InfoHint hintId="ratios.singles" label="Singles vs. Albums" />
      </div>
    );
    const first = screen.getByRole("button", { name: "About Explorer vs. Repeater", exact: true });
    const second = screen.getByRole("button", { name: "About Singles vs. Albums", exact: true });
    fireEvent.click(first);
    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("note")).toHaveLength(1);
  });

  it("does not toggle a parent <details> when clicked", () => {
    const { container } = render(
      <details>
        <summary>
          Title
          <InfoHint hintId="ratios.explorer" label="Explorer vs. Repeater" />
        </summary>
        body
      </details>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "About Explorer vs. Repeater", exact: true })
    );
    expect(container.querySelector("details").open).toBe(false);
  });
});
