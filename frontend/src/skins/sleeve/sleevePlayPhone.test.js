import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Comments are stripped so one sitting above a rule doesn't become part of its selector.
const css = fs
  .readFileSync(path.resolve(__dirname, "sleeve.css"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// Splits the stylesheet into what sits inside `@media (max-width: 640px) { ... }` (phone)
// and everything else, by counting braces.
function splitPhone(source) {
  const marker = "@media (max-width: 640px) {";
  let phone = "";
  let rest = "";
  let cursor = 0;
  for (let start = source.indexOf(marker); start !== -1; start = source.indexOf(marker, cursor)) {
    rest += source.slice(cursor, start);
    let depth = 1;
    let i = start + marker.length;
    while (depth > 0 && i < source.length) {
      if (source[i] === "{") depth += 1;
      if (source[i] === "}") depth -= 1;
      i += 1;
    }
    phone += source.slice(start + marker.length, i - 1);
    cursor = i;
  }
  rest += source.slice(cursor);
  return { phone, rest };
}

const { phone, rest } = splitPhone(css);

// Joined declarations of every rule in `source` whose selector list contains `selector`.
function ruleBody(source, selector) {
  const bodies = [];
  for (const [, selectors, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (
      selectors
        .split(",")
        .map((s) => s.trim())
        .includes(selector)
    ) {
      bodies.push(body);
    }
  }
  return bodies.join("\n");
}

const S = '[data-skin="sleeve"]';
const FLAT = `${S} [data-jukebox-view="flat"]`;

describe("Sleeve Play page on a phone", () => {
  it("gives Lucky Dip its own full-width row and lets the other two share the next", () => {
    const row = ruleBody(phone, `${S} .jukebox-actions`);
    expect(row).toMatch(/display:\s*grid\s*!important/);
    expect(row).toMatch(/grid-template-columns:\s*1fr 1fr/);
    expect(ruleBody(phone, `${S} .jukebox-actions .jukebox-action-primary`)).toMatch(
      /grid-column:\s*1 \/ -1/
    );
  });

  it.each(["jukebox-action-primary", "jukebox-action-reroll", "jukebox-action-spotify"])(
    "keeps %s a 44px touch target whose label never wraps",
    (cls) => {
      const body = ruleBody(phone, `${S} .jukebox-actions .${cls}`);
      expect(body).toMatch(/min-height:\s*44px/);
      expect(body).toMatch(/white-space:\s*nowrap/);
    }
  );

  it("shows the source tabs as two on the first row and Rough Trade across the second", () => {
    const tabs = ruleBody(phone, `${FLAT} .jukebox-source-tabs`);
    expect(tabs).toMatch(/display:\s*grid\s*!important/);
    expect(tabs).toMatch(/grid-template-columns:\s*1fr 1fr/);
    expect(ruleBody(phone, `${FLAT} .jukebox-source-tab-btn`)).toMatch(/white-space:\s*nowrap/);
    expect(ruleBody(phone, `${FLAT} .jukebox-source-tab-btn:last-child`)).toMatch(
      /grid-column:\s*1 \/ -1/
    );
  });

  it("leaves the computer layout and the arcade jukebox alone", () => {
    // The row's layout is only ever set inside the phone block...
    const outsidePhone = [...rest.matchAll(/([^{}]+)\{/g)].flatMap(([, list]) =>
      list.split(",").map((s) => s.trim())
    );
    expect(outsidePhone.filter((s) => s.includes(".jukebox-actions"))).toEqual([]);
    // ...and every phone rule for the source tabs is limited to the flat view.
    const tabSelectors = [...phone.matchAll(/([^{}]+)\{/g)]
      .flatMap(([, list]) => list.split(",").map((s) => s.trim()))
      .filter((s) => s.includes(".jukebox-source-tab"));
    expect(tabSelectors.length).toBeGreaterThan(0);
    for (const selector of tabSelectors) {
      expect(selector, selector).toContain('[data-jukebox-view="flat"]');
    }
    expect(css).not.toMatch(/RetroJukebox|retro-jukebox/i);
  });
});
