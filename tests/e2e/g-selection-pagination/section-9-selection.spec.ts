// Section 9 — Selection (batch G).
//
// Read-only batch — toggles select mode and clicks rows to verify the
// selection contract. No mutation, no `resetSeed()`, no `serial`.
//
// Targets `/orders` to dodge mutation drift from batch F (which evolves
// `/users` rows) when running the full suite. Orders has `actionsColumn:
// "merge-select"` — flipping select mode hides the actions column entirely
// and surfaces the leading checkbox column instead.
//
// Selectors discovered locally (verified against vue-table source):
//   - Selected-row marker: `<tr aria-selected="true">` (set by
//     `ariaSelectedFor()` in `internal/as-table-base.vue`). The checkbox
//     itself also gets `.as-table-checkbox-checked` — both surfaces are
//     redundant; we assert the row-level ARIA attr since that's the
//     stable a11y contract.
//   - Header tri-state: `.as-table-checkbox-indeterminate` for "some" via
//     class binding in `internal/as-table-header.vue` (lines 133–134).
//   - Bulk-action surface: `<AsTableActions>` re-evaluates `level` from
//     `selectedCount`. /orders' `cancel` action is `@DbActionIDs(level:
//     "rows")` — surfaces in the toolbar at selectedCount ≥ 2 (Cancel
//     button or in the More menu).
//
// 9.2 — selection trim verification: we read row ids from the first column
// (`#`, `data-column-path="id"`). The pre-rendered Standard Status pill
// auto-renders empty; clicking into it fires the inline-dropdown fast-path
// (matching `b-filtering/section-4-pill-input.spec.ts`).

import { type Locator, type Page, expect, test } from "@playwright/test";

import { expectSinglePages, gotoTable, pillByLabel } from "../helpers";

// ---------------------------------------------------------------------
// Inline helpers — not promoted to the helper barrel (chat-RFC required).

const SELECT_TOGGLE = ".as-page-title-toggle";
const SELECT_TH = "thead th.as-th-select";

async function toggleSelectMode(page: Page): Promise<void> {
  await page.locator(SELECT_TOGGLE).first().click();
}

/** cellIndex of `<thead th[data-column-path]>` for `column`. */
async function columnIndex(table: Locator, column: string): Promise<number> {
  const th = table.locator(`thead th[data-column-path="${column}"]`);
  return th.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
}

/**
 * Click the `.as-table-checkbox` inside the row at `rowIndex` (0-based)
 * within the table's tbody. Click the checkbox cell explicitly (not the
 * row body) to keep the gesture pointed at the checkbox surface — keeps
 * the assertion on the checkbox→toggle path rather than the row→toggle
 * shortcut documented in `as-table-base.vue` line 155.
 */
async function selectRowByIndex(table: Locator, rowIndex: number): Promise<void> {
  const row = table.locator("tbody tr:has(td)").nth(rowIndex);
  await row.locator(".as-td-select .as-table-checkbox").click();
}

/** Read trimmed text of the data-column-path cell at `rowIndex`. */
async function readCellText(table: Locator, rowIndex: number, column: string): Promise<string> {
  const idx = await columnIndex(table, column);
  const row = table.locator("tbody tr:has(td)").nth(rowIndex);
  return ((await row.locator("td").nth(idx).textContent()) ?? "").trim();
}

/**
 * Read trimmed text of the `column` cell for every row currently
 * displaying as `aria-selected="true"`. Drives 9.2's "which ids
 * survived the trim" assertion.
 */
async function selectedRowIds(table: Locator, column: string): Promise<string[]> {
  const idx = await columnIndex(table, column);
  const rows = table.locator("tbody tr:has(td)[aria-selected='true']");
  const out: string[] = [];
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).locator("td").nth(idx).textContent();
    out.push((text ?? "").trim());
  }
  return out;
}

// ---------------------------------------------------------------------

test.describe("Section 9 — Selection", () => {
  // -------------------------------------------------------------------
  // 9.1 — Toggle multi-select on /orders

  test("9.1: Toggle multi-select — column appears, rows toggle, header indeterminate, toggle-off clears", async ({
    page,
  }) => {
    await gotoTable(page, "orders");

    const table = page.locator("table[data-as-main-table]");

    await expect(page.locator(SELECT_TH)).toHaveCount(0);

    await toggleSelectMode(page);
    await expect(page.locator(SELECT_TH)).toHaveCount(1);
    await expect(table.locator("tbody tr:has(td) td.as-td-select").first()).toHaveCount(1);

    // No row selected yet — header checkbox carries neither
    // -checked nor -indeterminate. Header is the FIRST `.as-table-checkbox`
    // (inside thead `<th>`), distinct from row-body checkboxes.
    const headerCheckbox = table.locator("thead .as-table-checkbox").first();
    await expect(headerCheckbox).not.toHaveClass(/as-table-checkbox-checked/u);
    await expect(headerCheckbox).not.toHaveClass(/as-table-checkbox-indeterminate/u);

    // Click 2 row checkboxes via the cell (rows 0 and 2 — keeping a gap
    // exercises the partial-select header state without "select-all"
    // tipping over).
    await selectRowByIndex(table, 0);
    await selectRowByIndex(table, 2);

    // Each clicked row carries `aria-selected="true"`. Other rows still
    // carry `aria-selected="false"` (set unconditionally in select mode).
    const selectedRows = table.locator("tbody tr:has(td)[aria-selected='true']");
    await expect(selectedRows).toHaveCount(2);

    // Both `aria-selected` AND `.as-table-checkbox-checked` are public
    // contracts — pin the checkbox-class surface too.
    await expect(selectedRows.locator(".as-td-select .as-table-checkbox-checked")).toHaveCount(2);

    // Header now `indeterminate` (some, not all). The class flips off
    // `-checked` and on `-indeterminate` per the binding at
    // `internal/as-table-header.vue` line 134.
    await expect(headerCheckbox).toHaveClass(/as-table-checkbox-indeterminate/u);
    await expect(headerCheckbox).not.toHaveClass(/as-table-checkbox-checked/u);

    // Bulk-action enable signal: with 2 selected, /orders' `cancel`
    // action is rows-level (`@DbActionIDs`) and must surface in the
    // toolbar action group. The toolbar exposes the action as either a
    // primary `.as-table-actions-btn` button OR a `.as-table-actions-menu-item`
    // inside the More menu — check both surfaces by name without
    // committing to a placement.
    const cancelBtn = page.locator(".as-table-actions-btn").filter({ hasText: "Cancel" });
    const moreBtn = page.locator(".as-table-actions-more");
    const cancelBtnCount = await cancelBtn.count();
    if (cancelBtnCount > 0) {
      await expect(cancelBtn.first()).toBeEnabled();
    } else {
      // Action lives in More — open it and verify the row item exists.
      await expect(moreBtn).toHaveCount(1);
      await moreBtn.click();
      const menu = page.locator(".as-table-actions-menu");
      await expect(menu).toBeVisible();
      await expect(
        menu.locator(".as-table-actions-menu-item").filter({ hasText: "Cancel" }),
      ).toHaveCount(1);
      await page.keyboard.press("Escape");
    }

    // Selection summary badge in the toolbar (`<span class="as-page-selection-summary">`).
    await expect(page.locator(".as-page-selection-count")).toHaveText("2 selected");

    // Toggle select-mode off → checkbox column hides AND `selectedRows`
    // is auto-cleared. `useSelectModeReset` (called from `<AsTable>` /
    // `<AsWindowTable>`) drops the selection on the `multi → none`
    // transition. The selection-summary span unmounts on count=0.
    await toggleSelectMode(page);
    await expect(page.locator(SELECT_TH)).toHaveCount(0);
    await expect(page.locator(".as-page-selection-count")).toHaveCount(0);

    // Re-enable — checkbox column reappears, no rows pre-selected.
    await toggleSelectMode(page);
    await expect(page.locator(SELECT_TH)).toHaveCount(1);
    await expect(table.locator("tbody tr:has(td)[aria-selected='true']")).toHaveCount(0);
    await expect(table.locator(".as-td-select .as-table-checkbox-checked")).toHaveCount(0);
  });

  // -------------------------------------------------------------------
  // 9.2 — Selection trim mode (default `selectionPersistence: "trim"`)

  test("9.2: Selection trim — apply filter that excludes 2 of 3 selected rows; only survivor remains selected", async ({
    page,
  }) => {
    await gotoTable(page, "orders");

    // Scope to the main table — the inline filter-dropdown opens its own
    // `<AsTableBase>` for value-help (also `<table class="as-table">`),
    // so the data-attr disambiguates after the dropdown opens.
    const table = page.locator("table[data-as-main-table]");

    await toggleSelectMode(page);

    // Capture the status of the first 3 visible rows BEFORE selecting,
    // so we can pick a filter that surgically excludes 2 of them.
    // Orders rotate through 5 statuses (`statuses[i % 5]` in seed.ts) —
    // {pending, processing, shipped, delivered, cancelled}. Rows 0..2
    // therefore carry distinct statuses, each unique on this slice.
    const targets: { id: string; status: string }[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await readCellText(table, i, "id");
      const status = await readCellText(table, i, "status");
      expect(id).not.toBe("");
      expect(status).not.toBe("");
      targets.push({ id, status });
    }

    // Pick row 0's status as the surviving filter — that excludes rows 1 + 2.
    const survivorStatus = targets[0]!.status;
    const expectedSurvivorIds = targets.filter((t) => t.status === survivorStatus).map((t) => t.id);
    expect(expectedSurvivorIds).toContain(targets[0]!.id);
    // Sanity: we actually exclude 2 of the 3.
    expect(expectedSurvivorIds.length).toBeLessThan(3);

    // Select the 3 rows.
    await selectRowByIndex(table, 0);
    await selectRowByIndex(table, 1);
    await selectRowByIndex(table, 2);
    await expect(table.locator("tbody tr:has(td)[aria-selected='true']")).toHaveCount(3);
    await expect(page.locator(".as-page-selection-count")).toHaveText("3 selected");

    // Apply the Status filter via the auto-rendered Standard pill —
    // inline dropdown fast path (matches `b-filtering` 4.12 pattern).
    const statusPill = pillByLabel(page, "Status");
    await expect(statusPill).toHaveCount(1);

    await expectSinglePages(
      page,
      async () => {
        await statusPill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await dropdown
          .locator("tbody tr td", { hasText: new RegExp(`^${survivorStatus}$`, "u") })
          .first()
          .click();
      },
      { table: "orders" },
    );

    // Close the inline-dropdown popover before reading survivors. The
    // `table[data-as-main-table]` locator already disambiguates from
    // the value-help's `<AsTableBase>` (also `<table class="as-table">`),
    // but closing the popover keeps the screen clean for subsequent
    // assertions.
    await page.keyboard.press("Escape");
    await expect(page.locator(".as-filter-field-dropdown")).toHaveCount(0);

    // After refetch, only the surviving id is selected. Trim semantics:
    // server returns rows matching the filter; ids whose pk no longer
    // appears in the result drop out of `selectedRows`.
    const survivors = await selectedRowIds(table, "id");
    expect(new Set(survivors)).toEqual(new Set(expectedSurvivorIds));

    // Toolbar selection-count reflects the trim — `selectedCount.value`
    // collapsed from 3 → expected length.
    await expect(page.locator(".as-page-selection-count")).toHaveText(
      `${expectedSurvivorIds.length} selected`,
    );
  });
});
