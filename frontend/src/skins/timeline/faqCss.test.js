import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

// Locks in the Timeline FAQ audit fixes. Every selector is scoped to the Timeline skin so Classic
// and Sleeve stay as they are.
const css = fs.readFileSync(path.resolve(__dirname, "timeline.css"), "utf-8");

// All declaration blocks whose selector list contains the exact selector (nested @media included).
function bodies(selector) {
  const out = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = pattern.exec(css);
  while (match) {
    const selectors = match[1]
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(",")
      .map((s) => s.trim());
    if (selectors.includes(selector)) out.push(match[2]);
    match = pattern.exec(css);
  }
  return out;
}

const T = '[data-skin="timeline"]';

describe("Timeline FAQ styling", () => {
  it("styles answer links from tokens, underlined, not the browser blue", () => {
    const body = bodies(`${T} .faq-answer a`).join("\n");
    expect(body).toMatch(/color:\s*var\(--color-ink\)/);
    expect(body).toMatch(/text-decoration-line:\s*underline|text-decoration:\s*underline/);
    expect(body).not.toMatch(/#0000ee/i);
  });

  it("wraps long code and URLs inside the card and styles code from tokens", () => {
    const body = bodies(`${T} .faq-answer code`).join("\n");
    expect(body).toMatch(/overflow-wrap:\s*anywhere/);
    expect(body).toMatch(/monospace/);
    expect(body).toMatch(/background:\s*var\(--color-canvas\)/);
  });

  it("sets list text to the same 14px as paragraphs", () => {
    expect(bodies(`${T} .faq-answer li`).join("\n")).toMatch(/font-size:\s*14px/);
  });

  it("puts the padding on the summary row, not on the card, so the whole row taps", () => {
    const card = bodies(`${T} .faq-item`).join("\n");
    expect(card).toMatch(/padding:\s*0\b/);
    expect(card).toMatch(/margin-bottom:\s*0\b/);
    const question = bodies(`${T} .faq-question`).join("\n");
    expect(question).toMatch(/padding:\s*12px 16px/);
    expect(question).toMatch(/min-height:\s*48px/);
    // The shared Guide and FAQ rule must no longer give FAQ cards 20px padding.
    const shared = bodies(`${T} .guide-chapter`).join("\n");
    expect(bodies(`${T} .faq-item`).some((b) => /padding:\s*20px/.test(b))).toBe(false);
    expect(shared).toMatch(/padding:\s*20px/);
  });

  it("keeps answer text to a readable line length", () => {
    expect(bodies(`${T} .faq-answer p`).join("\n")).toMatch(/max-width:\s*70ch/);
    expect(bodies(`${T} .faq-answer ul`).join("\n")).toMatch(/max-width:\s*70ch/);
  });

  it("makes the search box and Clear button 44px tall, with 16px text on phones", () => {
    expect(bodies(`${T} .faq-search-input`).join("\n")).toMatch(/min-height:\s*44px/);
    expect(bodies(`${T} .faq-search-clear`).join("\n")).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\[data-skin="timeline"\] \.faq-search-input\s*\{[^}]*font-size:\s*16px/
    );
  });

  it("stays flat: no shadows or gradients in any Timeline FAQ rule", () => {
    const pattern = /([^{}]+)\{([^{}]*)\}/g;
    let match = pattern.exec(css);
    let checked = 0;
    while (match) {
      if (/\.faq-/.test(match[1])) {
        checked += 1;
        expect(match[2]).not.toMatch(/box-shadow|gradient/);
      }
      match = pattern.exec(css);
    }
    expect(checked).toBeGreaterThan(5);
  });
});
