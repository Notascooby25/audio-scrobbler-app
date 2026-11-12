import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UpdateBanner from "./UpdateBanner";
import { clearAppCaches, fetchLatestBuildId } from "../updateCheck";

vi.mock("../updateCheck", () => ({
  fetchLatestBuildId: vi.fn(),
  clearAppCaches: vi.fn(),
}));

const INTERVAL = 1000;

async function renderBanner(props = {}) {
  render(<UpdateBanner currentBuildId="100" intervalMs={INTERVAL} {...props} />);
  await act(async () => {});
}

async function tick(ms = INTERVAL) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchLatestBuildId.mockReset();
  clearAppCaches.mockReset();
  clearAppCaches.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("UpdateBanner", () => {
  it("renders nothing and never checks when there is no current build id", async () => {
    await renderBanner({ currentBuildId: undefined });
    expect(screen.queryByRole("status")).toBeNull();
    expect(fetchLatestBuildId).not.toHaveBeenCalled();
  });

  it("renders nothing when the latest id matches", async () => {
    fetchLatestBuildId.mockResolvedValue("100");
    await renderBanner();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders nothing when the check fails", async () => {
    fetchLatestBuildId.mockResolvedValue(null);
    await renderBanner();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the banner when the latest id differs", async () => {
    fetchLatestBuildId.mockResolvedValue("200");
    await renderBanner();
    expect(screen.getByRole("status")).toHaveTextContent("A new version is available.");
    expect(screen.getByRole("button", { name: "Update now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Later" })).toBeInTheDocument();
  });

  it("Later hides it, and a later check that still differs shows it again", async () => {
    fetchLatestBuildId.mockResolvedValue("200");
    await renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("status")).toBeNull();
    await tick();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("a later check that matches hides it", async () => {
    fetchLatestBuildId.mockResolvedValueOnce("200").mockResolvedValue("100");
    await renderBanner();
    expect(screen.getByRole("status")).toBeInTheDocument();
    await tick();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("checks again when the tab becomes visible", async () => {
    fetchLatestBuildId.mockResolvedValue("100");
    await renderBanner();
    expect(fetchLatestBuildId).toHaveBeenCalledTimes(1);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchLatestBuildId).toHaveBeenCalledTimes(2);
  });

  it("Update now clears caches then reloads", async () => {
    const order = [];
    clearAppCaches.mockImplementation(async () => {
      order.push("clear");
    });
    const reload = vi.fn(() => order.push("reload"));
    vi.stubGlobal("location", { ...window.location, reload });
    fetchLatestBuildId.mockResolvedValue("200");
    await renderBanner();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update now" }));
    });
    expect(order).toEqual(["clear", "reload"]);
  });

  it("Update now still reloads when clearing caches rejects", async () => {
    clearAppCaches.mockRejectedValue(new Error("denied"));
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    fetchLatestBuildId.mockResolvedValue("200");
    await renderBanner();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update now" }));
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
