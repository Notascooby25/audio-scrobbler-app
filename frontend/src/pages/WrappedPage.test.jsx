import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WrappedPage from "./WrappedPage";
import { sampleSnapshot } from "../components/wrapped/sampleSnapshot";

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));
vi.mock("../api/wrapped", () => ({
  fetchWrappedYear: vi.fn(),
  markWrappedSeen: vi.fn(),
}));
vi.mock("../session", () => ({ readSession: vi.fn() }));

import { fetchWrappedYear, markWrappedSeen } from "../api/wrapped";
import { readSession } from "../session";

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/wrapped/2026"]}>
      <Routes>
        <Route path="/wrapped/:year" element={<WrappedPage />} />
        <Route path="/reports" element={<p>Reports page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  readSession.mockReturnValue({ accessToken: "tok" });
  markWrappedSeen.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WrappedPage", () => {
  it("opens the story and marks it as seen once", async () => {
    fetchWrappedYear.mockResolvedValue({ data: sampleSnapshot() });
    renderPage();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(markWrappedSeen).toHaveBeenCalledTimes(1));
    expect(markWrappedSeen).toHaveBeenCalledWith({ token: "tok", year: "2026" });
  });

  it("says so when there is no review for the year", async () => {
    fetchWrappedYear.mockRejectedValue(Object.assign(new Error("nope"), { status: 404 }));
    renderPage();
    expect(await screen.findByText(/no review for 2026 yet/i)).toBeInTheDocument();
    expect(markWrappedSeen).not.toHaveBeenCalled();
  });

  it("shows a calm message when loading fails", async () => {
    fetchWrappedYear.mockRejectedValue(new Error("down"));
    renderPage();
    expect(await screen.findByText(/couldn't load it just now/i)).toBeInTheDocument();
  });

  it("asks signed-out people to sign in without calling the server", () => {
    readSession.mockReturnValue(null);
    renderPage();
    expect(screen.getByText(/sign in to see it/i)).toBeInTheDocument();
    expect(fetchWrappedYear).not.toHaveBeenCalled();
  });
});
