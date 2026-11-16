import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

// jsdom cannot measure layout, so these tests pin the CSS rules that stop Gigs and
// Settings scrolling sideways on phones (fixed in v0.50.3). The real-browser check is
// the Page check in AGENTS.md.
const css = fs.readFileSync(path.resolve(__dirname, "styles.css"), "utf-8");

// Returns the body of the first `selector { ... }` rule found at or after `from`.
function ruleBody(selector, from = 0) {
  const start = css.indexOf(`${selector} {`, from);
  expect(start, `rule "${selector}" not found`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

// Returns the CSS inside the first `@media (max-width: <px>)` block, with braces balanced.
function mediaBlock(maxWidth) {
  const start = css.indexOf(`@media (max-width: ${maxWidth}px) {`);
  expect(start, `@media (max-width: ${maxWidth}px) not found`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") depth -= 1;
    if (depth === 0) return css.slice(start, i + 1);
  }
  throw new Error("unbalanced @media block");
}

describe("phone layout does not scroll sideways", () => {
  it("Gigs panel bleeds out by exactly the app shell side padding on phones", () => {
    const shell = mediaBlock(760).match(/\.app-shell\s*\{[^}]*padding:\s*[^;]*?\s(\S+)\s+\S+;/);
    expect(shell, "mobile .app-shell padding not found").not.toBeNull();
    const shellSide = shell[1]; // second value of "top side bottom" is the side padding

    const panel = mediaBlock(640).match(/\.sfm-panel\s*\{([^}]*)\}/);
    expect(panel, "mobile .sfm-panel rule not found").not.toBeNull();
    expect(panel[1]).toMatch(new RegExp(`margin:\\s*0\\s+-${shellSide}\\s*;`));
  });

  it("Settings form can shrink to fit a narrow screen", () => {
    expect(ruleBody(".settings-form")).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(ruleBody(".settings-form label")).toMatch(/min-width:\s*0/);
    const start = css.indexOf(".settings-form select,\n.settings-form input:not(");
    expect(start, "settings-form field rule not found").toBeGreaterThanOrEqual(0);
    const fields = css.slice(start, css.indexOf("}", start));
    expect(fields).toMatch(/max-width:\s*100%/);
    expect(fields).toMatch(/min-width:\s*0/);
  });
});
