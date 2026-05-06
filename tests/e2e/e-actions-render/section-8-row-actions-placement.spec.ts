// Section 8.13 — Row-actions column placement: `last` / `first` /
// `merge-select`.
//
// Read-only batch. The synthesised `__actions` column position is
// controlled per-table via the consumer's `:row-actions-column` prop:
//   - /users    → `last`        (rightmost; checkbox column joins as first
//                                 in `select="multi"`)
//   - /products → `first`       (prepended; `select="multi"` injects the
//                                 checkbox in front of the actions column)
//   - /orders   → `merge-select` (single leading column doubles as actions
//                                 in `select="none"`; flips to checkbox
//                                 ONLY in `select="multi"`, hiding the
//                                 actions column entirely)
//
// Selectors:
//   - actions column header — `<th data-column-path="__actions"
//     class="as-th-fixed" aria-label="Actions">`. The synth column is
//     fixed so it carries `as-th-fixed`.
//   - select-checkbox header — `<th class="as-th-select">`. Only renders
//     when `select === "multi"`.
//
// Toggling select-mode is done via the page-title toggle button
// (`.as-page-title-toggle` in `TableToolbar.vue`).

import { type Page, expect, test } from "@playwright/test";

import { gotoTable, toggleSelectMode } from "../helpers";

const ACTIONS_TH = 'thead th[data-column-path="__actions"]';
const SELECT_TH = "thead th.as-th-select";

/**
 * Read every header cell's identity in DOM order. The trailing
 * `<th class="as-th-filler">` is dropped — it's a layout filler that
 * absorbs leftover horizontal space and doesn't belong to the
 * placement contract under test. Returned tokens:
 *   - `__actions` for the synth actions column
 *   - `__select` for the leading select-checkbox column
 *   - `<column-path>` for declared data columns (via data-column-path)
 */
async function readHeaderOrder(page: Page): Promise<string[]> {
  const ths = page.locator("table.as-table thead th");
  return await ths.evaluateAll((els) =>
    els
      .filter((el) => !el.classList.contains("as-th-filler"))
      .map((el) => {
        if (el.classList.contains("as-th-select")) return "__select";
        const path = el.getAttribute("data-column-path");
        return path ?? "__unknown";
      }),
  );
}

test.describe("Section 8.13 — Row-actions column placement", () => {
  test("`last` placement (/users): actions column is rightmost; multi-select prepends checkbox", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    // select="none" — actions column trails the data columns.
    let order = await readHeaderOrder(page);
    expect(order[order.length - 1]).toBe("__actions");
    expect(order.includes("__select")).toBe(false);
    // Header carries the framework's `aria-label="Actions"`.
    const actionsTh = page.locator(ACTIONS_TH).first();
    await expect(actionsTh).toHaveAttribute("aria-label", "Actions");
    await expect(actionsTh).toHaveClass(/as-th-fixed/u);

    // Flip to select="multi" — checkbox column appears as the leading
    // column; actions column STAYS at the right edge.
    await toggleSelectMode(page);
    await expect(page.locator(SELECT_TH)).toHaveCount(1);
    order = await readHeaderOrder(page);
    expect(order[0]).toBe("__select");
    expect(order[order.length - 1]).toBe("__actions");
  });

  test("`first` placement (/products): actions column leads; multi-select inserts checkbox before it", async ({
    page,
  }) => {
    await gotoTable(page, "products");

    // select="none" — actions column is the very first.
    let order = await readHeaderOrder(page);
    expect(order[0]).toBe("__actions");
    expect(order.includes("__select")).toBe(false);

    // select="multi" — checkbox lands FIRST, actions stays at index 1
    // (two leading columns side-by-side per scenario doc).
    await toggleSelectMode(page);
    await expect(page.locator(SELECT_TH)).toHaveCount(1);
    order = await readHeaderOrder(page);
    expect(order[0]).toBe("__select");
    expect(order[1]).toBe("__actions");
  });

  test("`merge-select` placement (/orders): leading column hosts actions in `none`; checkbox replaces it (actions hidden) in `multi`", async ({
    page,
  }) => {
    await gotoTable(page, "orders");

    // select="none" — single leading column = actions; no separate
    // select-checkbox column.
    let order = await readHeaderOrder(page);
    expect(order[0]).toBe("__actions");
    expect(order.includes("__select")).toBe(false);

    // Flip to select="multi" — checkbox column owns the gutter; actions
    // column is NOT rendered (the merge-select contract).
    await toggleSelectMode(page);
    await expect(page.locator(SELECT_TH)).toHaveCount(1);
    await expect(page.locator(ACTIONS_TH)).toHaveCount(0);
    order = await readHeaderOrder(page);
    expect(order[0]).toBe("__select");
    expect(order.includes("__actions")).toBe(false);

    // Body row absent the `as-row-actions` cell — the merge contract
    // hides the cell as well, not just the header.
    const firstRow = page.locator("table.as-table tbody tr").first();
    await expect(firstRow.locator("td.as-row-actions")).toHaveCount(0);

    // Flip back to select="none" — actions column reappears at index 0.
    await toggleSelectMode(page);
    await expect(page.locator(SELECT_TH)).toHaveCount(0);
    await expect(page.locator(ACTIONS_TH)).toHaveCount(1);
    order = await readHeaderOrder(page);
    expect(order[0]).toBe("__actions");
  });
});
