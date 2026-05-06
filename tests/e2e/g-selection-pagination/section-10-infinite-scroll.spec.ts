// Section 10.4 — Infinite-scroll mode on `/audit_log_infinite` (batch G).
//
// Read-only batch. The infinite-scroll variant pairs `<AsTable>` (paginated
// renderer) with the demo's `<InfiniteScroll>` listener (`packages/vue-demo/
// src/client/components/InfiniteScroll.vue`) — a thin VueUse
// `useInfiniteScroll` bridge that calls `state.queryNext()` once the
// scroll container is within ~200 px of its bottom. `queryNext` is the
// framework's append-style block fetcher (`use-table-state.ts` line 117);
// rows accumulate via `walkForwardAbsorb` so `state.results` grows from N
// to 2N (no replacement) on each load.
//
// Demo wires `audit_log_infinite` (`tables.ts`) with `apiPath: 'audit_log'`
// (re-using the existing controller / 5000 seed rows) and `limit: 100`.
// `limit: 100` matches `DEFAULT_BLOCK_SIZE` so the initial page lands
// block-aligned — `queryNext` then fetches page 2 only (a smaller `limit`
// would partial-fill block 0 and re-fetch it on the first `queryNext`).
//
// **Why `audit_log_infinite` ≠ `audit_log`?** `audit_log` is window-mode
// (`<AsWindowTable>`) and uses synthesised wheel events on
// `.as-window-row-pool` to advance `topIndex` (covered by 10.3). The
// infinite-scroll variant uses a different scroll surface
// (`.as-table-scroll-container`, mounted by `<AsTable>`'s base) and a
// different trigger mechanism (`useInfiniteScroll` on the container's
// scroll event). Two routes, same data, two render paths to verify.

import { type Page, expect, test } from "@playwright/test";

import { expectSinglePages, gotoTable } from "../helpers";

// ---------------------------------------------------------------------
// Inline helpers — not promoted to the helper barrel (chat-RFC required).

/**
 * Scroll the `<AsTable>` virtualizer's scroll container to the bottom
 * inside `page.evaluate` so the scroll event lands in the same task as
 * the assignment. `useInfiniteScroll` fires on the next `scroll` tick.
 */
async function scrollTableToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".as-table-scroll-container");
    if (!el) throw new Error(".as-table-scroll-container not found");
    el.scrollTop = el.scrollHeight;
  });
}

// ---------------------------------------------------------------------

test.describe("Section 10.4 — Infinite-scroll mode (audit_log_infinite)", () => {
  test("Initial /pages fires $page=1&$size=100; no .table-pagination UI; <InfiniteScroll> mounted", async ({
    page,
  }) => {
    // Capture every /pages on the audit_log api so we can pin the
    // first-paint wire shape (gotoTable awaits the response so we can't
    // wrap it in expectSinglePages).
    const captured: string[] = [];
    page.on("request", (req) => {
      if (/\/api\/db\/tables\/audit_log\/pages(\?|$)/u.test(req.url())) {
        captured.push(req.url());
      }
    });

    await gotoTable(page, "audit_log_infinite", { apiPath: "audit_log" });

    expect(captured.length).toBeGreaterThan(0);
    const initial = decodeURIComponent(captured[0]!);
    // limit=100 from tables.ts → $size=100. $page=1 since we're at the top.
    expect(initial).toContain("$size=100");
    expect(initial).toContain("$page=1");

    // No page-number UI on infinite-scroll mode (scenario 10.4 step 2).
    await expect(page.locator(".table-pagination")).toHaveCount(0);

    // `<AsTable>` mounts its scroll container — the listener target.
    await expect(page.locator(".as-table-scroll-container")).toHaveCount(1);

    // Pagination summary on the toolbar reads "100 of 5000" — first
    // block fully loaded, total seeded count visible. Confirms accumulator
    // is reading from `state.loadedCount` (not just total).
    await expect(page.locator(".as-page-pill")).toContainText("100 of");
  });

  test("Scroll near bottom fires next-block /pages with $page=2&$size=100; rows accumulate to 200; status indicator surfaces", async ({
    page,
  }) => {
    await gotoTable(page, "audit_log_infinite", { apiPath: "audit_log" });

    // Sanity-check infinite-scroll markers before the scroll.
    await expect(page.locator(".table-pagination")).toHaveCount(0);
    await expect(page.locator(".as-table-scroll-container")).toHaveCount(1);
    await expect(page.locator(".as-page-pill")).toContainText("100 of");

    // Scroll the table's scroll container to its bottom — `useInfiniteScroll`
    // fires `state.queryNext()` because the distance-from-bottom drops
    // below the configured 200 px threshold. Wrap in `expectSinglePages`
    // so a double-fire (e.g. from a stray bridge echo or a re-entrant
    // `queryNext`) would surface.
    const captured = await expectSinglePages(
      page,
      async () => {
        await scrollTableToBottom(page);
      },
      { table: "audit_log" },
    );

    const decoded = decodeURIComponent(captured.url);
    // Block-aligned next page — DEFAULT_BLOCK_SIZE = 100, results were
    // 100 rows long → next block is page 2 (rows 100..199) at $size=100.
    expect(decoded).toContain("$size=100");
    expect(decoded).toContain("$page=2");

    // Accumulator: results.length grew 100 → 200 (walkForwardAbsorb
    // appended rows 100..199 onto the existing 100 rows, no replacement).
    await expect(page.locator(".as-page-pill")).toContainText("200 of");

    // Page-number UI still absent after the follow-up fetch.
    await expect(page.locator(".table-pagination")).toHaveCount(0);
  });
});
