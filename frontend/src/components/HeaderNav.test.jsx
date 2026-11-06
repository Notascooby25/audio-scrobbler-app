import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HeaderNav from "./HeaderNav";

vi.mock("../api", () => ({
  fetchUnreadNotificationCount: vi.fn().mockResolvedValue({ count: 3 }),
}));

describe("HeaderNav", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders links to all primary sections and right-grouped outline icon actions", () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>
    );

    ["Play", "Library", "Reports", "Gigs", "Connect"].forEach((label) => {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    });

    const accountBtn = screen.getByRole("button", { name: "Account menu" });
    const connectLink = screen.getByRole("link", { name: "Connect" });
    expect(accountBtn.querySelector("svg")).not.toBeNull();
    expect(connectLink.querySelector("svg")).not.toBeNull();
    expect(accountBtn).toHaveClass("nav-icon-link");
    expect(connectLink).toHaveClass("nav-icon-link");

    const toggle = screen.getByRole("button", { name: "Toggle navigation menu" });
    const iconsGroup = screen.getByRole("group", { name: "Account and connections" });
    expect(toggle.parentElement).toBe(screen.getByLabelText("Primary navigation"));
    expect(iconsGroup.contains(toggle)).toBe(false);
  });

  it("opens and closes the account dropdown menu with Profile, Friends, Settings, and Connect", () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>
    );

    const accountBtn = screen.getByRole("button", { name: "Account menu" });
    expect(screen.queryByRole("menu", { name: "Account menu" })).not.toBeInTheDocument();

    fireEvent.click(accountBtn);
    expect(screen.getByRole("menu", { name: "Account menu" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Friends" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Connect" })).toBeInTheDocument();

    // Close on Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "Account menu" })).not.toBeInTheDocument();
  });

  it("shows Sign out in the account menu when authenticated and clears session on click", () => {
    localStorage.setItem(
      "audio-scrobbler-session",
      JSON.stringify({ userId: 1, accessToken: "token-123" })
    );

    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>
    );

    const accountBtn = screen.getByRole("button", { name: "Account menu" });
    fireEvent.click(accountBtn);

    const signoutBtn = screen.getByRole("menuitem", { name: "Sign out" });
    expect(signoutBtn).toBeInTheDocument();

    fireEvent.click(signoutBtn);
    expect(localStorage.getItem("audio-scrobbler-session")).toBeNull();
    expect(screen.queryByRole("menu", { name: "Account menu" })).not.toBeInTheDocument();
  });

  it("closes the account dropdown menu when clicking outside", () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>
    );

    const accountBtn = screen.getByRole("button", { name: "Account menu" });
    fireEvent.click(accountBtn);
    expect(screen.getByRole("menu", { name: "Account menu" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu", { name: "Account menu" })).not.toBeInTheDocument();
  });

  it("marks the active page link based on the current route", () => {
    render(
      <MemoryRouter initialEntries={["/library"]}>
        <HeaderNav />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Library" })).toHaveClass("nav-link-active");
    expect(screen.getByRole("link", { name: "Play" })).not.toHaveClass("nav-link-active");
  });

  it("marks Gigs active when viewing a gig setlist page", () => {
    render(
      <MemoryRouter initialEntries={["/gigs/42"]}>
        <HeaderNav />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Gigs" })).toHaveClass("nav-link-active");
  });

  it("toggles the mobile navigation menu open and closed", () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>
    );
    const toggle = screen.getByRole("button", { name: "Toggle navigation menu" });
    const nav = screen.getByLabelText("Primary navigation");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toHaveClass("topbar-nav-open");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(nav).toHaveClass("topbar-nav-open");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toHaveClass("topbar-nav-open");
  });

  it("closes the mobile menu after selecting a link", () => {
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>
    );
    const toggle = screen.getByRole("button", { name: "Toggle navigation menu" });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("link", { name: "Reports" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("renders an accessible SVG outline notification bell and badge without emoji when authenticated", async () => {
    localStorage.setItem(
      "audio-scrobbler-session",
      JSON.stringify({ userId: 1, accessToken: "demo-token" })
    );
    render(
      <MemoryRouter>
        <HeaderNav />
      </MemoryRouter>
    );

    await waitFor(() => {
      const bellLinks = screen.getAllByRole("link", { name: /unread notification/i });
      expect(bellLinks.length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("🔔")).not.toBeInTheDocument();
    const badgeElements = screen.getAllByText("3");
    expect(badgeElements.length).toBeGreaterThan(0);
  });
});
