import { test, expect } from "@playwright/test";

// Made-up numbers, served by mocked routes so no backend is needed.
const snapshot = {
  year: 2026,
  stage: "unlock",
  date_from: "2026-01-01",
  date_to: "2026-12-31",
  partial_from: null,
  changed: [],
  music: {
    total_plays: 5000,
    estimated_minutes: 61420,
    months: [10, 20, 30, 40, 90, 50, 40, 30, 20, 10, 5, 2],
    busiest_month: 5,
    top_artists: [{ name: "Artist A", plays: 812 }],
    top_songs: [{ name: "Song One", artist: "Artist A", plays: 90 }],
    top_albums: [],
    top_genres: [],
    busiest_hour: 23,
    busiest_weekday: 4,
    listener_label: "Night owl",
    biggest_day: { date: "2026-09-09", plays: 80, minutes: 300 },
    new_artists: 120,
    first_song: { name: "First Song", artist: "Artist A", played_at: "2026-01-01T00:10:00" },
  },
  gigs: null,
};

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("audio-scrobbler-session", JSON.stringify({ accessToken: "e2e-token" }));
  });
  await page.route("**/year-reviews", (route) =>
    route.fulfill({
      json: {
        years: [{ year: 2026, status: "ready", stage: "unlock", top_artist: "Artist A" }],
        banner: { year: 2026 },
      },
    })
  );
  await page.route("**/year-reviews/2026", (route) =>
    route.fulfill({
      json: {
        year: 2026,
        stage: "unlock",
        is_sample: false,
        updated: false,
        format_version: 1,
        data: snapshot,
      },
    })
  );
  await page.route("**/year-reviews/2026/seen", (route) => route.fulfill({ status: 204 }));
  await page.route("**/year-reviews/2026/dismiss", (route) => route.fulfill({ status: 204 }));
});

test.describe("year Wrapped", () => {
  test("banner links to the story, which can be tapped through and closed", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Your 2026 Wrapped is ready")).toBeVisible();
    await page.getByRole("link", { name: "Play my year", exact: true }).click();

    await expect(page).toHaveURL(/\/wrapped\/2026$/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Your year in music", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Next slide", exact: true }).click();
    await expect(page.getByText("61,420")).toBeVisible();
    await page.getByRole("button", { name: "Previous slide", exact: true }).click();
    await expect(page.getByText("Your year in music", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page).toHaveURL(/\/reports$/);
  });

  test("the banner can be dismissed and the year stays on Reports", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await expect(page.getByText("Your 2026 Wrapped is ready")).toBeHidden();
    await page.getByRole("tab", { name: "Wrapped", exact: true }).click();
    await expect(page.getByRole("link", { name: "Play story", exact: true })).toBeVisible();
  });
});
