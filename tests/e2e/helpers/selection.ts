import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Click the page-title toggle (`.as-page-title-toggle`) to flip multi-select
 * mode on/off. The toggle is the FIRST `.as-page-title-toggle` in the DOM
 * (TablePage may render additional toggles on Section 18 mobile branches).
 */
export async function toggleSelectMode(page: Page): Promise<void> {
  await page.locator(".as-page-title-toggle").first().click();
}

/**
 * Click the `.as-table-checkbox` inside the row at `rowIndex` (0-based)
 * within the table's tbody. We click the checkbox cell explicitly (not the
 * row body) to keep the gesture pointed at the checkbox surface — the
 * row→toggle shortcut documented in `as-table-base.vue` is not exercised
 * here.
 */
export async function selectRowByIndex(table: Locator, rowIndex: number): Promise<void> {
  const row = table.locator("tbody tr:has(td)").nth(rowIndex);
  await row.locator(".as-td-select .as-table-checkbox").click();
}

/**
 * Click the toolbar `Clear` button + exit multi-select mode. Use to reset
 * selection state between sub-tests in a serial mutation chain.
 */
export async function clearSelection(page: Page): Promise<void> {
  await page.locator(".as-page-toolbar-btn").filter({ hasText: "Clear" }).click();
  await toggleSelectMode(page);
}

/**
 * Read trimmed text of the `column` cell for every row currently displaying
 * `aria-selected="true"`. Drives 9.2's "which ids survived the trim"
 * assertion.
 */
export async function selectedRowCellTexts(table: Locator, columnPath: string): Promise<string[]> {
  const th = table.locator(`thead th[data-column-path="${columnPath}"]`);
  await expect(th).toHaveCount(1);
  const idx = await th.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
  const rows = table.locator("tbody tr:has(td)[aria-selected='true']");
  const count = await rows.count();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).locator("td").nth(idx).textContent();
    out.push((text ?? "").trim());
  }
  return out;
}
