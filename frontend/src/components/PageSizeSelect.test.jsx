import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PageSizeSelect from "./PageSizeSelect";

describe("PageSizeSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all 6 pagination options and handles selection", () => {
    const handleChange = vi.fn();
    render(<PageSizeSelect value={50} onChange={handleChange} />);

    const expectedOptions = [5, 10, 20, 50, 100, 250];

    expectedOptions.forEach((size) => {
      expect(screen.getByRole("tab", { name: String(size) })).toBeInTheDocument();
    });

    const activeTab = screen.getByRole("tab", { name: "50" });
    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(activeTab).toHaveClass("active");

    fireEvent.click(screen.getByRole("tab", { name: "20" }));
    expect(handleChange).toHaveBeenCalledWith(20);
  });
});
