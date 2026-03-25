import { test, expect } from "@playwright/test";

test.describe("Table selection via ListboxRoot", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/customers-table");
    await expect(page.getByRole("heading", { name: "Customers Table" })).toBeVisible();
    await expect(page.locator(".as-table")).toBeVisible({ timeout: 10_000 });
  });

  test("multi-select table renders with checkboxes", async ({ page }) => {
    // Should have a select-all checkbox in the header
    const headerCheckbox = page.locator(".as-th-select input[type='checkbox']");
    await expect(headerCheckbox).toBeVisible({ timeout: 5000 });

    // Rows should have selection indicators
    const rows = page.locator(".as-table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Rows should have the indicator column
    const selectCells = page.locator(".as-table tbody .as-td-select");
    await expect(selectCells.first()).toBeVisible();
  });

  test("clicking a row selects it (data-state=checked)", async ({ page }) => {
    const rows = page.locator(".as-table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Click the first row
    await rows.first().click();

    // Row should be selected (reka-ui applies data-state="checked")
    await expect(rows.first()).toHaveAttribute("data-state", "checked", { timeout: 3000 });
  });

  test("clicking a selected row deselects it", async ({ page }) => {
    const rows = page.locator(".as-table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Click to select
    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("data-state", "checked", { timeout: 3000 });

    // Click again to deselect
    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("data-state", "unchecked", { timeout: 3000 });
  });

  test("multiple rows can be selected", async ({ page }) => {
    const rows = page.locator(".as-table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Select first two rows
    await rows.nth(0).click();
    await rows.nth(1).click();

    // Both should be checked
    await expect(rows.nth(0)).toHaveAttribute("data-state", "checked");
    await expect(rows.nth(1)).toHaveAttribute("data-state", "checked");

    // Third row should not be checked
    await expect(rows.nth(2)).toHaveAttribute("data-state", "unchecked");
  });

  test("select-all checkbox selects all rows", async ({ page }) => {
    const headerCheckbox = page.locator(".as-th-select input[type='checkbox']");
    await expect(headerCheckbox).toBeVisible({ timeout: 5000 });

    const rows = page.locator(".as-table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Click select-all
    await headerCheckbox.click();

    // All rows should be checked
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      await expect(rows.nth(i)).toHaveAttribute("data-state", "checked");
    }
  });

  test("select-all then deselect-all", async ({ page }) => {
    const headerCheckbox = page.locator(".as-th-select input[type='checkbox']");
    const rows = page.locator(".as-table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 5000 });

    // Select all
    await headerCheckbox.click();
    await expect(rows.first()).toHaveAttribute("data-state", "checked");

    // Deselect all
    await headerCheckbox.click();

    // All should be unchecked
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      await expect(rows.nth(i)).toHaveAttribute("data-state", "unchecked");
    }
  });
});
