import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const stylesContent = fs.readFileSync(path.resolve(__dirname, "../../styles.css"), "utf-8");

const START = "/* Friend recommendations */";
const END = "/* End friend recommendations */";

function section() {
  const start = stylesContent.indexOf(START);
  const end = stylesContent.indexOf(END);
  if (start === -1 || end === -1 || end < start) return "";
  return stylesContent.slice(start, end);
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Joined declarations of every rule whose selector list contains `selector`.
function ruleBody(css, selector) {
  const bodies = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(",").some((s) => s.trim() === selector)) bodies.push(body);
  }
  return bodies.join("\n");
}

describe("friend recommendations styles", () => {
  it("has a delimited section in styles.css", () => {
    expect(section()).toContain(".friend-recs");
  });

  it("uses only tokens that are defined somewhere in styles.css", () => {
    const used = [...section().matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const token of new Set(used)) {
      expect(stylesContent, `${token} is not defined`).toMatch(
        new RegExp(`^\\s*${token}\\s*:`, "m")
      );
    }
  });

  it("has no gradients, shadows or stray colour literals", () => {
    const css = section();
    expect(css).not.toMatch(/gradient/i);
    expect(css).not.toMatch(/box-shadow/i);
    const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    for (const hex of hexes) {
      expect(["#111111", "#ffffff"]).toContain(hex.toLowerCase());
    }
  });

  it("buttons reset the global uppercase transform and are 44px tall", () => {
    const body = ruleBody(section(), ".friend-recs__btn");
    expect(body).toMatch(/text-transform:\s*none/);
    expect(body).toMatch(/min-height:\s*44px/);
  });

  it("Sleeve's blanket button and hover rules skip the card's buttons", () => {
    const sleeveCss = fs.readFileSync(
      path.resolve(__dirname, "../../skins/sleeve/sleeve.css"),
      "utf-8"
    );
    const exclusions = sleeveCss.match(/:not\(\s*\[class\*="friend-recs__"\]\s*\)/g) || [];
    expect(exclusions.length).toBeGreaterThanOrEqual(2);
  });

  it("button text passes 4.5:1 on every accent colour", () => {
    const accents = [
      ...stylesContent.matchAll(/:root\[data-accent="([a-z_]+)"\]\s*\{([^}]*)\}/g),
    ].map((m) => ({
      id: m[1],
      hex: (m[2].match(/--color-accent:\s*(#[0-9a-fA-F]{6})/) || [])[1],
    }));
    expect(accents.length).toBe(8);
    for (const { id, hex } of accents) {
      expect(hex, `${id} has no --color-accent`).toBeTruthy();
      const override = ruleBody(section(), `:root[data-accent="${id}"] .friend-recs`);
      const on =
        (override.match(/--friend-recs-on-accent:\s*(#[0-9a-fA-F]{6})/) || [])[1] || "#ffffff";
      expect(contrast(on, hex), `${id}: ${on} on ${hex}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
