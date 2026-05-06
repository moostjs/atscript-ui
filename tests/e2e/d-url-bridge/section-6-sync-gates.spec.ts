// Section 6 — URL bridge: per-aspect sync gates.
//
// Covers:
//   - 6.3 `urlQuerySync` allowlist on /orders (`{ pagination: false,
//     filters: ['status', 'customerId'] }`): allowlisted filter (`status`)
//     round-trips; non-allowlisted filter (`total`) is private to the
//     linker; sorters NOT gated → `$sort` round-trips; pagination off →
//     `$skip` does NOT land in the URL bar.
//   - 6.5 `urlQuerySync.sorters: false` on /users: column-header sort flips
//     the table + the wire `/pages?` query gains `$sort=-username`, but the
//     browser URL bar does NOT. Filters still land in the URL when applied
//     after the gated sort (filter aspect is unaffected).
//
// Note on column targeting in 6.5:
//   - The scenario doc names `Created` (`createdAt`) for the sort step but
//     `users.createdAt` carries no `@db.index.*` annotation → `sortable:
//     false` on the wire (`<AsColumnMenu>` hides the Sort section). Per the
//     prompt's caveat we retarget to `Username` (`@db.index.unique` →
//     sortable). This is the same column batch C 7.1 settled on.

import { expect, test } from "@playwright/test";

import {
  addFilterPill,
  clickColumnHeader,
  commitPillInput,
  expectSinglePages,
  expectUrlQuery,
  gotoTable,
  pickPillEnumValue,
  pickSort,
  pillByLabel,
} from "../helpers";

test.describe("Section 6.3 — urlQuerySync allowlist (orders)", () => {
  test("Status round-trips, Total stays private, $sort round-trips, $skip absent", async ({
    page,
  }) => {
    await gotoTable(page, "orders");

    // Step 1 — pagination check. The seed has 15 orders; default page size
    // 25 fits everything on one page (next-page button disabled). Drop page
    // size to 10 first → 2 pages → click next. The wire query carries
    // `$page=2&$size=10` (the `pagination` controller uses `$page`/`$size`
    // pagination on the wire — the URL bridge encoder uses `$skip` shape
    // for outbound, but both round-trip through the `pagination` aspect
    // gate). The browser URL bar does NOT gain ANY pagination control
    // (`$skip` / `$limit` / `$page` / `$size`) since the gate is off.
    const sizeSelect = page.locator(".table-pagination select").first();
    await expect(sizeSelect).toBeVisible();
    await expectSinglePages(
      page,
      async () => {
        await sizeSelect.selectOption("10");
      },
      { table: "orders" },
    );
    // No pagination controls in the URL (gate stripped `$limit` / `$size`).
    expectUrlQuery(page, ["$limit", "$size"], { not: true });

    const nextBtn = page.locator(".table-pagination-btn[aria-label='Next page']");
    await expect(nextBtn).toBeEnabled();
    const pageCaptured = await expectSinglePages(
      page,
      async () => {
        await nextBtn.click();
      },
      { table: "orders" },
    );
    // Wire query is on page 2.
    expect(decodeURIComponent(pageCaptured.url)).toMatch(/\$page=2\b/u);
    // URL bar does NOT gain ANY pagination control.
    expectUrlQuery(page, ["$skip", "$limit", "$page", "$size"], { not: true });

    // Step 2 — Status = shipped (allowlisted in `filters: ['status', 'customerId']`).
    // Adding a filter resets pagination to page 1, so subsequent assertions
    // don't need to re-account for `$skip`.
    const statusPill = await addFilterPill(page, "Status");
    await expectSinglePages(
      page,
      async () => {
        await pickPillEnumValue(page, statusPill, "shipped");
      },
      { table: "orders" },
    );
    expectUrlQuery(page, ["status=shipped"]);

    // Step 3 — Total > 100 (NOT allowlisted; applied locally, private to linker).
    const totalPill = await addFilterPill(page, "Total");
    const captured = await expectSinglePages(
      page,
      async () => {
        await commitPillInput(totalPill, ">100");
      },
      { table: "orders" },
    );
    // Wire URL carries BOTH predicates — the gate is on the URL bar, not the
    // wire query.
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("status=shipped");
    expect(decoded).toContain("total>100");
    // Browser URL: `status` lands, `total` does not.
    expectUrlQuery(page, ["status=shipped"]);
    expectUrlQuery(page, ["total"], { not: true });

    // The Total filter is locally active — chip rendered.
    await expect(totalPill.locator(".as-filter-field-chip")).toHaveCount(1);

    // Step 4 — Sort by `status` desc. Sorters NOT gated → $sort round-trips
    // to the URL. (`Total` is unsortable per the 7.1 deviation note. We
    // target `status` instead since the scenario just needs "any sort lands
    // in the URL".)
    const sortCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "status");
        await pickSort(page, "desc");
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(sortCaptured.url)).toContain("$sort=-status");
    expectUrlQuery(page, ["$sort=-status"]);
    // Pagination is still gated, total still private.
    expectUrlQuery(page, ["$skip", "$limit", "$page", "$size", "total"], { not: true });
  });
});

test.describe("Section 6.5 — urlQuerySync.sorters: false (users)", () => {
  test("Sort by Username — wire $sort fires, URL bar absent; subsequent filter still lands", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    // Sort `Username` desc — the wire `/pages?` URL gains `$sort=-username`,
    // but the browser URL does NOT (gate strips it on encode AND decode).
    const sortCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "username");
        await pickSort(page, "desc");
      },
      { table: "users" },
    );
    expect(decodeURIComponent(sortCaptured.url)).toMatch(/\$sort=-username\b/u);

    // Header indicator visible (sort applied locally).
    const usernameHeader = page.locator(`thead th[data-column-path="username"]`).first();
    await expect(usernameHeader.locator(".as-th-sort.i-as-arrow-down")).toHaveCount(1);

    // Browser URL bar does NOT contain `$sort` — the gate strips on encode.
    expectUrlQuery(page, ["$sort"], { not: true });

    // Apply a filter — Status pill is auto-rendered by the Standard preset
    // on /users; commit `active` via the inline dropdown. The filter aspect
    // is NOT gated, so it lands in the URL.
    const statusPill = pillByLabel(page, "Status");
    await expect(statusPill).toHaveCount(1);
    const filterCaptured = await expectSinglePages(
      page,
      async () => {
        await pickPillEnumValue(page, statusPill, "active");
      },
      { table: "users" },
    );
    // Wire URL carries BOTH `$sort` and the new filter (gate is URL-bar
    // only).
    const decoded = decodeURIComponent(filterCaptured.url);
    expect(decoded).toContain("$sort=-username");
    expect(decoded).toContain("status=active");

    // Browser URL: filter lands, sort still gated.
    expectUrlQuery(page, ["status=active"]);
    expectUrlQuery(page, ["$sort"], { not: true });
  });
});
