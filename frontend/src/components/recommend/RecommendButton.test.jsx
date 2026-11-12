import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import RecommendButton from "./RecommendButton";

afterEach(() => cleanup());

describe("RecommendButton", () => {
  const item = {
    itemType: "track",
    title: "Glasgow",
    artist: "The Snuts",
  };

  it("renders with accessible button label and opens modal on click", () => {
    render(<RecommendButton token="token" item={item} />);

    const btn = screen.getByRole("button", { name: /Recommend Glasgow to a friend/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);

    // Modal dialog title should now be in document
    expect(screen.getByText(/Recommend to a Friend/i)).toBeInTheDocument();
  });

  it("renders with grid overlay style when inGrid is true", () => {
    const { container } = render(<RecommendButton token="token" item={item} inGrid />);
    const btn = container.querySelector(".recommend-btn-grid");
    expect(btn).toBeInTheDocument();
  });
});
