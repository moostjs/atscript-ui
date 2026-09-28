// Section 39 — Selection scope, `select-on="control"` and custom selection
// controls (0.1.142).
//
// Read-only batch — selection is client state; no mutation, no
// `resetSeed()`, no `serial`.
//
// Demo surfaces (`packages/vue-demo/src/client/domain/tables.ts`):
//   - `/orders-selection` — `<AsTable select="multi">` over the 15 seeded
//     orders, 10 per page, `selectionPersistence: "persist"`, a
//     `:row-selectable` that rejects cancelled orders, and a strip above
//     the table with a `Select on` <select> (starts at `control`) plus a
//     `Custom selection controls` checkbox that swaps in the
//     `#header-__select` / `#cell-__select` slots (`.demo-select-all`,
//     `.demo-select-row`).
//   - `/orders-window` — `<AsWindowTable select="multi">` over the same 15
//     orders (one block → the whole dataset loads), same predicate.
//   - `/audit_log` — `<AsWindowTable>` over ~3.7k rows (never fully loaded).
//
// Row ids / statuses are read from the DOM rather than hard-coded: batch F
// mutates orders earlier in the run. The ineligible rows are the ones the
// renderer stamps `data-selectable="false"`.

import { type Locator, type Page, expect, test } from "../fixtures";

import { clickPaginationPage, columnCellIndex, gotoTable, toggleSelectMode } from "../helpers";

// ---------------------------------------------------------------------
// File-local helpers.

const MAIN_TABLE = "table[data-as-main-table]";
const ROWS = "tbody tr:has(td)";
const SELECTED_COUNT = ".as-page-selection-count";

function mainTable(page: Page): Locator {
  return page.locator(MAIN_TABLE);
}

/** Default header select-all control. */
function headerCheckbox(page: Page): Locator {
  return mainTable(page).locator("thead th.as-th-select [role='checkbox']");
}

/** The row's default selection control. */
function rowCheckbox(row: Locator): Locator {
  return row.locator(".as-td-select .as-table-checkbox");
}

/** A data cell (never the selection cell) — the "row body" click target. */
async function rowBodyCell(table: Locator, rowIndex: number): Promise<Locator> {
  const idx = await columnCellIndex(table, "id");
  return table.locator(ROWS).nth(rowIndex).locator("td").nth(idx);
}

async function expectSelectedCount(page: Page, n: number): Promise<void> {
  if (n === 0) {
    await expect(page.locator(SELECTED_COUNT)).toHaveCount(0);
  } else {
    await expect(page.locator(SELECTED_COUNT)).toHaveText(`${n} selected`);
  }
}

/** Index of the first row that is (or is not) selectable. */
async function firstRowIndex(table: Locator, selectable: boolean): Promise<number> {
  const flags = await table
    .locator(ROWS)
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-selectable") !== "false"));
  const i = flags.indexOf(selectable);
  if (i < 0) throw new Error(`no ${selectable ? "selectable" : "ineligible"} row on this page`);
  return i;
}

/** Eligible / ineligible row counts of the rendered page. */
async function eligibility(table: Locator): Promise<{ eligible: number; ineligible: number }> {
  const total = await table.locator(ROWS).count();
  const ineligible = await table.locator(`${ROWS}[data-selectable='false']`).count();
  return { eligible: total - ineligible, ineligible };
}

async function gotoSelection(page: Page): Promise<Locator> {
  await gotoTable(page, "orders-selection", { apiPath: "orders" });
  const table = mainTable(page);
  await expect(table.locator(ROWS).first()).toBeVisible();
  return table;
}

// ---------------------------------------------------------------------

test.describe('Section 39.1 — select-on="control"', () => {
  test("row click only moves the active row; the checkbox toggles; Space / Enter still select", async ({
    page,
  }) => {
    const table = await gotoSelection(page);
    await expect(page.locator(".demo-select-on")).toHaveValue("control");
    const rows = table.locator(ROWS);
    const r0 = await firstRowIndex(table, true);
    const row0 = rows.nth(r0);

    // Row click → active, NOT selected.
    await (await rowBodyCell(table, r0)).click();
    await expect(row0).toHaveClass(/as-table-row-active/u);
    await expect(row0).toHaveAttribute("aria-selected", "false");
    await expectSelectedCount(page, 0);

    // Checkbox click → selected; exactly one toggle (no bubbled row toggle).
    await rowCheckbox(row0).click();
    await expect(row0).toHaveAttribute("aria-selected", "true");
    await expect(rowCheckbox(row0)).toHaveAttribute("aria-checked", "true");
    await expectSelectedCount(page, 1);

    // Clicking another row's body moves the active row and leaves the
    // selection alone.
    const next = await nextSelectable(table, r0);
    await (await rowBodyCell(table, next)).click();
    await expect(rows.nth(next)).toHaveClass(/as-table-row-active/u);
    await expect(row0).not.toHaveClass(/as-table-row-active/u);
    await expect(rows.nth(next)).toHaveAttribute("aria-selected", "false");
    await expect(row0).toHaveAttribute("aria-selected", "true");

    // Keyboard on the active row: Space toggles on, Enter toggles off.
    await page.keyboard.press("Space");
    await expect(rows.nth(next)).toHaveAttribute("aria-selected", "true");
    await expectSelectedCount(page, 2);
    await page.keyboard.press("Enter");
    await expect(rows.nth(next)).toHaveAttribute("aria-selected", "false");
    await expectSelectedCount(page, 1);

    // Space on a focused checkbox toggles that row.
    await rowCheckbox(rows.nth(next)).focus();
    await page.keyboard.press("Space");
    await expect(rows.nth(next)).toHaveAttribute("aria-selected", "true");
    await expectSelectedCount(page, 2);
  });

  test("a checkbox double-click toggles twice and does not reach the row", async ({ page }) => {
    const table = await gotoSelection(page);
    const r0 = await firstRowIndex(table, true);
    const row0 = table.locator(ROWS).nth(r0);
    const url = page.url();

    await rowCheckbox(row0).dblclick();
    // Two clicks → two toggles → back to unselected, and the dblclick never
    // reaches the row (no main action navigates away or opens a form).
    await expect(row0).toHaveAttribute("aria-selected", "false");
    await expectSelectedCount(page, 0);
    expect(page.url()).toBe(url);
    await expect(page.locator(".as-action-form-dialog-content")).toHaveCount(0);
  });

  test("an ineligible row's checkbox is disabled with its reason and never toggles", async ({
    page,
  }) => {
    const table = await gotoSelection(page);
    const bad = table.locator(ROWS).nth(await firstRowIndex(table, false));
    const cb = rowCheckbox(bad);
    await expect(cb).toHaveAttribute("aria-disabled", "true");
    await expect(cb).toHaveAttribute("title", "Cancelled orders cannot be picked");
    await expect(cb).toHaveAttribute("aria-label", "Select row, Cancelled orders cannot be picked");

    // `force`: Playwright treats `aria-disabled` as not clickable; the click
    // must still reach the control and be ignored by it.
    await cb.click({ force: true });
    await expect(bad).toHaveAttribute("aria-selected", "false");
    await expectSelectedCount(page, 0);
  });

  test('switching back to select-on="row": a row click toggles again', async ({ page }) => {
    const table = await gotoSelection(page);
    await page.locator(".demo-select-on").selectOption("row");
    const r0 = await firstRowIndex(table, true);
    const row0 = table.locator(ROWS).nth(r0);

    await (await rowBodyCell(table, r0)).click();
    await expect(row0).toHaveAttribute("aria-selected", "true");
    // And a checkbox click in `row` mode is still ONE toggle (bubbles to the row).
    await rowCheckbox(row0).click();
    await expect(row0).toHaveAttribute("aria-selected", "false");
    await expectSelectedCount(page, 0);
  });
});

/** Next selectable row index after `from` on the rendered page. */
async function nextSelectable(table: Locator, from: number): Promise<number> {
  const flags = await table
    .locator(ROWS)
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-selectable") !== "false"));
  const i = flags.findIndex((ok, idx) => ok && idx > from);
  if (i < 0) throw new Error(`no selectable row after ${from}`);
  return i;
}

test.describe("Section 39.2 — Header select-all acts on the loaded rows", () => {
  test("picks on another page survive select-all and deselect-all; header reads against loaded rows", async ({
    page,
  }) => {
    const table = await gotoSelection(page);
    const header = headerCheckbox(page);
    await expect(header).toHaveAttribute("aria-checked", "false");

    // Page 1: one pick → header `some`.
    const p1 = await eligibility(table);
    expect(p1.ineligible).toBeGreaterThan(0);
    const pick = await firstRowIndex(table, true);
    const pickedId = ((await (await rowBodyCell(table, pick)).textContent()) ?? "").trim();
    await rowCheckbox(table.locator(ROWS).nth(pick)).click();
    await expect(header).toHaveAttribute("aria-checked", "mixed");
    await expectSelectedCount(page, 1);

    // Page 2: the page-1 pick is not loaded → header reads `none`.
    await clickPaginationPage(page, 2);
    await expect(table.locator(ROWS).first()).not.toHaveAttribute("aria-selected", "true");
    await expect(header).toHaveAttribute("aria-checked", "false");
    await expectSelectedCount(page, 1);
    const p2 = await eligibility(table);

    // Select-all adds page 2's ELIGIBLE rows; the page-1 pick stays.
    await header.click();
    await expect(header).toHaveAttribute("aria-checked", "true");
    await expectSelectedCount(page, 1 + p2.eligible);
    await expect(table.locator(`${ROWS}[aria-selected='true']`)).toHaveCount(p2.eligible);
    await expect(
      table.locator(`${ROWS}[data-selectable='false'][aria-selected='true']`),
    ).toHaveCount(0);

    // Deselect-all removes page 2's rows only.
    await header.click();
    await expect(header).toHaveAttribute("aria-checked", "false");
    await expectSelectedCount(page, 1);
    await expect(table.locator(`${ROWS}[aria-selected='true']`)).toHaveCount(0);

    // Select page 2 again, then back to page 1: the pick is still there and
    // the header reads `some` against page 1 alone.
    await header.click();
    await expectSelectedCount(page, 1 + p2.eligible);
    await clickPaginationPage(page, 1);
    const idIdx = await columnCellIndex(table, "id");
    const pickedRow = table
      .locator(ROWS)
      .filter({ has: page.locator(`xpath=./td[${idIdx + 1}][normalize-space(.)="${pickedId}"]`) });
    await expect(pickedRow).toHaveAttribute("aria-selected", "true");
    await expect(header).toHaveAttribute("aria-checked", "mixed");

    // `some` → click adds the rest of page 1 (eligible only) → `all`.
    await header.click();
    await expect(header).toHaveAttribute("aria-checked", "true");
    await expectSelectedCount(page, p1.eligible + p2.eligible);
    await expect(
      table.locator(`${ROWS}[data-selectable='false'][aria-selected='true']`),
    ).toHaveCount(0);

    // `all` → click removes page 1's rows; page 2's stay.
    await header.click();
    await expect(header).toHaveAttribute("aria-checked", "false");
    await expectSelectedCount(page, p2.eligible);

    // The toolbar Clear → `state.clearSelection()` empties every page.
    await page.locator(".as-page-toolbar-btn").filter({ hasText: "Clear" }).click();
    await expectSelectedCount(page, 0);
    await clickPaginationPage(page, 2);
    await expect(table.locator(`${ROWS}[aria-selected='true']`)).toHaveCount(0);
    await expect(header).toHaveAttribute("aria-checked", "false");
  });

  test("select-all never adds a non-selectable row; the header reads `all` without them", async ({
    page,
  }) => {
    const table = await gotoSelection(page);
    const { eligible, ineligible } = await eligibility(table);
    expect(ineligible).toBeGreaterThan(0);

    const header = headerCheckbox(page);
    await header.click();
    await expect(header).toHaveAttribute("aria-checked", "true");
    await expectSelectedCount(page, eligible);
    await expect(table.locator(`${ROWS}[data-selectable='false']`)).toHaveCount(ineligible);
    await expect(
      table.locator(`${ROWS}[data-selectable='false'][aria-selected='true']`),
    ).toHaveCount(0);

    // Keyboard on the header: Space deselects through the same path.
    await header.focus();
    await page.keyboard.press("Space");
    await expect(header).toHaveAttribute("aria-checked", "false");
    await expectSelectedCount(page, 0);
  });
});

test.describe("Section 39.3 — Custom selection controls (#header-__select / #cell-__select)", () => {
  test("slots replace the default controls and their toggle() drives the selection", async ({
    page,
  }) => {
    const table = await gotoSelection(page);
    await page.locator(".demo-custom-select").check();

    // Default controls gone, custom ones rendered — one per row.
    await expect(table.locator(".as-table-checkbox")).toHaveCount(0);
    const rowCount = await table.locator(ROWS).count();
    await expect(table.locator(`${ROWS} .as-td-select .demo-select-row`)).toHaveCount(rowCount);
    await expect(table.locator(ROWS).first().locator(".demo-select-row")).toHaveAttribute(
      "data-index",
      "0",
    );
    const allBtn = table.locator("thead th.as-th-select .demo-select-all");
    await expect(allBtn).toHaveAttribute("data-state", "none");
    await expect(allBtn).toHaveText("0");

    // Cell toggle (select-on="control"): one toggle per click.
    const r0 = await firstRowIndex(table, true);
    const row0 = table.locator(ROWS).nth(r0);
    const btn0 = row0.locator(".demo-select-row");
    await btn0.click();
    await expect(btn0).toHaveAttribute("aria-checked", "true");
    await expect(row0).toHaveAttribute("aria-selected", "true");
    // toggle() also makes the row active.
    await expect(row0).toHaveClass(/as-table-row-active/u);
    await expect(allBtn).toHaveAttribute("data-state", "some");
    await expect(allBtn).toHaveText("1");

    // Same with select-on="row": `@click.stop` keeps it to ONE toggle.
    await page.locator(".demo-select-on").selectOption("row");
    await btn0.click();
    await expect(btn0).toHaveAttribute("aria-checked", "false");
    await expect(allBtn).toHaveAttribute("data-state", "none");
    await btn0.click();
    await expect(btn0).toHaveAttribute("aria-checked", "true");

    // Ineligible row: the slot gets `selectable: false` + the reason.
    const bad = table.locator(ROWS).nth(await firstRowIndex(table, false));
    await expect(bad.locator(".demo-select-row")).toBeDisabled();
    await expect(bad.locator(".demo-select-row")).toHaveAttribute(
      "title",
      "Cancelled orders cannot be picked",
    );

    // Header toggle(): `some` → all eligible loaded rows; then `all` → none.
    const { eligible } = await eligibility(table);
    await allBtn.click();
    await expect(allBtn).toHaveAttribute("data-state", "all");
    await expect(allBtn).toHaveText(String(eligible));
    await expect(table.locator(`${ROWS}[aria-selected='true']`)).toHaveCount(eligible);
    await allBtn.click();
    await expect(allBtn).toHaveAttribute("data-state", "none");
    await expect(allBtn).toHaveText("0");
    await expectSelectedCount(page, 0);
  });
});

test.describe("Section 39.4 — AsWindowTable header checkbox needs every row loaded", () => {
  test("/orders-window (whole dataset loaded): header select-all works and skips ineligible rows", async ({
    page,
  }) => {
    // Tall viewport so the pool renders all 15 orders.
    await page.setViewportSize({ width: 1280, height: 1400 });
    await gotoTable(page, "orders-window", { apiPath: "orders" });
    const table = mainTable(page);
    await expect(page.locator(".as-page-pill")).toContainText("15 of 15");
    await expect(table.locator(ROWS)).toHaveCount(15);

    const header = headerCheckbox(page);
    await expect(header).toHaveAttribute("aria-checked", "false");
    const { eligible, ineligible } = await eligibility(table);
    expect(ineligible).toBeGreaterThan(0);

    await header.click();
    await expect(header).toHaveAttribute("aria-checked", "true");
    await expectSelectedCount(page, eligible);
    await expect(
      table.locator(`${ROWS}[data-selectable='false'][aria-selected='true']`),
    ).toHaveCount(0);

    // One row off → `some`; click → adds it back → `all`.
    const r0 = await firstRowIndex(table, true);
    await rowCheckbox(table.locator(ROWS).nth(r0)).click();
    await expect(header).toHaveAttribute("aria-checked", "mixed");
    await header.click();
    await expect(header).toHaveAttribute("aria-checked", "true");
    await expectSelectedCount(page, eligible);

    await header.click();
    await expect(header).toHaveAttribute("aria-checked", "false");
    await expectSelectedCount(page, 0);
  });

  test("/audit_log (partially loaded): the select column has no header checkbox", async ({
    page,
  }) => {
    await gotoTable(page, "audit_log");
    await toggleSelectMode(page);
    const th = mainTable(page).locator("thead th.as-th-select");
    await expect(th).toHaveCount(1);
    await expect(mainTable(page).locator(`${ROWS} .as-td-select`).first()).toBeVisible();
    await expect(th.locator("[role='checkbox']")).toHaveCount(0);

    // Row picks still work without it.
    await rowCheckbox(mainTable(page).locator(ROWS).first()).click();
    await expectSelectedCount(page, 1);
    await expect(th.locator("[role='checkbox']")).toHaveCount(0);
  });
});
