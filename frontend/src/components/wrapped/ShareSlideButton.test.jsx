import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));

import { toBlob } from "html-to-image";
import ShareSlideButton from "./ShareSlideButton";

const blob = new Blob(["x"], { type: "image/png" });

function renderButton() {
  render(<ShareSlideButton slide={<p>Slide text</p>} tone="dark" filename="wrapped.png" />);
}

beforeEach(() => {
  toBlob.mockReset();
  toBlob.mockResolvedValue(blob);
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  delete navigator.canShare;
  delete navigator.share;
});

describe("ShareSlideButton", () => {
  it("shares a file when the phone can share files", async () => {
    navigator.canShare = vi.fn(() => true);
    navigator.share = vi.fn().mockResolvedValue();
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    const options = toBlob.mock.calls[0][1];
    expect(options.width).toBe(1080);
    expect(options.height).toBe(1920);
    expect(navigator.share.mock.calls[0][0].files[0].name).toBe("wrapped.png");
  });

  it("downloads the picture when sharing files isn't available", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });

  it("shows a message and stays usable when the picture can't be made", async () => {
    toBlob.mockRejectedValue(new Error("boom"));
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't make the picture/i);
    expect(screen.getByRole("button", { name: "Share" })).toBeEnabled();
  });

  it("downloads instead when the phone refuses the share because the tap was too long ago", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    navigator.canShare = vi.fn(() => true);
    const refused = Object.assign(new Error("needs a fresh tap"), { name: "NotAllowedError" });
    navigator.share = vi.fn().mockRejectedValue(refused);
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    click.mockRestore();
  });

  it("stays quiet when the person closes the share sheet", async () => {
    navigator.canShare = vi.fn(() => true);
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    navigator.share = vi.fn().mockRejectedValue(abort);
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Share" })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("waits for fonts before drawing", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let release;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: new Promise((resolve) => (release = resolve)) },
    });
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(toBlob).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(toBlob).toHaveBeenCalled());
    delete document.fonts;
  });
});
