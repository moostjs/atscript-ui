// Section 10 — Pagination (batch G).
//
// Read-only batch — paginated browsing on `/products`.
//
// **Why not `/orders`?** The prompt suggested `/orders` to dodge batch-F
// drift on `/users`, but the demo seed only inserts 15 orders. With
// vue-table's `DEFAULT_ITEMS_PER_PAGE = 25` (framework default — the
// demo no longer overrides it), 15 orders < 25 → orders fits on a single
// page and no pagination UI renders. Products has 2000 seed rows so
// pagination is exercised end-to-end. Products is also outside batch F's
// mutation scope (F mutates users only).
//
// Wire shape verified via inspection of `db-client/src/client.ts` line 138:
//   `controls: { ...query?.controls, $page: page, $size: size }`
// → `?$page=N&$size=M`. URL-encoded form is `%24page=N&%24size=M`.
//
// Pagination component (`packages/vue-demo/src/client/components/TablePagination.vue`):
//   - `.table-pagination` root.
//   - `.table-pagination-btn` page numbers and First / Prev / Next / Last
//     arrow buttons.
//   - `.table-pagination-btn-active` current-page indicator.
//   - Rows-per-page is a plain `<select class="i8-filled">` (verified —
//     line 39).
//
// **Tbody row count is virtualized.** TablePage wires `<AsTable>` with
// `virtual-row-height="36"`, so `<AsTableVirtualizer>` only renders the
// viewport-visible slice (~24 rows at the default 720 px viewport for a
// 25-row page). We assert against the `<span class="as-page-pill">`
// summary text ("25 of 2000") which reflects loaded vs total — the wire
// shape is the load-bearing assertion anyway.
//
// Selection-trim-on-page-nav (10.1 step 3): we select 2 rows on page 1,
// click page 2; product ids on page 2 are different (page 1 ids 1..25,
// page 2 ids 26..50). Selection trim collapses `selectedRows` to `[]`
// after refetch.

import { type Locator, expect, test } from "../fixtures";

import {
  clickPaginationNext,
  clickPaginationPage,
  columnCellIndex,
  expectNoPages,
  expectSinglePages,
  gotoTable,
  selectRowByIndex,
  setItemsPerPage,
  toggleSelectMode,
} from "../helpers";

// ---------------------------------------------------------------------
// File-local helper.

/** Read the trimmed text of `column` for every visible data row. */
async function readColumnValues(table: Locator, column: string): Promise<string[]> {
  const idx = await columnCellIndex(table, column);
  return table.locator("tbody tr:has(td)").evaluateAll((rows, columnIdx) => {
    return rows.map((row) => {
      const cells = row.querySelectorAll("td");
      return (cells[columnIdx]?.textContent ?? "").trim();
    });
  }, idx);
}

/** Assert wire shape — `$page=N&$size=M` (decoded form). */
function expectPageWire(url: string, page: number, size: number): void {
  const decoded = decodeURIComponent(url);
  expect(decoded).toContain(`$page=${page}`);
  expect(decoded).toContain(`$size=${size}`);
}

// ---------------------------------------------------------------------

// Serial: `expectSinglePages` windows flake when siblings contend for
// /pages observation slots (10.1b post-paint URL-bridge race).
test.describe.configure({ mode: "serial" });

test.describe("Section 10 — Pagination", () => {
  // -------------------------------------------------------------------
  // 10.1 — Page navigation

  test("10.1: Page 2 click fires single /pages?$page=2; indicator updates; trim collapses selection", async ({
    page,
  }) => {
    await gotoTable(page, "products");

    const table = page.locator("table[data-as-main-table]");

    // Pagination renders on /products (2000 rows ÷ 25 page-size = 80
    // pages). Sanity: the active button reads `1`.
    await expect(page.locator(".table-pagination")).toHaveCount(1);
    await expect(page.locator(".table-pagination-btn-active")).toHaveText("1");
    await expect(page.locator(".as-page-pill")).toContainText("25 of 2000");

    // Capture the page-1 ids visible in the (virtualized) viewport so
    // we can verify page 2 is disjoint. Read-once without pinning a
    // length — virtualization renders only what fits the viewport
    // (default 720 px → ~24 rows at 36 px each).
    const page1Ids = await readColumnValues(table, "id");
    expect(page1Ids.length).toBeGreaterThan(0);

    // Select 2 rows in select-mode so we can verify trim-on-page-nav.
    await toggleSelectMode(page);
    await selectRowByIndex(table, 0);
    await selectRowByIndex(table, 1);
    await expect(page.locator(".as-page-selection-count")).toHaveText("2 selected");

    // Click page 2 — wrapped in expectSinglePages so a double-fire
    // (e.g. broken debounce or a stray bridge echo) would surface.
    const captured = await expectSinglePages(
      page,
      async () => {
        await clickPaginationPage(page, 2);
      },
      { table: "products" },
    );

    // Wire shape: `$page=2&$size=25` (decoded — Playwright captures the
    // raw URL, decodeURIComponent normalises both raw and percent-
    // encoded forms to the same string).
    expectPageWire(captured.url, 2, 25);

    // Indicator: page 2 is now active; page 1 is not.
    await expect(page.locator(".table-pagination-btn-active")).toHaveText("2");

    // Body: page 2's id set is disjoint from page 1.
    const page2Ids = await readColumnValues(table, "id");
    expect(page2Ids.length).toBeGreaterThan(0);
    const overlap = page2Ids.filter((id) => page1Ids.includes(id));
    expect(overlap).toEqual([]);

    // Selection trim: page 1's selected rows are not in the page-2
    // result → `selectedRows` collapses. The toolbar selection-summary
    // span unmounts when count is 0 (TableToolbar.vue line 127:
    // `v-if="state.selectedCount.value > 0"`).
    await expect(page.locator(".as-page-selection-count")).toHaveCount(0);
    await expect(table.locator("tbody tr:has(td)[aria-selected='true']")).toHaveCount(0);
  });

  test("10.1b: Next-arrow button is the same path — single /pages, indicator advances", async ({
    page,
  }) => {
    // Pin Next as a separate path so the assertion isn't redundant —
    // the page-number button and the Next arrow are distinct DOM
    // surfaces (different Reka primitives — `PaginationListItem` vs
    // `PaginationNext`).
    await gotoTable(page, "products");
    await expect(page.locator(".table-pagination-btn-active")).toHaveText("1");

    // Stabilization (Phase-2 batch H follow-up): `gotoTable` returns the
    // moment the FIRST `/pages` response arrives, but the URL-bridge / state
    // watchers can schedule a follow-up `/pages` echo within the next ~500 ms
    // debounce window. If the next-arrow click lands inside that window,
    // `expectSinglePages` below counts the in-flight echo as a 2nd
    // request and fails. 10.1 (page-number click) settles naturally — it
    // performs several read-only assertions + select-mode mutations between
    // gotoTable and the click, which gives the echo time to arrive. 10.1b
    // had no such pre-click settle, so it flaked under full-suite timing
    // (passed in isolation 20/20). Using `expectNoPages` with an empty
    // gesture pins the 700 ms quiet window to elapse with zero requests
    // before we measure the click.
    await expectNoPages(page, async () => {}, { table: "products" });

    const captured = await expectSinglePages(
      page,
      async () => {
        await clickPaginationNext(page);
      },
      { table: "products" },
    );
    expectPageWire(captured.url, 2, 25);

    // Indicator: assert the UI has settled BEFORE returning. The indicator
    // update is reactive on the response payload arriving — by the time
    // `expectSinglePages` resolves the request was sent (not necessarily
    // responded to), so this is the indicator-settle gate.
    await expect(page.locator(".table-pagination-btn-active")).toHaveText("2");
  });

  // -------------------------------------------------------------------
  // 10.2 — Rows-per-page change

  test("10.2: Changing rows-per-page fires single /pages?$page=1&$size=N; loaded count grows to N", async ({
    page,
  }) => {
    await gotoTable(page, "products");

    // Default size 25 — framework default (`DEFAULT_ITEMS_PER_PAGE`).
    // Pagination summary reflects "loaded of total".
    await expect(page.locator(".as-page-pill")).toContainText("25 of 2000");

    // Drain the URL-bridge echo before measuring the size change — same
    // post-`gotoTable` settle pattern as 10.1b above.
    await expectNoPages(page, async () => {}, { table: "products" });

    // Bump to 100. Pagination handler resets `page` to 1 (verified at
    // `TablePagination.vue` lines 27–28: setter spreads `{ page: 1, ... }`).
    const captured = await expectSinglePages(
      page,
      async () => {
        await setItemsPerPage(page, 100);
      },
      { table: "products" },
    );

    expectPageWire(captured.url, 1, 100);

    // Pagination summary updates to "100 of 2000". Tbody is virtualized
    // (only viewport-visible rows render), so we don't pin tr count
    // here — the wire size is the load-bearing assertion.
    await expect(page.locator(".as-page-pill")).toContainText("100 of 2000");
    await expect(page.locator(".table-pagination-btn-active")).toHaveText("1");
  });

  test("10.2b: Bump rows-per-page from a non-1 page resets to page 1", async ({ page }) => {
    // Independent path: confirm the size-change resets page → 1 from
    // page 2 specifically, since the setter at TablePagination.vue line 27
    // spreads `{ page: 1, ... }` unconditionally.
    await gotoTable(page, "products");

    // Move to page 2 first.
    await expectSinglePages(
      page,
      async () => {
        await clickPaginationPage(page, 2);
      },
      { table: "products" },
    );
    await expect(page.locator(".table-pagination-btn-active")).toHaveText("2");

    // Now bump size from 25 → 10. Single /pages with $page=1.
    const captured = await expectSinglePages(
      page,
      async () => {
        await setItemsPerPage(page, 10);
      },
      { table: "products" },
    );
    expectPageWire(captured.url, 1, 10);
    await expect(page.locator(".table-pagination-btn-active")).toHaveText("1");
  });
});
