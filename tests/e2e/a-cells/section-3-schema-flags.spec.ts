// Section 3 — Schema-driven flags.
//
// Read-only batch. Asserts how `.as` annotations map onto the rendered
// table-def: which columns surface, which can be filtered/sorted, and which
// `@ui.table.type` overrides win against type inference.
//
// All assertions read DOM directly — toolbar buttons (`title="Columns"` /
// `title="Filters"` / `title="Sorters"`) open the shared config dialog.

import { type Locator, expect, test } from "@playwright/test";

import { gotoTable } from "../helpers";

async function columnCellIndex(table: Locator, columnPath: string): Promise<number> {
  const th = table.locator(`thead th[data-column-path="${columnPath}"]`);
  await expect(th).toHaveCount(1);
  return await th.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
}

test.describe("Section 3 — Schema-driven flags", () => {
  test("3.1: Flat-flattened parents are not synthetic columns", async ({ page }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();

    // `profile` is a plain object (no `@db.json`), so the server flattens it
    // into `profile.firstName` / `profile.lastName`. The synthetic `Profile`
    // parent must NOT surface as a column.
    await expect(table.locator(`thead th[data-column-path="profile"]`)).toHaveCount(0);
    await expect(table.locator(`thead th[data-column-path="profile.firstName"]`)).toHaveCount(1);
    await expect(table.locator(`thead th[data-column-path="profile.lastName"]`)).toHaveCount(1);

    // Column-config dialog: open via the toolbar `Columns` button. The
    // selectable list lives inside the `Columns` tab. Items are Reka
    // ListboxItems — text-content match is the readable assertion.
    await page.getByTitle("Columns", { exact: true }).click();
    const dialog = page.locator(".as-config-dialog-content");
    await expect(dialog).toBeVisible();

    const labels = await dialog
      .locator("[role='tabpanel'][data-state='active'] .as-orderable-list-item-label")
      .allTextContents();
    const trimmed = labels.map((l) => l.trim());
    expect(trimmed).toContain("First Name");
    expect(trimmed).toContain("Last Name");
    expect(trimmed).not.toContain("Profile");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("3.2: @db.json columns are NOT filterable / sortable", async ({ page }) => {
    await gotoTable(page, "customers");
    const table = page.locator("table.as-table").first();

    // Address column-header menu: open the `<button class="as-th-btn">`
    // inside its <th>. With `@db.json`, the column ends up non-sortable +
    // non-filterable — only the (always-on) `Hide column` row should appear.
    const addressIdx = await columnCellIndex(table, "address");
    const addressTh = table.locator("thead th").nth(addressIdx);
    const addressTrigger = addressTh.locator("button.as-th-btn");
    await addressTrigger.click();

    // Reka portals dropdown content to body; one menu surface at a time.
    const menu = page.locator(".as-column-menu-content");
    await expect(menu).toBeVisible();
    // Sort entries (Ascending / Descending) and Filter row are absent.
    await expect(menu.getByText(/^Ascending$/)).toHaveCount(0);
    await expect(menu.getByText(/^Descending$/)).toHaveCount(0);
    await expect(menu.getByText(/^Filter\.\.\.$/)).toHaveCount(0);
    // Hide column survives — vunor `column-menu` config keeps `hide: true`.
    await expect(menu.getByText(/^Hide column$/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // Toolbar Filters dialog: footer summary advertises filterable count.
    // Customers has 6 columns; address + preferences are `@db.json` →
    // 4 filterable remain. Default `defaultFilterFields` is empty for
    // customers, so the model count is 0.
    await page.getByTitle("Filters", { exact: true }).click();
    const dialog = page.locator(".as-config-dialog-content");
    await expect(dialog).toBeVisible();

    const summary = dialog.locator(".as-config-tab-summary-count");
    await expect(summary).toContainText(/0[\s\S]*of[\s\S]*4[\s\S]*filterable columns/u);

    // Within the active "Filters" tab, the field selector lists only the
    // filterable columns — neither @db.json column appears. The Filters
    // tab overrides the default `#label` slot with a chip-flavoured label,
    // so the visible class is `.as-config-field-label-text` (NOT
    // `.as-orderable-list-item-label` which only the columns/sorters tabs
    // inherit from the default slot fallback).
    const filterLabels = await dialog
      .locator("[role='tabpanel'][data-state='active'] .as-config-field-label-text")
      .allTextContents();
    const trimmedFilter = filterLabels.map((l) => l.trim());
    expect(trimmedFilter).not.toContain("Address");
    expect(trimmedFilter).not.toContain("Preferences");
    expect(trimmedFilter).toContain("Id");
    expect(trimmedFilter).toContain("Name");
    expect(trimmedFilter).toContain("Email");
    expect(trimmedFilter).toContain("Created");

    // Sorters tab — switch via the in-dialog tab trigger. Reka's
    // `<TabsTrigger>` renders as `<button role="tab">` without a `value`
    // HTML attribute (the value is internal state), so we match by
    // accessible name instead.
    await dialog.getByRole("tab", { name: "Sorters" }).click();
    const sorterLabels = await dialog
      .locator("[role='tabpanel'][data-state='active'] .as-orderable-list-item-label")
      .allTextContents();
    const trimmedSorter = sorterLabels.map((l) => l.trim());
    expect(trimmedSorter).not.toContain("Address");
    expect(trimmedSorter).not.toContain("Preferences");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("3.3: @ui.table.type overrides type inference", async ({ page }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();

    const usernameIdx = await columnCellIndex(table, "username");
    const adminRow = table
      .locator("tbody tr")
      .filter({
        has: page.locator(`xpath=./td[${usernameIdx + 1}][normalize-space(.)="admin"]`),
      })
      .first();

    // Birthday — `number.timestamp` + `@ui.table.type 'date'` ⇒ date-only,
    // NO `hh:mm` clock.
    const birthdayIdx = await columnCellIndex(table, "birthday");
    const birthdayCell = adminRow.locator("td").nth(birthdayIdx);
    const birthdayText = (await birthdayCell.textContent())?.trim() ?? "";
    expect(birthdayText.length).toBeGreaterThan(0);
    expect(birthdayText).not.toMatch(/\b\d{1,2}:\d{2}\b/u);

    // Last Login — `number.timestamp` + `@ui.table.type 'relative'` ⇒
    // relative-time string ending in "ago" (formatTimeAgoIntl). Falsy
    // case (bob) is covered in 2.1; here we use admin (5 min ago seed).
    const lastLoginIdx = await columnCellIndex(table, "lastLoginAt");
    const lastLoginCell = adminRow.locator("td").nth(lastLoginIdx);
    const lastLoginText = (await lastLoginCell.textContent())?.trim() ?? "";
    expect(lastLoginText).toMatch(/ago$/i);
    // Relative cells deliberately don't carry a clock segment.
    expect(lastLoginText).not.toMatch(/\b\d{1,2}:\d{2}\b/u);

    // Created — no override; falls through default inference for
    // `number.timestamp` ⇒ datetime ⇒ includes a `hh:mm` segment.
    const createdIdx = await columnCellIndex(table, "createdAt");
    const createdCell = adminRow.locator("td").nth(createdIdx);
    const createdText = (await createdCell.textContent())?.trim() ?? "";
    expect(createdText).toMatch(/\b\d{1,2}:\d{2}\b/u);
  });
});
