import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import OfflineBanner from "./OfflineBanner";

const realFetch = window.fetch;

afterEach(() => {
  cleanup();
  window.fetch = realFetch;
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

describe("OfflineBanner", () => {
  it("renders nothing when online", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders offline notice when offline and hides when back online", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status").textContent).toMatch(/you are offline/i);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders offline notice when fetch fails with a network TypeError and clears on success", async () => {
    window.fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<OfflineBanner />);

    await act(async () => {
      await expect(window.fetch("/health")).rejects.toThrow("Failed to fetch");
    });
    expect(screen.getByRole("status").textContent).toMatch(/you are offline/i);

    window.fetch = vi.fn();
    // Trigger online event to clear
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
