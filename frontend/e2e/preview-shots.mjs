// Screenshots of a running preview at desktop and phone sizes, for the AI to
// look at before handing over. They show real data, so the folder must be outside
// this repo. Usage, from frontend/:
//   node e2e/preview-shots.mjs <output-folder> /reports /library ...
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = process.env.PREVIEW_URL || "http://localhost:15173";
const SIZES = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

const [outDir, ...paths] = process.argv.slice(2);
if (!outDir || paths.length === 0) {
  console.error("Usage: node e2e/preview-shots.mjs <output-folder> <path> [path...]");
  process.exit(2);
}
const repo = resolve(import.meta.dirname, "../..");
if (`${resolve(outDir)}/`.startsWith(`${repo}/`)) {
  console.error("Screenshots show real data, so save them outside this repo.");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
let failures = 0;
for (const [sizeName, viewport] of Object.entries(SIZES)) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${BASE}/preview-login.html`);
  await page.waitForURL(`${BASE}/`);
  for (const path of paths) {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const file = join(outDir, `${path.replace(/\W+/g, "_") || "_home"}-${sizeName}.png`);
    await page.screenshot({ path: file, fullPage: true });
    if (!response?.ok()) failures += 1;
    console.log(`${response?.status()} ${file}`);
  }
  await context.close();
}
await browser.close();
process.exit(failures ? 1 : 0);
