import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import fs from "fs";
import path from "path";
import { getSkin, getAvailableSkins, DEFAULT_SKIN_ID } from "./index";
import { REQUIRED_TOKENS } from "./tokens.contract";
import Slot from "./Slot";
import { SkinProvider } from "./useSkin";

afterEach(() => cleanup());

describe("Skins Registry & Token Contract", () => {
  it("registers Classic and Sleeve as live, and Timeline as hidden", () => {
    expect(DEFAULT_SKIN_ID).toBe("classic");
    const classic = getSkin("classic");
    expect(classic).toBeDefined();
    expect(classic.status).toBe("live");
    expect(classic.supportsThemes).toBe(true);

    const sleeve = getSkin("sleeve");
    expect(sleeve).toBeDefined();
    expect(sleeve.status).toBe("live");
    expect(sleeve.supportsThemes).toBe(false);

    const timeline = getSkin("timeline");
    expect(timeline).toBeDefined();
    expect(timeline.status).toBe("hidden");
    expect(timeline.supportsThemes).toBe(true);
  });

  it("filters skins by status appropriately", () => {
    const liveSkins = getAvailableSkins();
    expect(liveSkins.map((s) => s.id)).toEqual(["classic", "sleeve"]);

    const allSkins = getAvailableSkins({ includeHidden: true });
    expect(allSkins.map((s) => s.id)).toEqual(["classic", "sleeve", "timeline"]);
  });

  it("ensures Classic defines every token in the Token Contract across styles.css", () => {
    const stylesPath = path.resolve(__dirname, "../styles.css");
    const stylesContent = fs.readFileSync(stylesPath, "utf-8");

    for (const token of REQUIRED_TOKENS) {
      expect(stylesContent).toContain(`${token}:`);
    }
  });

  it("enforces flat-by-default rules (zero gradients, zero box-shadows) across skin CSS files", () => {
    const skinDirs = ["sleeve", "timeline"];
    for (const dir of skinDirs) {
      const cssPath = path.resolve(__dirname, dir, `${dir}.css`);
      if (fs.existsSync(cssPath)) {
        const content = fs.readFileSync(cssPath, "utf-8");
        expect(content).not.toMatch(/linear-gradient/i);
        expect(content).not.toMatch(/radial-gradient/i);
        expect(content).not.toMatch(/conic-gradient/i);
        const nonFocusStyles = content.replace(/:focus[^{]*\{[^}]*\}/g, "");
        const boxShadowMatches = nonFocusStyles.match(/box-shadow\s*:\s*([^;]+);/g) || [];
        for (const declaration of boxShadowMatches) {
          expect(declaration).toMatch(/box-shadow\s*:\s*(none)\s*;/);
        }
      }
    }
  });

  it("enforces selector scoping under [data-skin='<id>'] for all skin stylesheets", () => {
    const skinDirs = ["sleeve", "timeline"];
    for (const id of skinDirs) {
      const cssPath = path.resolve(__dirname, id, `${id}.css`);
      if (fs.existsSync(cssPath)) {
        const content = fs.readFileSync(cssPath, "utf-8");
        // Strip comments and unwrap @media queries to test inner selector scoping
        const stripped = content
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/@media[^{]*\{/g, "")
          .trim();
        if (stripped.length > 0) {
          // Extract selectors (text before opening brace {)
          const blocks = stripped.split("}");
          for (const block of blocks) {
            const trimmed = block.trim();
            if (!trimmed) continue;
            const selectorPart = trimmed.split("{")[0].trim();
            const selectors = selectorPart.split(",").map((s) => s.trim());
            for (const selector of selectors) {
              expect(selector.startsWith(`[data-skin="${id}"]`)).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("Slot Pattern Component", () => {
  it("renders fallback markup when no slot component is defined for the active skin", () => {
    render(
      <SkinProvider initialSkin="classic">
        <Slot name="testSlot" fallback={<div data-testid="fallback">Classic Fallback</div>} />
      </SkinProvider>
    );

    expect(screen.getByTestId("fallback")).toHaveTextContent("Classic Fallback");
  });

  it("renders children when no fallback and no slot is registered", () => {
    render(
      <SkinProvider initialSkin="classic">
        <Slot name="unregisteredSlot">
          <span data-testid="child-content">Default Child</span>
        </Slot>
      </SkinProvider>
    );

    expect(screen.getByTestId("child-content")).toHaveTextContent("Default Child");
  });

  it("renders SleeveNav when active skin is sleeve and slot is appNav", () => {
    render(
      <MemoryRouter
        initialEntries={["/library"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SkinProvider initialSkin="sleeve">
          <Slot name="appNav" fallback={<div data-testid="classic-nav">Classic</div>} />
        </SkinProvider>
      </MemoryRouter>
    );

    expect(screen.queryByTestId("classic-nav")).not.toBeInTheDocument();
    expect(screen.getByText("Scrobbler")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sleeve navigation" })).toBeInTheDocument();

    const libraryTab = screen.getByRole("link", { name: /Library/i });
    expect(libraryTab).toHaveAttribute("aria-current", "page");

    const todayTab = screen.getByRole("link", { name: /Today/i });
    expect(todayTab).not.toHaveAttribute("aria-current");
  });

  it("renders subpage header with Back button when on subpage route under sleeve skin", () => {
    render(
      <MemoryRouter
        initialEntries={["/settings"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SkinProvider initialSkin="sleeve">
          <Slot name="appNav" fallback={<div data-testid="classic-nav">Classic</div>} />
        </SkinProvider>
      </MemoryRouter>
    );

    expect(screen.queryByText("Scrobbler")).not.toBeInTheDocument();
    expect(screen.getByText("Back to Profile")).toBeInTheDocument();

    // In a subpage, no tab has aria-current="page"
    const tabs = screen.getAllByRole("link");
    const activeTabs = tabs.filter((t) => t.getAttribute("aria-current") === "page");
    expect(activeTabs).toHaveLength(0);
  });

  it("resolves todayPage and playPage slots for Sleeve and Timeline, and falls back for Classic", () => {
    const classic = getSkin("classic");
    expect(classic.slots.todayPage).toBeUndefined();
    expect(classic.slots.playPage).toBeUndefined();

    const sleeve = getSkin("sleeve");
    expect(sleeve.slots.todayPage).toBeDefined();
    expect(sleeve.slots.playPage).toBeDefined();

    const timeline = getSkin("timeline");
    expect(timeline.slots.todayPage).toBeDefined();
    expect(timeline.slots.playPage).toBeDefined();
  });
});
