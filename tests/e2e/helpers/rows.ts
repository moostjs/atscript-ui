import { expect, type Locator } from "@playwright/test";

/**
 * `cellIndex` of `<thead th[data-column-path="<path>"]>` for the first
 * matching column header. Used by callers that need to locate cells by
 * column path under the assumption columns may have shifted via reorder
 * / hide-show but `data-column-path` is stable.
 *
 * Asserts exactly one matching header exists — fails loudly if the column
 * is missing or duplicated (renderer bug).
 */
export async function columnCellIndex(table: Locator, columnPath: string): Promise<number> {
  const th = table.locator(`thead th[data-column-path="${columnPath}"]`);
  await expect(th).toHaveCount(1);
  return await th.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
}

/**
 * Locator for a tbody row whose `td[columnIndex+1]` cell text (normalized,
 * exact match) equals `text`. Useful when you have the column index in hand
 * (e.g. via `columnCellIndex`) and want to find a row by a known cell value.
 *
 * Returns the unfiltered Locator — caller chooses `.first()` / `.nth(...)`
 * if multiple rows could match.
 */
export function rowByCellText(table: Locator, columnIndex: number, text: string): Locator {
  return table.locator("tbody tr").filter({
    has: table.page().locator(`xpath=./td[${columnIndex + 1}][normalize-space(.)="${text}"]`),
  });
}

/**
 * Convenience for `/users` row lookups by `username`. Resolves the
 * `username` column index, finds the row whose username cell matches
 * `name`, asserts a single match, returns the row Locator.
 *
 * Other "by-preferred-id" lookups should compose `columnCellIndex` +
 * `rowByCellText` directly rather than adding more specializations to
 * the barrel.
 */
export async function userRowByName(table: Locator, name: string): Promise<Locator> {
  const idx = await columnCellIndex(table, "username");
  const row = rowByCellText(table, idx, name).first();
  await expect(row).toHaveCount(1);
  return row;
}

/**
 * Trimmed text of every element matched by `loc`. `evaluateAll` runs in a
 * single browser round-trip so this stays fast for large lists.
 */
export async function texts(loc: Locator): Promise<string[]> {
  return loc.evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
}
