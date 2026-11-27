import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WrappedBanner from "./WrappedBanner";

vi.mock("../../api/wrapped", () => ({
  fetchWrapped: vi.fn(),
  dismissWrapped: vi.fn(),
}));
vi.mock("../../session", () => ({ readSession: vi.fn() }));

import { dismissWrapped, fetchWrapped } from "../../api/wrapped";
import { readSession } from "../../session";

function renderBanner(path = "/reports") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <WrappedBanner />
    </MemoryRouter>
  );
}

beforeEach(() => {
  readSession.mockReturnValue({ accessToken: "tok" });
  dismissWrapped.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WrappedBanner", () => {
  it("shows only when the server gives a banner year", async () => {
    fetchWrapped.mockResolvedValue({ years: [], banner: { year: 2026 } });
    renderBanner();
    expect(await screen.findByText("Your 2026 Wrapped is ready")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play my year" })).toHaveAttribute(
      "href",
      "/wrapped/2026"
    );
  });

  it("shows nothing when there is no banner", async () => {
    fetchWrapped.mockResolvedValue({ years: [], banner: null });
    renderBanner();
    await waitFor(() => expect(fetchWrapped).toHaveBeenCalled());
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("does not ask the server when signed out", () => {
    readSession.mockReturnValue(null);
    renderBanner();
    expect(fetchWrapped).not.toHaveBeenCalled();
  });

  it("hides and tells the server when dismissed", async () => {
    fetchWrapped.mockResolvedValue({ years: [], banner: { year: 2026 } });
    renderBanner();
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Your 2026 Wrapped is ready")).not.toBeInTheDocument();
    expect(dismissWrapped).toHaveBeenCalledWith({ token: "tok", year: 2026 });
  });

  it("hides once the story has been opened", async () => {
    fetchWrapped.mockResolvedValue({ years: [], banner: { year: 2026 } });
    renderBanner();
    await screen.findByText("Your 2026 Wrapped is ready");
    act(() => {
      window.dispatchEvent(new Event("wrapped_seen"));
    });
    expect(screen.queryByText("Your 2026 Wrapped is ready")).not.toBeInTheDocument();
  });

  it("shows up without a reload when the app is brought back to the front", async () => {
    fetchWrapped.mockResolvedValueOnce({ years: [], banner: null });
    renderBanner();
    await waitFor(() => expect(fetchWrapped).toHaveBeenCalledTimes(1));
    fetchWrapped.mockResolvedValueOnce({ years: [], banner: { year: 2026 } });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(await screen.findByText("Your 2026 Wrapped is ready")).toBeInTheDocument();
  });

  it("stays out of the way on the story page", async () => {
    fetchWrapped.mockResolvedValue({ years: [], banner: { year: 2026 } });
    renderBanner("/wrapped/2026");
    await waitFor(() => expect(fetchWrapped).toHaveBeenCalled());
    expect(screen.queryByText("Your 2026 Wrapped is ready")).not.toBeInTheDocument();
  });
});
