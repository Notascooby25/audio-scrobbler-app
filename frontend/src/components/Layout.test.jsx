import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Layout from "./Layout";

vi.mock("./HeaderNav", () => ({ default: () => <nav>nav</nav> }));
vi.mock("./Footer", () => ({ default: () => <footer>footer</footer> }));
vi.mock("../skins/Slot", () => ({ default: ({ fallback }) => fallback }));
vi.mock("./UpdateBanner", () => ({ default: () => <div role="status">banner</div> }));

afterEach(() => cleanup());

describe("Layout", () => {
  it("renders the update banner above the navigation", () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    const banner = screen.getByRole("status");
    const nav = screen.getByRole("navigation");
    expect(banner.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
