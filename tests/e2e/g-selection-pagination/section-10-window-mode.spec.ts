// Section 10.3 — Window-mode infinite scroll on `/audit_log` (batch G).
//
// Read-only batch. The window-mode renderer is `<AsWindowTable>` (selected
// when `tableMeta.kind === "window"`); seed config wires audit_log with
// `kind: "window", limit: 100` (`packages/vue-demo/src/client/domain/tables.ts`
// line 137). Window fetcher uses `DEFAULT_BLOCK_SIZE = 100` —
// `pages?$page=N&$size=100` per block (`vue-table/src/composables/use-table-state.ts`
// line 68).
//
// **Scroll mechanics differ from `<AsTable>`.** `<AsWindowTable>` does NOT
// mount a `[data-virtual-scroll]` container — that selector is only used
// by the standalone `<AsTable>` renderer's TanStack-Virtual virtualizer.
// Window mode uses synthesised wheel events on `.as-window-row-pool` to
// advance `topIndex` (see `as-window-table-base.vue` line 355's
// `@wheel="onWheel"`). To trigger a follow-up `/pages` we dispatch wheel
// events directly on the row pool — same mechanism as the existing 2.6
// test in `a-cells/section-2-cell-rendering.spec.ts`.
//
// The existing `a-cells/section-2-cell-rendering.spec.ts` 2.6 test already
// covers the broad strokes (window pool renders, no `Rows per page` UI,
// scroll triggers a follow-up `/pages`). This batch complements 2.6 with
// the **wire-shape** assertions the prompt asked for: pin `$page` /
// `$size` exactly on both initial and follow-up fetches, and assert the
// no-page-number-UI contract via `.table-pagination`.

import { type Page, expect, test } from "../fixtures";

import { expectSinglePages, gotoTable } from "../helpers";

// ---------------------------------------------------------------------
// Inline helpers — not promoted to the helper barrel (chat-RFC required).

/**
 * Dispatch `n` wheel-down events on `.as-window-row-pool` synchronously
 * inside the page so onWheel batches them in a single rAF — same trick
 * as 2.6 in `a-cells/section-2-cell-rendering.spec.ts` (per-event awaits
 * land on different rAF cycles and the watcher overshoots, so we batch
 * inside `page.evaluate`). Range that yields ONE follow-up fetch:
 * topIndex ∈ [1, 100] with viewport ≤ blockSize. We use 80 wheel ticks
 * to land in the STEADY-fetch zone.
 */
async function wheelRowPoolDown(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => {
    const el = document.querySelector(".as-window-row-pool");
    if (!el) throw new Error(".as-window-row-pool not found");
    for (let i = 0; i < n; i++) {
      el.dispatchEvent(new WheelEvent("wheel", { deltaY: 50, bubbles: true, cancelable: true }));
    }
  }, ticks);
}

// ---------------------------------------------------------------------

test.describe("Section 10.3 — Window-mode infinite scroll (audit_log)", () => {
  test("Initial /pages fires $page=1&$size=100 (block size, not default 25)", async ({ page }) => {
    // Capture the very first /pages request fired by audit_log so we
    // can pin its wire shape. We can't wrap `gotoTable` in
    // `expectSinglePages` because the helper itself awaits the
    // response — instead we listen via `page.on("request", ...)` and
    // assert against the captured URL.
    const captured: string[] = [];
    page.on("request", (req) => {
      if (/\/api\/db\/tables\/audit_log\/pages(\?|$)/u.test(req.url())) {
        captured.push(req.url());
      }
    });

    await gotoTable(page, "audit_log");

    // First request observed.
    expect(captured.length).toBeGreaterThan(0);
    const initial = decodeURIComponent(captured[0]!);
    // Window block-aligned wire shape — DEFAULT_BLOCK_SIZE is 100 (NOT
    // the default 25 page size). $page=1 since we're at the top.
    expect(initial).toContain("$size=100");
    expect(initial).toContain("$page=1");

    // No page-number UI on window mode — scenario 10.3 step 2.
    await expect(page.locator(".table-pagination")).toHaveCount(0);
    // Window scroll surface is mounted (.as-window-row-pool, not
    // [data-virtual-scroll] — that's <AsTable>'s virtualizer).
    await expect(page.locator(".as-window-row-pool")).toHaveCount(1);
  });

  test("Wheel-end on row pool fires next-block /pages with $size=100; rows append (no page-number UI)", async ({
    page,
  }) => {
    await gotoTable(page, "audit_log");

    // Sanity-check window-mode markers before the scroll.
    await expect(page.locator(".table-pagination")).toHaveCount(0);
    await expect(page.locator(".as-window-row-pool")).toHaveCount(1);

    // Wheel-down on the row pool — the onWheel handler advances
    // `topIndex` and the fetcher's `loadRange` issues exactly one
    // `/pages` for the next block once topIndex crosses into the
    // uncached region.
    const pool = page.locator(".as-window-row-pool");
    await pool.hover();
    const captured = await expectSinglePages(
      page,
      async () => {
        await wheelRowPoolDown(page, 80);
      },
      { table: "audit_log" },
    );
    const decoded = decodeURIComponent(captured.url);
    // Block-aligned: next block is page 2 (rows 100..199) at $size=100.
    expect(decoded).toContain("$size=100");
    expect(decoded).toContain("$page=2");

    // Page-number UI still absent after the follow-up fetch.
    await expect(page.locator(".table-pagination")).toHaveCount(0);
  });
});
