// Section 39 — Presets session cache (0.1.153).
//
// The demo binds the viewer with `setMetaCacheIdentity()` (`use-me.ts`), which
// turns on the browser presets cache keyed by (presets url, app, tableKey):
//   39.1 a table re-mounted by SPA navigation requests neither
//        `_presets/query` nor `_presets/capabilities` again, and still queries;
//   39.2 a preset saved in one mounted table shows up in another mounted
//        table on the same scope (`/preset-twins`) without a reload;
//   39.3 the same across two tabs (BroadcastChannel);
//   39.4 sign-out → sign-in as another user (SPA) never shows the previous
//        user's private presets.
//
// Mutating (Save as writes `_presets` rows): `resetSeed()` once, serial.

import type { Request } from "@playwright/test";

import { type Locator, type Page, expect, test } from "../fixtures";

import { DEMO_PASSWORD, authFileFor, gotoTable, resetSeed } from "../helpers";

const PICKER_TRIGGER = ".as-preset-picker-trigger";
const PICKER_MENU = ".as-preset-picker-menu";
const PICKER_ITEM = ".as-preset-picker-item";
const PICKER_ACTION = ".as-preset-picker-action";
const PICKER_POPOVER = ".as-preset-picker-popover";
const POPOVER_NAME_INPUT = ".as-preset-picker-popover-input";
const POPOVER_SAVE_BTN = ".as-preset-picker-popover-save";

/** `GET _presets/query` / `_presets/capabilities` requests for one `tableKey`. */
function recordPresetLoads(page: Page, tableKey: string): Request[] {
  const seen: Request[] = [];
  const scope = new RegExp(`[?&]tableKey=${tableKey}(&|$)`);
  page.on("request", (r) => {
    if (r.method() !== "GET") return;
    const url = decodeURIComponent(r.url());
    if (!/\/api\/db\/_presets\/(query|capabilities)/.test(url)) return;
    if (scope.test(url)) seen.push(r);
  });
  return seen;
}

function pagesResponse(page: Page, table: string) {
  return page.waitForResponse(
    (r) =>
      r.url().includes(`/api/db/tables/${table}/pages`) &&
      r.request().method() === "GET" &&
      r.status() === 200,
  );
}

async function openPicker(scope: Locator | Page): Promise<Locator> {
  await scope.locator(PICKER_TRIGGER).click();
  const page = "page" in scope ? scope.page() : scope;
  const menu = page.locator(PICKER_MENU);
  await expect(menu).toBeVisible();
  return menu;
}

async function closePicker(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.locator(PICKER_MENU)).toHaveCount(0);
}

async function saveAs(scope: Locator | Page, label: string): Promise<void> {
  const page = "page" in scope ? scope.page() : scope;
  const menu = await openPicker(scope);
  await menu.locator(PICKER_ACTION).filter({ hasText: "Save as" }).click();
  const popover = page.locator(PICKER_POPOVER);
  await expect(popover).toBeVisible();
  await popover.locator(POPOVER_NAME_INPUT).fill(label);
  const post = page.waitForResponse(
    (r) => r.url().includes("/api/db/_presets") && r.request().method() === "POST",
  );
  await popover.locator(POPOVER_SAVE_BTN).click();
  expect((await post).ok()).toBe(true);
  await expect(popover).toHaveCount(0);
}

async function gotoTwins(page: Page): Promise<void> {
  const loads = page.waitForResponse(
    (r) => r.url().includes("/api/db/_presets/query") && r.url().includes("preset-twins"),
  );
  await page.goto("/preset-twins");
  await loads;
  await expect(page.getByTestId("twin-left").locator(PICKER_TRIGGER)).toBeVisible();
  await expect(page.getByTestId("twin-right").locator(PICKER_TRIGGER)).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("Section 39 — Presets session cache", () => {
  test.beforeAll(async () => {
    await resetSeed();
  });

  test("39.1 — SPA re-mount requests no presets / capabilities and still queries", async ({
    page,
  }) => {
    const usersLoads = recordPresetLoads(page, "users");
    await gotoTable(page, "users");
    await expect(page.locator(PICKER_TRIGGER)).toBeVisible();
    // The first mount loads rows + capabilities once.
    await expect.poll(() => usersLoads.length).toBe(2);

    const nav = page.locator("nav");
    const orders = pagesResponse(page, "orders");
    await nav.getByRole("link", { name: "Orders", exact: true }).click();
    await orders;

    const before = usersLoads.length;
    const users = pagesResponse(page, "users");
    await nav.getByRole("link", { name: "Users", exact: true }).click();
    await users; // the first query is not held by a presets round-trip
    await expect(page.locator(PICKER_TRIGGER)).toBeVisible();
    // Give any stray background load time to show up.
    await page.waitForTimeout(500);
    expect(usersLoads.length - before).toBe(0);
  });

  test("39.2 — a preset saved in one table appears in another mounted table", async ({ page }) => {
    await gotoTwins(page);
    const left = page.getByTestId("twin-left");
    const right = page.getByTestId("twin-right");

    await saveAs(left, "Twin A");

    const menu = await openPicker(right);
    await expect(menu.locator(PICKER_ITEM).filter({ hasText: "Twin A" })).toHaveCount(1);
    await closePicker(page);
  });

  test("39.3 — a preset saved in another tab appears without a reload", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFileFor("admin") });
    try {
      const a = await ctx.newPage();
      const b = await ctx.newPage();
      await gotoTwins(a);
      await gotoTwins(b);

      await saveAs(a.getByTestId("twin-left"), "From tab A");

      const menu = await openPicker(b.getByTestId("twin-right"));
      await expect(menu.locator(PICKER_ITEM).filter({ hasText: "From tab A" })).toHaveCount(1);
      await closePicker(b);
    } finally {
      await ctx.close();
    }
  });

  test("39.4 — sign-out → sign-in as another user never shows the previous user's presets", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFileFor("admin") });
    try {
      const page = await ctx.newPage();
      await gotoTable(page, "users");
      await saveAs(page, "Admin private");
      let menu = await openPicker(page);
      await expect(menu.locator(PICKER_ITEM).filter({ hasText: "Admin private" })).toHaveCount(1);
      await closePicker(page);
      // Survives only while the document does — proves no reload below.
      await page.evaluate(() => {
        (window as unknown as { __spa?: boolean }).__spa = true;
      });

      await page.locator("nav").getByRole("button", { name: "Log out" }).click();
      await page.waitForURL(/\/login$/);
      await page.locator('input[name="username"]').fill("viewer");
      await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
      await Promise.all([
        page.waitForURL(/\/$/),
        page.getByRole("button", { name: /Sign In/i }).click(),
      ]);
      await expect(page.getByText(/\(viewer\)/)).toBeVisible();

      const viewerLoads = recordPresetLoads(page, "users");
      await page.locator("nav").getByRole("link", { name: "Users", exact: true }).click();
      await expect(page.locator(PICKER_TRIGGER)).toBeVisible();
      // The viewer's presets were fetched anew, not served from the admin's cache.
      await expect.poll(() => viewerLoads.length).toBeGreaterThanOrEqual(2);
      menu = await openPicker(page);
      await expect(menu.locator(PICKER_ITEM).filter({ hasText: "Admin private" })).toHaveCount(0);
      await closePicker(page);
      expect(await page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa)).toBe(
        true,
      );
    } finally {
      await ctx.close();
    }
  });
});
