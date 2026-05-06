import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Locator for a filter pill by its column label (exact match). Pills carry
 * `<label class="as-filter-field-label">{{ column.label }}</label>` inside
 * a `.as-filter-field` wrapper.
 */
export function pillByLabel(page: Page, label: string): Locator {
  return page
    .locator(".as-filter-field")
    .filter({ has: page.locator(`label.as-filter-field-label:text-is("${label}")`) });
}

/**
 * Add a filter pill via the toolbar Filters dialog. Idempotent — short-
 * circuits with the existing locator when the named pill already exists
 * (the Standard preset can auto-render pills on first paint, e.g. /users
 * → Status + Role).
 */
export async function addFilterPill(page: Page, label: string): Promise<Locator> {
  const pill = pillByLabel(page, label);
  if ((await pill.count()) === 1) return pill;
  await page.getByTitle("Filters", { exact: true }).click();
  const dialog = page.locator(".as-config-dialog-content");
  await expect(dialog).toBeVisible();
  const row = dialog.locator(
    `[role='tabpanel'][data-state='active'] .as-orderable-list-item:has(.as-config-field-label-text:text-is("${label}"))`,
  );
  await row.click();
  await dialog.locator(".as-filter-btn-apply").click();
  await expect(dialog).toHaveCount(0);
  await expect(pill).toHaveCount(1);
  return pill;
}

/**
 * Type `value` into a pill's `.as-filter-field-search` input and commit
 * with `Enter`. Use for free-text predicate inputs (regex / contains
 * patterns). Use `pickPillEnumValue` instead for value-help dropdowns.
 */
export async function commitPillInput(pill: Locator, value: string): Promise<void> {
  const input = pill.locator(".as-filter-field-search");
  await input.fill(value);
  await input.press("Enter");
}

/**
 * Open the pill's value-help dropdown and click the row whose `<td>` text
 * exactly matches `value` (anchored regex). Used for enum / ref columns
 * that surface a value-help table inline (no per-column dialog).
 *
 * Closes the dropdown with `Escape` after the pick to avoid stale-portal
 * interference with subsequent assertions.
 */
export async function pickPillEnumValue(page: Page, pill: Locator, value: string): Promise<void> {
  await pill.locator(".as-filter-field-search").click();
  const dropdown = page.locator(".as-filter-field-dropdown");
  await expect(dropdown).toBeVisible();
  await dropdown
    .locator("tbody tr td", { hasText: new RegExp(`^${value}$`, "u") })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await expect(dropdown).toHaveCount(0);
}
