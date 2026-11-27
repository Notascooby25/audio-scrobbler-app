import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ShareScrobblesModal from "./ShareScrobblesModal";
import * as api from "../../api";

vi.mock("../../api");
vi.mock("../../session", () => ({
  readSession: () => ({ accessToken: "test-token" }),
}));

describe("ShareScrobblesModal", () => {
  const renderModal = (props = {}) =>
    render(<ShareScrobblesModal userId={123} username="testuser" onClose={vi.fn()} {...props} />);

  const fillRange = (start = "2026-01-01T12:00", end = "2026-01-01T14:00") => {
    fireEvent.change(screen.getByLabelText("Start Time"), { target: { value: start } });
    fireEvent.change(screen.getByLabelText("End Time"), { target: { value: end } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders correctly", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Share Scrobbles" })).toBeInTheDocument();
    expect(screen.getByText(/added to @testuser/)).toBeInTheDocument();
  });

  it("keeps the share button disabled until both times are filled in", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Share Scrobbles" })).toBeDisabled();
    fillRange();
    expect(screen.getByRole("button", { name: "Share Scrobbles" })).toBeEnabled();
  });

  it("calls the api with the chosen range and shows how many were added", async () => {
    api.shareScrobbles.mockResolvedValue({ shared_count: 5 });
    renderModal();
    fillRange();
    fireEvent.click(screen.getByRole("button", { name: "Share Scrobbles" }));

    await waitFor(() => {
      expect(api.shareScrobbles).toHaveBeenCalledWith({
        token: "test-token",
        userId: 123,
        startDate: new Date("2026-01-01T12:00").toISOString(),
        endDate: new Date("2026-01-01T14:00").toISOString(),
      });
    });
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getByText(/to @testuser's history/)).toBeInTheDocument();
  });

  it("says so when there was nothing new to add", async () => {
    api.shareScrobbles.mockResolvedValue({ shared_count: 0 });
    renderModal();
    fillRange();
    fireEvent.click(screen.getByRole("button", { name: "Share Scrobbles" }));
    expect(await screen.findByText(/Nothing new to add/)).toBeInTheDocument();
  });

  it("does not call the api when the end is before the start", () => {
    renderModal();
    fillRange("2026-01-01T14:00", "2026-01-01T12:00");
    fireEvent.click(screen.getByRole("button", { name: "Share Scrobbles" }));
    expect(api.shareScrobbles).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The end time must be after the start time."
    );
  });

  it("shows the error when the server refuses", async () => {
    api.shareScrobbles.mockRejectedValue(
      new Error("Must follow user to share scrobbles with them")
    );
    renderModal();
    fillRange();
    fireEvent.click(screen.getByRole("button", { name: "Share Scrobbles" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Must follow user");
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape while sharing", () => {
    let resolvePromise;
    api.shareScrobbles.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    const onClose = vi.fn();
    renderModal({ onClose });
    fillRange();
    fireEvent.click(screen.getByRole("button", { name: "Share Scrobbles" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    resolvePromise({ shared_count: 0 });
  });
});
