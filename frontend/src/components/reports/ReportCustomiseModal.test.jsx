import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ReportCustomiseModal, { DEFAULT_WIDGET_PREFERENCES } from "./ReportCustomiseModal";

describe("ReportCustomiseModal component", () => {
  afterEach(() => cleanup());

  it("renders modal with widget options and leaderboard limit", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <ReportCustomiseModal
        isOpen={true}
        preferences={DEFAULT_WIDGET_PREFERENCES}
        onSave={onSave}
        onClose={onClose}
      />
    );

    expect(screen.getByRole("dialog", { name: /Customise Report Widgets/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Streaks & Milestones/i)).toBeChecked();
    expect(screen.getByLabelText(/1001 Albums Challenge/i)).toBeChecked();
    expect(screen.getByLabelText(/Rough Trade Top 100/i)).toBeChecked();
    expect(screen.getByLabelText(/Live Artist Connection/i)).toBeChecked();
    expect(screen.getByLabelText(/Leaderboard display count/i)).toHaveValue("5");
  });

  it("can switch the Rough Trade card off and saves that choice", () => {
    const onSave = vi.fn();
    render(
      <ReportCustomiseModal
        isOpen={true}
        preferences={DEFAULT_WIDGET_PREFERENCES}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText(/Rough Trade Top 100/i));
    fireEvent.click(screen.getByRole("button", { name: /Save Preferences/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ showRoughTrade: false }));
  });

  it("toggles widget checkbox and calls onSave", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <ReportCustomiseModal
        isOpen={true}
        preferences={DEFAULT_WIDGET_PREFERENCES}
        onSave={onSave}
        onClose={onClose}
      />
    );

    const streaksCheckbox = screen.getByLabelText(/Streaks & Milestones/i);
    fireEvent.click(streaksCheckbox);
    expect(streaksCheckbox).not.toBeChecked();

    const select = screen.getByLabelText(/Leaderboard display count/i);
    fireEvent.change(select, { target: { value: "10" } });

    const saveButton = screen.getByRole("button", { name: /Save Preferences/i });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        showMilestones: false,
        leaderboardLimit: 10,
      })
    );
  });
});
