import { describe, expect, it } from "vitest";
import { festivalGroupKey, festivalLabel } from "./festivalNames";

describe("festival names", () => {
  it("drops the year and its dash for display", () => {
    expect(festivalLabel("V Festival – 2009")).toBe("V Festival");
    expect(festivalLabel("Victorious Festival - 2026")).toBe("Victorious Festival");
    expect(festivalLabel("Boardmasters 2006")).toBe("Boardmasters");
  });

  it("groups names that differ only by year, case or punctuation", () => {
    expect(festivalGroupKey("V Festival – 2009")).toBe(festivalGroupKey("V FESTIVAL - 2008"));
    expect(festivalGroupKey("V Festival")).toBe(festivalGroupKey("v festival, 2019"));
    expect(festivalGroupKey("V Festival")).not.toBe(festivalGroupKey("Leeds Festival"));
  });
});
