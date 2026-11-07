import { afterEach, describe, expect, it } from "vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(() => cleanup());
import fs from "fs";
import path from "path";
import { getSkin, getAvailableSkins, DEFAULT_SKIN_ID } from "./index";
import { REQUIRED_TOKENS } from "./tokens.contract";
import Slot from "./Slot";
import { SkinProvider } from "./useSkin";

describe("Skins Registry & Token Contract", () => {
  it("registers Classic as live and Sleeve/Timeline as hidden initially", () => {
    expect(DEFAULT_SKIN_ID).toBe("classic");
    const classic = getSkin("classic");
    expect(classic).toBeDefined();
    expect(classic.status).toBe("live");
    expect(classic.supportsThemes).toBe(true);

    const sleeve = getSkin("sleeve");
    expect(sleeve).toBeDefined();
    expect(sleeve.status).toBe("hidden");
    expect(sleeve.supportsThemes).toBe(false);

    const timeline = getSkin("timeline");
    expect(timeline).toBeDefined();
    expect(timeline.status).toBe("hidden");
    expect(timeline.supportsThemes).toBe(true);
  });

  it("filters skins by status appropriately", () => {
    const liveSkins = getAvailableSkins();
    expect(liveSkins.map((s) => s.id)).toEqual(["classic"]);

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
        // Strip comments
        const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "").trim();
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
});
