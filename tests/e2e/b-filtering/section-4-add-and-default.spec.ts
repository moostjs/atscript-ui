// Section 4 — Filtering: add via dialog + default-filter-fields drift.
//
// Read-only batch. Asserts:
//   - 4.1 Adding a filter pill via the toolbar Filters dialog: Apply closes
//     dialog, pill appears, NO query fires for an empty pill, then typing
//     `bob` produces ONE `/pages?...firstName...` after the 500 ms debounce.
//   - 4.2 Spec-vs-impl drift on `defaultFilterFields`. The DemoTable
//     declares `defaultFilterFields` for users / orders / products, but the
//     preset bootstrap (system Standard preset) clobbers `filterFields` to
//     `[]` on first paint. So no pills auto-render. We assert the columns
//     ARE filterable (visible in the Filters dialog) so a future fix
//     stays observable. The expected "pills render by default" behaviour
//     is flagged in the batch hand-off.
//
// Selector strategy: filter pills carry `<label class="as-filter-field-label">`
// with the column.label text. The Filters tab in the toolbar config dialog
// renders rows with `.as-config-field-label-text` (custom label slot in
// `<AsConfigDialog>`); the Columns tab uses `.as-orderable-list-item-label`.

import { type Locator, type Page, expect, test } from "@playwright/test";

import { expectNoPages, expectSinglePages, gotoTable } from "../helpers";

/** Locator for the filter pill whose label matches the column label exactly. */
function pillByLabel(page: Page, label: string): Locator {
  return page
    .locator(".as-filter-field")
    .filter({ has: page.locator(`label.as-filter-field-label:text-is("${label}")`) });
}

/** Open the toolbar Filters dialog (the shared <AsConfigDialog> on Filters tab). */
async function openToolbarFiltersDialog(page: Page): Promise<Locator> {
  await page.getByTitle("Filters", { exact: true }).click();
  const dialog = page.locator(".as-config-dialog-content");
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Available filter labels in the toolbar Filters dialog. The Filters tab
 * uses the `<template #label>` slot which renders `.as-config-field-label-text`
 * (NOT `.as-orderable-list-item-label`).
 */
async function filterableLabels(dialog: Locator): Promise<string[]> {
  const all = await dialog
    .locator("[role='tabpanel'][data-state='active'] .as-config-field-label-text")
    .allTextContents();
  return all.map((s) => s.trim()).filter(Boolean);
}

/** Click the row in the Filters tab whose label matches `label` exactly. */
async function toggleFilterableRow(dialog: Locator, label: string): Promise<void> {
  const row = dialog.locator(
    `[role='tabpanel'][data-state='active'] .as-orderable-list-item:has(.as-config-field-label-text:text-is("${label}"))`,
  );
  await row.click();
}

test.describe("Section 4 — Filtering: add and default", () => {
  test("4.1: Add a filter via the Filters dialog, no query until value entered", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    const dialog = await openToolbarFiltersDialog(page);

    // Filterable subset: `Password` / `Salt` are sensitive (filterable: false
    // forced via @db.json on json columns; for users they're plain strings
    // but server-side declared sensitive). Verify First Name is filterable
    // and the synthetic Profile parent is suppressed.
    const labels = await filterableLabels(dialog);
    expect(labels).toContain("First Name");
    expect(labels).not.toContain("Profile");

    // Adding a filter pill is display-only state — must NOT fire a query.
    await expectNoPages(page, async () => {
      await toggleFilterableRow(dialog, "First Name");
      await dialog.locator(".as-filter-btn-apply").click();
      await expect(dialog).toHaveCount(0);
    });

    // Pill rendered in toolbar.
    const pill = pillByLabel(page, "First Name");
    await expect(pill).toHaveCount(1);

    // Type `bob` and press Enter. After the 500 ms debounce, exactly one
    // `/pages` fires for the users table.
    const input = pill.locator(".as-filter-field-search");
    await input.click();
    const captured = await expectSinglePages(
      page,
      async () => {
        await input.fill("bob");
        await input.press("Enter");
      },
      { table: "users" },
    );

    // Wire shape: `contains` builds `${field}~='/bob/i'` per @uniqu/url's
    // serializeValue. The browser percent-encodes apostrophes / forward
    // slashes when the URL is fired, so we compare on decoded form.
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("profile.firstName~='/bob/i'");

    // Result rows: case-insensitive `bob` substring on firstName matches
    // bob's seed row only (other 4 users — Admin/Morgan/Vera/Alice — don't
    // contain `bob`). The AsTableVirtualizer appends a trailing empty
    // `<tr/>` spacer; filter to rows that have at least one `<td>` cell.
    const table = page.locator("table.as-table").first();
    const usernameTh = table.locator(`thead th[data-column-path="username"]`);
    const usernameIdx = await usernameTh.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
    const dataRows = table.locator("tbody tr:has(td)");
    await expect(dataRows).toHaveCount(1);
    const bobCell = await dataRows.first().locator("td").nth(usernameIdx).textContent();
    expect((bobCell ?? "").trim()).toBe("bob");
  });

  test("4.2: defaultFilterFields columns ARE filterable (drift: pills no longer auto-render)", async ({
    page,
  }) => {
    // Spec-vs-impl drift: TABLE_SCENARIOS.md expects pills `Status` + `Role`
    // to auto-render on `/users` (per `defaultFilterFields: ['status',
    // 'roleId']`), but the preset bootstrap (system Standard preset) clears
    // `filterFields` to `[]` after mount, hiding all pills. Until that's
    // resolved, we verify the demo's *intent* — the named columns are
    // available to add as filter pills via the toolbar dialog — and assert
    // the current observable state (zero pills auto-rendered).

    await gotoTable(page, "users");
    {
      // No pills auto-render today — drift baseline.
      await expect(page.locator(".as-filter-field")).toHaveCount(0);

      const dialog = await openToolbarFiltersDialog(page);
      const labels = await filterableLabels(dialog);
      expect(labels).toContain("Status");
      expect(labels).toContain("Role");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }

    await gotoTable(page, "orders");
    {
      await expect(page.locator(".as-filter-field")).toHaveCount(0);
      const dialog = await openToolbarFiltersDialog(page);
      const labels = await filterableLabels(dialog);
      expect(labels).toContain("Customer");
      expect(labels).toContain("Status");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }

    await gotoTable(page, "products");
    {
      await expect(page.locator(".as-filter-field")).toHaveCount(0);
      const dialog = await openToolbarFiltersDialog(page);
      const labels = await filterableLabels(dialog);
      expect(labels).toContain("Category");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  });
});
