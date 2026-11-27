import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const nginx = fs.readFileSync(path.resolve(__dirname, "../nginx.conf"), "utf-8");
const vite = fs.readFileSync(path.resolve(__dirname, "../vite.config.js"), "utf-8");

// The Year Wrapped page lives at /wrapped/:year, so its API has to live somewhere else. If the API path isn't
// proxied, the web page server answers API calls with the web page and the banner never shows.
describe("Year Wrapped API path is proxied to the backend", () => {
  it("is listed in the production web server config", () => {
    const proxied = nginx.match(/location ~ \^\/\(([^)]*)\) \{/g) || [];
    expect(proxied.some((line) => line.includes("year-reviews"))).toBe(true);
  });

  it("is listed in the dev server proxy", () => {
    expect(vite).toMatch(/"\/year-reviews":/);
  });

  it("does not take over the page's own address", () => {
    expect(nginx).not.toMatch(/\|wrapped[|)]/);
    expect(vite).not.toMatch(/"\/wrapped":/);
  });
});
