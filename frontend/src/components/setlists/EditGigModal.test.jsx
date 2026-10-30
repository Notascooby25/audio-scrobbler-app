import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditGigModal from "./EditGigModal";
import * as setlistsApi from "../../api/setlists";

vi.mock("../../api/setlists", () => ({
  updateConcert: vi.fn(),
  alreadyLoggedInfo: vi.fn(() => null),
}));

const gig = {
  id: 5,
  artist_name: "Doves",
  venue_name: "Castle Stage",
  city: "Portsmouth",
  country: "United Kingdom",
  event_date: "2026-08-29T00:00:00",
  is_festival: false,
  festival_name: null,
};

describe("EditGigModal festival name", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks for the festival name once the gig is ticked as a festival", async () => {
    setlistsApi.updateConcert.mockResolvedValue({
      ...gig,
      is_festival: true,
      festival_name: "Victorious Festival 2026",
    });
    render(<EditGigModal gig={gig} token="test-token" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.queryByLabelText(/Festival name/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "This was a festival" }));
    fireEvent.change(screen.getByLabelText(/Festival name/), {
      target: { value: "  Victorious Festival 2026 " },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save changes" })
    );

    await waitFor(() =>
      expect(setlistsApi.updateConcert).toHaveBeenCalledWith(
        expect.objectContaining({ isFestival: true, festivalName: "Victorious Festival 2026" })
      )
    );
  });

  it("sends no festival name for a gig that isn't a festival", async () => {
    setlistsApi.updateConcert.mockResolvedValue(gig);
    render(<EditGigModal gig={gig} token="test-token" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save changes" })
    );

    await waitFor(() =>
      expect(setlistsApi.updateConcert).toHaveBeenCalledWith(
        expect.objectContaining({ isFestival: false, festivalName: null })
      )
    );
  });
});
