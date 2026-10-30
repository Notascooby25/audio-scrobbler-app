import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeCitySection from "./HomeCitySection";
import * as api from "../../api";

vi.mock("../../api", () => ({
  setHomeCity: vi.fn(),
  clearHomeCity: vi.fn(),
}));

describe("HomeCitySection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("says when no home city is set", () => {
    render(<HomeCitySection token="test-token" savedCity={null} />);

    expect(screen.getByText("Not set yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save home city" })).toBeDisabled();
  });

  it("saves a home city and reports the stored name", async () => {
    api.setHomeCity.mockResolvedValue({ home_city: "Leeds, United Kingdom" });
    const onChanged = vi.fn();
    render(<HomeCitySection token="test-token" savedCity={null} onChanged={onChanged} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " Leeds, United Kingdom " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save home city" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("Leeds, United Kingdom"));
    expect(api.setHomeCity).toHaveBeenCalledWith({
      token: "test-token",
      city: "Leeds, United Kingdom",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("shows the server's message when the place is not found", async () => {
    api.setHomeCity.mockRejectedValue(new Error("Couldn't find that place."));
    render(<HomeCitySection token="test-token" savedCity={null} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nowhereville" } });
    fireEvent.click(screen.getByRole("button", { name: "Save home city" }));

    expect(await screen.findByText("Couldn't find that place.")).toBeInTheDocument();
  });

  it("clears a saved home city", async () => {
    api.clearHomeCity.mockResolvedValue({ home_city: null });
    const onChanged = vi.fn();
    render(
      <HomeCitySection token="test-token" savedCity="Leeds, United Kingdom" onChanged={onChanged} />
    );

    expect(screen.getByText("Leeds, United Kingdom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(null));
  });
});
