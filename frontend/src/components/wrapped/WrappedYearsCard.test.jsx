import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WrappedYearsCard from "./WrappedYearsCard";

vi.mock("../../api/wrapped", () => ({ fetchWrapped: vi.fn() }));

import { fetchWrapped } from "../../api/wrapped";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderCard() {
  render(
    <MemoryRouter>
      <WrappedYearsCard token="tok" />
    </MemoryRouter>
  );
}

describe("WrappedYearsCard", () => {
  it("lists newest year first with a Play story link", async () => {
    fetchWrapped.mockResolvedValue({
      years: [
        { year: 2026, status: "ready", top_artist: "Artist A" },
        { year: 2025, status: "ready", is_sample: true },
      ],
    });
    renderCard();
    const headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["2026 Wrapped", "2025 Wrapped"]);
    expect(screen.getAllByRole("link", { name: "Play story" })[0]).toHaveAttribute(
      "href",
      "/wrapped/2026"
    );
    expect(screen.getByText(/only you can see this/i)).toBeInTheDocument();
  });

  it("shows the unlock date on a locked card, with no link", async () => {
    fetchWrapped.mockResolvedValue({
      years: [{ year: 2026, status: "locked", unlocks_at: "2026-12-31T18:00:00" }],
    });
    renderCard();
    expect(await screen.findByText(/Unlocks 31 December 2026 at 18:00/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says it is being made once the unlock time has passed", async () => {
    fetchWrapped.mockResolvedValue({
      years: [{ year: 2020, status: "locked", unlocks_at: "2020-12-31T18:00:00" }],
    });
    renderCard();
    expect(await screen.findByText(/being made now/i)).toBeInTheDocument();
    expect(screen.queryByText(/Unlocks/)).not.toBeInTheDocument();
  });

  it("explains the empty tab when there are no years", async () => {
    fetchWrapped.mockResolvedValue({ years: [] });
    renderCard();
    await waitFor(() => expect(fetchWrapped).toHaveBeenCalled());
    expect(screen.getByText(/first year in review arrives on 31 December/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("shows the same calm message when the request fails", async () => {
    fetchWrapped.mockRejectedValue(new Error("down"));
    renderCard();
    await waitFor(() => expect(fetchWrapped).toHaveBeenCalled());
    expect(screen.getByText(/first year in review arrives on 31 December/i)).toBeInTheDocument();
  });
});
