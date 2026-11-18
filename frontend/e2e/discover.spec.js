import { test, expect } from "@playwright/test";

const SAVED = {
  scope: "my_artists",
  local_only_my_artists: false,
  date_window: "all",
  only_new: false,
  only_interested: false,
  country_code: "",
  my_artists_mode: "top_n",
  my_artists_limit: 100,
  my_artists_min_plays: 5,
  my_artists_months: 12,
  include_seen_live: true,
};

const items = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  source: "skiddle",
  external_id: `sk-${i + 1}`,
  artist_name: `Band ${i + 1}`,
  attraction_names: [`Band ${i + 1}`],
  event_name: `Band ${i + 1} Live`,
  venue_name: "The Venue",
  city: "Coventry",
  country_code: "GB",
  event_date: "2027-01-01",
  event_time: "19:30",
  ticket_url: `https://www.skiddle.com/e/${i + 1}/`,
  image_url: null,
  distance_miles: 3.2,
  is_my_artist: true,
  is_possible_match: false,
  is_seen_live: false,
  is_newly_announced: false,
  is_interested: false,
  already_going: false,
  concert_id: null,
}));

// The app's service worker would take over fetches after the first load, and
// page.route can't see requests it makes, so keep it out of these tests
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("audio-scrobbler-session", JSON.stringify({ accessToken: "e2e-token" }));
  });
  await page.route("**/*", (route) => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return route.continue();
    const { pathname } = new URL(request.url());
    if (pathname === "/setlists/discover") {
      return route.fulfill({
        json: {
          configured: true,
          has_home_city: true,
          home_city: "Warwick",
          saved_radius_miles: 10,
          saved_filters: SAVED,
          countries: ["GB"],
          items,
        },
      });
    }
    if (pathname === "/setlists/status") return route.fulfill({ json: { configured: true } });
    if (pathname === "/setlists/attendances") return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
});

test.describe("discover", () => {
  test("Artist criteria opens a real dialog over the page, and Cancel closes it", async ({
    page,
  }) => {
    await page.goto("/gigs?tab=discover");
    await page.getByRole("button", { name: "Artist criteria", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: /artists criteria/i });
    await expect(dialog).toBeVisible();

    // It has to sit on top of the page, inside the visible window, not at the bottom of a long list
    const viewport = page.viewportSize();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    const backdrop = await page
      .locator(".modal-backdrop")
      .evaluate((el) => getComputedStyle(el).position);
    expect(backdrop).toBe("fixed");

    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test("Saving the criteria sends the choice to the server", async ({ page }) => {
    let saved = null;
    await page.route("**/users/me/settings/gig-discovery", (route) => {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: {} });
    });
    await page.goto("/gigs?tab=discover");
    await page.getByRole("button", { name: "Artist criteria", exact: true }).click();
    await page.getByLabel("Played at least X times").check();
    await page.getByRole("button", { name: "Save criteria", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(saved?.gig_discovery_filters?.my_artists_mode).toBe("min_plays");
  });
});
