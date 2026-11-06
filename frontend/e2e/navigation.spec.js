import { test, expect } from "@playwright/test";

const PAGES = [
  ["/play", "Play"],
  ["/library", "Library"],
  ["/reports", "Reports"],
  ["/gigs", "Gigs"],
  ["/profile", "Profile"],
  ["/connect", "Connect"],
];

const PRIMARY_LINKS = ["Play", "Library", "Reports", "Gigs"];

test.describe("navigation", () => {
  for (const [path, label] of PAGES) {
    test(`shows the header navigation on ${label}`, async ({ page }) => {
      await page.goto(path);
      const nav = page.getByRole("navigation", { name: "Primary navigation" });
      await expect(nav).toBeVisible();
      for (const navLabel of PRIMARY_LINKS) {
        await expect(nav.getByRole("link", { name: navLabel, exact: true })).toBeVisible();
      }
      await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Connect", exact: true })).toBeVisible();
    });
  }

  test("highlights the active link for the current route", async ({ page }) => {
    await page.goto("/reports");
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav.getByRole("link", { name: "Reports", exact: true })).toHaveClass(
      /nav-link-active/
    );
    await expect(nav.getByRole("link", { name: "Play", exact: true })).not.toHaveClass(
      /nav-link-active/
    );
  });

  test("keeps the header visible and updates the active link after navigating", async ({
    page,
  }) => {
    await page.goto("/play");
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await nav.getByRole("link", { name: "Library", exact: true }).click();

    await expect(page).toHaveURL(/\/library$/);
    await expect(nav).toBeVisible();
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Library", exact: true })).toHaveClass(
      /nav-link-active/
    );
  });

  test("persists the header navigation after a full page reload", async ({ page }) => {
    await page.goto("/library");
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  });

  test("shows a working mobile menu on small viewports", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/play");

    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    const toggle = page.getByRole("button", { name: "Toggle navigation menu" });
    await expect(toggle).toBeVisible();
    await expect(nav.getByRole("link", { name: "Library", exact: true })).not.toBeVisible();

    await toggle.click();
    await expect(nav.getByRole("link", { name: "Library", exact: true })).toBeVisible();

    await nav.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
  });
});
