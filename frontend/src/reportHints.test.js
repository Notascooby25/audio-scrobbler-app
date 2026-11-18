import { describe, expect, it } from "vitest";
import { REPORT_HINTS } from "./reportHints";

describe("REPORT_HINTS", () => {
  it("every hint is short, plain English and non-empty", () => {
    const entries = Object.entries(REPORT_HINTS);
    expect(entries.length).toBeGreaterThan(20);
    for (const [id, text] of entries) {
      expect(text.trim(), id).not.toBe("");
      expect(text.length, id).toBeLessThanOrEqual(260);
      expect(text.split(/(?<=[.!?])\s/).length, id).toBeLessThanOrEqual(2);
    }
  });
});
