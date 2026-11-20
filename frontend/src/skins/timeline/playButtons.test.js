import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Comments are stripped so one sitting above a rule doesn't become part of its selector.
const css = fs
  .readFileSync(path.resolve(__dirname, "timeline.css"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

// Joined declarations of every top-level rule whose selector list contains `selector`.
function ruleBody(selector) {
  const bodies = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
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

const T = '[data-skin="timeline"]';
const FLAT = `${T} [data-jukebox-view="flat"]`;

describe("Timeline Play page control scale", () => {
  it("defines a compact scale and a 44px touch/phone scale", () => {
    expect(ruleBody(T)).toMatch(/--tl-control-h:\s*36px/);
    const touch = css.match(/@media \(max-width: 640px\), \(pointer: coarse\) \{([\s\S]*?)\n\}/);
    expect(touch).not.toBeNull();
    expect(touch[1]).toMatch(/--tl-control-h:\s*44px/);
    expect(touch[1]).toMatch(/--tl-mark-h:\s*44px/);
  });

  it.each([
    `${T} .jukebox-action-primary`,
    `${T} .jukebox-action-reroll`,
    `${T} .jukebox-action-spotify`,
    `${T} .rediscover-save-btn`,
    `${T} .friend-recs__btn`,
    `${FLAT} .jukebox-view-toggle`,
    `${FLAT} .jukebox-progress-btn`,
    `${FLAT} .jukebox-filters-toggle`,
  ])("sizes %s from the shared control height", (selector) => {
    expect(ruleBody(selector)).toMatch(/min-height:\s*var\(--tl-control-h\)/);
  });

  it("sizes every tab from the shared tab height", () => {
    expect(ruleBody(`${T} .rediscover-tab-btn`)).toMatch(/min-height:\s*var\(--tl-tab-h\)/);
    expect(ruleBody(`${FLAT} .jukebox-source-tab-btn`)).toMatch(/min-height:\s*var\(--tl-tab-h\)/);
  });

  it("keeps Open in Spotify on theme tokens instead of Spotify green", () => {
    const body = ruleBody(`${T} .jukebox-action-spotify`);
    expect(body).toMatch(/background:\s*var\(--color-surface\)/);
    expect(body).not.toMatch(/1db954/i);
  });

  it("fades a disabled Re-roll through colour only, not opacity as well", () => {
    expect(ruleBody(`${T} .jukebox-action-reroll:disabled`)).toMatch(/opacity:\s*1\s*!important/);
  });

  it("restyles the jukebox header controls only in the flat view, never the arcade cabinet", () => {
    const headerClasses = [
      "jukebox-source-tabs",
      "jukebox-source-tab-btn",
      "jukebox-view-toggle",
      "jukebox-progress-btn",
      "jukebox-filters-toggle",
      "jukebox-filters-drawer",
    ];
    const selectors = [...css.matchAll(/([^{}]+)\{/g)].flatMap(([, list]) =>
      list.split(",").map((s) => s.trim())
    );
    for (const cls of headerClasses) {
      const hits = selectors.filter((s) => s.includes(`.${cls}`));
      expect(hits.length, cls).toBeGreaterThan(0);
      for (const selector of hits) {
        expect(selector, selector).toContain('[data-jukebox-view="flat"]');
      }
    }
    expect(css).not.toMatch(/RetroJukebox|retro-jukebox/i);
  });

  it("keeps the phone action row from squeezing Lucky Dip", () => {
    expect(css).toMatch(
      /@media \(max-width: 640px\) \{[\s\S]*?\.jukebox-actions \.jukebox-action-primary \{\s*grid-column:\s*1 \/ -1/
    );
  });
});
