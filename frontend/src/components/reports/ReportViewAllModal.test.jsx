import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReportViewAllModal from "./ReportViewAllModal";

describe("ReportViewAllModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    render(<ReportViewAllModal isOpen={false} title="Albums" items={["A"]} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the title and every item, even for a very long list", () => {
    const items = Array.from({ length: 700 }, (_, index) => `Artist ${index + 1} – Album`);
    render(<ReportViewAllModal isOpen title="Rough Trade" items={items} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Rough Trade" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(700);
    expect(screen.getByText("Artist 1 – Album")).toBeInTheDocument();
    expect(screen.getByText("Artist 700 – Album")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<ReportViewAllModal isOpen title="Albums" items={["A"]} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the close button", () => {
    const onClose = vi.fn();
    render(<ReportViewAllModal isOpen title="Albums" items={["A"]} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the backdrop is clicked but not when the dialog is clicked", () => {
    const onClose = vi.fn();
    render(<ReportViewAllModal isOpen title="Albums" items={["A"]} onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("report-viewall-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus into the dialog and gives it back to the opener when it closes", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open list
          </button>
          <ReportViewAllModal
            isOpen={open}
            title="Albums"
            items={["A", "B"]}
            onClose={() => setOpen(false)}
          />
        </>
      );
    }
    render(<Harness />);

    const opener = screen.getByRole("button", { name: "Open list" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab inside the dialog and lets the list be scrolled from the keyboard", () => {
    render(<ReportViewAllModal isOpen title="Albums" items={["A", "B"]} onClose={vi.fn()} />);

    const list = screen.getByRole("list", { name: "Albums" });
    const close = screen.getByRole("button", { name: "Close dialog" });
    expect(list).toHaveAttribute("tabindex", "0");

    list.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(list).toHaveFocus();
  });

  it("stops listening for Escape once closed", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ReportViewAllModal isOpen title="Albums" items={["A"]} onClose={onClose} />
    );
    rerender(<ReportViewAllModal isOpen={false} title="Albums" items={["A"]} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
