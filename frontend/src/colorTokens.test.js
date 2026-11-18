import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.resolve(__dirname, "./styles.css"), "utf-8");

// Declarations of the first rule whose selector is exactly `selector`, or null.
function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : null;
}

describe("design token hygiene (flat, on-token, no fixed accents)", () => {
  it("guide callouts use a hairline border, not a coloured side stripe", () => {
    const body = ruleBody(".guide-callout");
    expect(body).not.toBeNull();
    expect(body).not.toMatch(/border-left\s*:/);
    expect(body).toMatch(/border:\s*0\.5px solid var\(--color-border\)/);
  });

  it("report crossover badges are plain label text with no fixed colours", () => {
    expect(ruleBody(".badge-1001")).toBeNull();
    expect(ruleBody(".badge-live")).toBeNull();
    expect(ruleBody(".crossover-badge")).toMatch(/color:\s*var\(--color-muted\)/);
  });

  it("text on the accent colour uses the on-accent token", () => {
    for (const selector of [
      ".nav-link-active",
      ".nav-link-active:hover",
      ".calendar-day-start,\n.calendar-day-end",
    ]) {
      const body = ruleBody(selector);
      expect(body, selector).not.toBeNull();
      expect(body, selector).toMatch(/color:\s*var\(--color-on-accent\)/);
      expect(body, selector).not.toMatch(/#ffffff/i);
    }
  });
});
