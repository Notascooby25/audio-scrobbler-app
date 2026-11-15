import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import OfflineBanner from "./OfflineBanner";

afterEach(() => {
  cleanup();
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
});
