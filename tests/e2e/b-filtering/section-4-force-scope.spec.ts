// Section 4 — Filtering: a live `forceFilters` scope (0.1.148).
//
// `/orders-by-status` derives the table's `forceFilters` from the PAGE's route
// key (`?status=`). A segmented control above the table writes the key; the
// table is not keyed by it. A switch must re-query the mounted table on
// page 1 (no remount, no stale initial scope), keep the user's own filters,
// and honour `:block-query` (nothing while held, one query on release).

import { type Page, expect, test } from "../fixtures";

import {
  addFilterPill,
  clickPaginationNext,
  commitPillInput,
  expectNoPages,
  expectSinglePages,
  gotoTable,
} from "../helpers";

const scopeBtn = (page: Page, label: string) =>
  page.getByTestId("host-scope").getByRole("button", { name: label, exact: true });

/** Keep the same DOM table across switches: a remount would detach it. */
async function pinTable(page: Page) {
  const handle = await page.getByTestId("table-wrap").elementHandle();
  expect(handle).not.toBeNull();
  const main = await page.locator("table[data-as-main-table]").first().elementHandle();
  return async () => {
    expect(await handle!.evaluate((n) => n.isConnected)).toBe(true);
    expect(await main!.evaluate((n) => n.isConnected)).toBe(true);
  };
}

test.describe("Section 4.14 — live forceFilters from a host route key", () => {
  test("each switch is one request on page 1, same table, user filter kept", async ({ page }) => {
    await gotoTable(page, "orders-by-status", { apiPath: "orders" });
    const stillMounted = await pinTable(page);

    // Page 2 of "All" (15 orders, 10 per page).
    await expectSinglePages(page, () => clickPaginationNext(page), { table: "orders" });

    const shipped = await expectSinglePages(page, () => scopeBtn(page, "shipped").click(), {
      table: "orders",
    });
    const shippedUrl = decodeURIComponent(shipped.url);
    expect(shippedUrl).toContain("status=shipped");
    expect(shippedUrl).toMatch(/\$page=1\b/u);
    await stillMounted();

    // A user filter beside the forced scope.
    const totalPill = await addFilterPill(page, "Total");
    const withTotal = await expectSinglePages(page, () => commitPillInput(totalPill, ">100"), {
      table: "orders",
    });
    expect(decodeURIComponent(withTotal.url)).toContain("status=shipped");
    expect(decodeURIComponent(withTotal.url)).toContain("total>'100'");
    await expect(totalPill.locator(".as-filter-field-chip")).toHaveCount(1);

    const pending = await expectSinglePages(page, () => scopeBtn(page, "pending").click(), {
      table: "orders",
    });
    const pendingUrl = decodeURIComponent(pending.url);
    expect(pendingUrl).toContain("status=pending");
    expect(pendingUrl).not.toContain("status=shipped");
    expect(pendingUrl).toContain("total>'100'");
    expect(pendingUrl).toMatch(/\$page=1\b/u);
    await expect(totalPill.locator(".as-filter-field-chip")).toHaveCount(1);
    await stillMounted();

    // "All" drops the forced status.
    const all = await expectSinglePages(page, () => scopeBtn(page, "All").click(), {
      table: "orders",
    });
    expect(decodeURIComponent(all.url)).not.toContain("status=");
    expect(decodeURIComponent(all.url)).toContain("total>'100'");
    await stillMounted();
  });

  test("with 'Hold queries' on, a switch sends nothing; releasing sends one with the latest scope", async ({
    page,
  }) => {
    await gotoTable(page, "orders-by-status", { apiPath: "orders" });
    const hold = page.locator(".demo-hold-queries");
    await hold.check();

    await expectNoPages(page, () => scopeBtn(page, "shipped").click(), { table: "orders" });
    await expectNoPages(page, () => scopeBtn(page, "cancelled").click(), { table: "orders" });

    const released = await expectSinglePages(page, () => hold.uncheck(), { table: "orders" });
    const url = decodeURIComponent(released.url);
    expect(url).toContain("status=cancelled");
    expect(url).not.toContain("status=shipped");
  });
});
