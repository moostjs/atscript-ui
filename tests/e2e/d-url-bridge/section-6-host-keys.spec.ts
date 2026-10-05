// Section 6 — URL bridge: host-owned query keys (`preserveKeys`, 0.1.148).
//
// `/orders-by-status` carries a PAGE key, `?status=`, that is also a column
// path of the table. With `useTableUrlQuery(..., { preserveKeys })` the bridge
// never reads, writes or removes it: it drives the forced scope only, a
// `status` column filter of the user stays private to the table, and the
// table's own keys (`total>'100'`, `$sort`) round-trip beside it.

import { expect, test } from "../fixtures";

import {
  addFilterPill,
  clickColumnHeader,
  commitPillInput,
  expectSinglePages,
  expectUrlQuery,
  pickSort,
  pillByLabel,
} from "../helpers";

async function open(page: import("../fixtures").Page, query: string) {
  const meta = page.waitForResponse("**/api/db/tables/orders/meta");
  const pages = page.waitForRequest((r) => /\/orders\/pages\?/u.test(r.url()));
  await page.goto(`/orders-by-status${query}`);
  await meta;
  return decodeURIComponent((await pages).url());
}

test.describe("Section 6.7 — host-owned key beside the table's own keys", () => {
  test("the host key forces the scope and is never a filter chip", async ({ page }) => {
    const url = await open(page, "?status=shipped");
    expect(url).toContain("status=shipped");

    const statusPill = await addFilterPill(page, "Status");
    await expect(statusPill.locator(".as-filter-field-chip")).toHaveCount(0);
  });

  test("total>100 and $sort round-trip beside it; reload restores both; clearing keeps status", async ({
    page,
  }) => {
    await open(page, "?status=shipped");

    const totalPill = await addFilterPill(page, "Total");
    await expectSinglePages(page, () => commitPillInput(totalPill, ">100"), { table: "orders" });
    const sorted = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "status");
        await pickSort(page, "desc");
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(sorted.url)).toContain("$sort=-status");
    expectUrlQuery(page, ["status=shipped", "total>'100'", "$sort=-status"]);

    // Reload restores the scope, the filter and the sort in one request.
    const reloaded = await open(page, new URL(page.url()).search);
    expect(reloaded).toContain("status=shipped");
    expect(reloaded).toContain("total>'100'");
    expect(reloaded).toContain("$sort=-status");
    await expect(pillByLabel(page, "Total").locator(".as-filter-field-chip")).toHaveCount(1);

    // Clearing the table's filters leaves the host key alone.
    const pill = pillByLabel(page, "Total");
    const cleared = await expectSinglePages(
      page,
      () => pill.locator(".as-filter-field-chip-remove").click(),
      { table: "orders" },
    );
    expect(decodeURIComponent(cleared.url)).not.toContain("total>");
    expectUrlQuery(page, ["status=shipped"]);
    expectUrlQuery(page, ["total>'100'"], { not: true });
  });

  test("a user Status filter stays private: the host key is untouched, one query", async ({
    page,
  }) => {
    await open(page, "?status=shipped");
    const statusPill = await addFilterPill(page, "Status");

    const captured = await expectSinglePages(
      page,
      async () => {
        await statusPill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await dropdown
          .locator("tbody tr td", { hasText: /^pending$/ })
          .first()
          .click();
        await page.keyboard.press("Escape");
      },
      { table: "orders" },
    );
    // The table's own filter is on the wire next to the forced scope …
    expect(decodeURIComponent(captured.url)).toContain("pending");
    // … but the browser URL keeps the host's value and gains nothing.
    expectUrlQuery(page, ["status=shipped"]);
    expectUrlQuery(page, ["status=pending"], { not: true });
    await expect(statusPill.locator(".as-filter-field-chip")).toHaveCount(1);
  });
});
