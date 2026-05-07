// Scenario 12.1 — Loading skeleton.
//
// The demo's `latencyInterceptor` natively injects ~50 ms on /meta and
// ~100 ms on /pages — a 100–150 ms window where the "Loading…" overlay
// renders. That's tighter than Playwright's locator polling cadence, so
// we extend it via `page.route(...)` (a deterministic 1 s delay on the
// first /meta hit) instead of racing the natural latency. The brief
// allows this — what we're asserting is that the overlay appears at all,
// not the exact 100 ms duration.
//
// After /pages settles, the overlay must disappear.

import { expect, test } from "../fixtures";

test("table loading overlay visible during in-flight, hidden after settle", async ({ page }) => {
  let metaDelayed = false;
  await page.route("**/api/db/tables/users/meta", async (route) => {
    if (!metaDelayed) {
      metaDelayed = true;
      await new Promise((r) => setTimeout(r, 1_000));
    }
    await route.continue();
  });

  await page.goto("/");

  const overlay = page.getByText("Loading…", { exact: true });
  const usersPages = page.waitForResponse("**/api/db/tables/users/pages**");

  await page.getByRole("link", { name: "Users", exact: true }).click();

  // While /meta is held by the route handler, the inner "Loading…" overlay
  // inside the table region must be on screen.
  await expect(overlay.first()).toBeVisible({ timeout: 5_000 });

  await usersPages;
  await expect(overlay).toHaveCount(0, { timeout: 5_000 });
});
