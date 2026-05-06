import { type Locator, type Page } from "@playwright/test";

/**
 * Click a column header's inner button to open the per-column dropdown menu.
 * Reka's `DropdownMenuTrigger as-child` slot binds the open handler onto
 * `<button class="as-th-btn">`; the `<th>` itself is the drag-reorder
 * surface so we MUST click the inner button (not the `<th>`).
 *
 * Scoped to `table[data-as-main-table]` so the helper still works when a
 * filter-field value-help dropdown (`<AsTableBase>` mounts a secondary
 * `table.as-table` inside `.as-filter-field-dropdown`) is open and would
 * otherwise be selected by `table.as-table.first()`.
 */
export async function clickColumnHeader(page: Page, columnPath: string): Promise<void> {
  await page
    .locator(`table[data-as-main-table] thead th[data-column-path="${columnPath}"] .as-th-btn`)
    .click();
}

/**
 * Pick `Ascending` / `Descending` from the open column-menu. Reka portals
 * the menu to `<body>`, so we reach it via `page.locator(...)` rather than
 * relative to the table.
 */
export async function pickSort(page: Page, direction: "asc" | "desc"): Promise<void> {
  const label = direction === "asc" ? "Ascending" : "Descending";
  await page.locator(".as-column-menu-content .as-column-menu-item", { hasText: label }).click();
}

/**
 * Locator for the sort indicator on a column header. `i-as-arrow-up` for
 * ascending, `i-as-arrow-down` for descending. Resolves against the main
 * table (`table[data-as-main-table]`) so it's safe in pages with multiple
 * tables (e.g. `<AsFilterValueHelp>` mounting a secondary table inside a
 * filter dialog).
 */
export function sortIndicator(page: Page, columnPath: string, dir: "asc" | "desc"): Locator {
  const cls = dir === "asc" ? "i-as-arrow-up" : "i-as-arrow-down";
  return page.locator(
    `table[data-as-main-table] thead th[data-column-path='${columnPath}'] .as-th-sort.${cls}`,
  );
}
