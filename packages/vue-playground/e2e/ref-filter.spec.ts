import { test, expect } from "@playwright/test";

test.describe("FK Ref inline filter (value-help dropdown)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/orders-table");
    await expect(page.getByRole("heading", { name: "Orders Table" })).toBeVisible();
    // Wait for table to load
    await expect(page.locator(".as-table")).toBeVisible({ timeout: 10_000 });
  });

  test("orders table renders with data", async ({ page }) => {
    const rows = page.locator(".as-table tr:has(td)");
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking +Filter on Customer shows inline ref input", async ({ page }) => {
    // Click "+ Filter" to open the add filter popover
    const addBtn = page.locator(".as-filter-add-btn");
    await addBtn.click();

    // Click "Customer" in the popover
    const customerItem = page.locator(".as-filter-add-item").filter({ hasText: "Customer" });
    await expect(customerItem).toBeVisible({ timeout: 3000 });
    await customerItem.click();

    // Inline ref input should appear in the filter bar
    const refInline = page.locator(".as-filter-ref-inline").first();
    await expect(refInline).toBeVisible({ timeout: 3000 });

    // Should have a label
    await expect(refInline.locator(".as-filter-ref-inline-label")).toContainText("Customer");

    // Should have a search input
    await expect(refInline.locator(".as-filter-ref-inline-search")).toBeVisible();
  });

  test("focusing search input opens dropdown with table", async ({ page }) => {
    // Add Customer filter
    await page.locator(".as-filter-add-btn").click();
    await page.locator(".as-filter-add-item").filter({ hasText: "Customer" }).click();

    const refInline = page.locator(".as-filter-ref-inline").first();
    await expect(refInline).toBeVisible({ timeout: 3000 });

    // Focus the search input
    const searchInput = refInline.locator(".as-filter-ref-inline-search");
    await searchInput.focus();

    // Dropdown should open with a table inside
    const dropdown = page.locator(".as-filter-ref-dropdown");
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Should have a table with rows
    const table = dropdown.locator(".as-table");
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a row adds a chip and filters parent table", async ({ page }) => {
    // Add Customer filter
    await page.locator(".as-filter-add-btn").click();
    await page.locator(".as-filter-add-item").filter({ hasText: "Customer" }).click();

    const refInline = page.locator(".as-filter-ref-inline").first();
    await expect(refInline).toBeVisible({ timeout: 3000 });

    // Open dropdown
    const searchInput = refInline.locator(".as-filter-ref-inline-search");
    await searchInput.focus();

    const dropdown = page.locator(".as-filter-ref-dropdown");
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Wait for table rows to load
    const tableRows = dropdown.locator(".as-table tr:has(td)");
    await expect(tableRows.first()).toBeVisible({ timeout: 5000 });

    // Click first row
    await tableRows.first().click();

    // Should show a chip
    const chip = refInline.locator(".as-filter-ref-inline-chip");
    await expect(chip.first()).toBeVisible({ timeout: 3000 });
  });

  test("removing a chip clears the filter", async ({ page }) => {
    // Add Customer filter + select a value
    await page.locator(".as-filter-add-btn").click();
    await page.locator(".as-filter-add-item").filter({ hasText: "Customer" }).click();

    const refInline = page.locator(".as-filter-ref-inline").first();
    const searchInput = refInline.locator(".as-filter-ref-inline-search");
    await searchInput.focus();

    const dropdown = page.locator(".as-filter-ref-dropdown");
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    const tableRows = dropdown.locator(".as-table tr:has(td)");
    await expect(tableRows.first()).toBeVisible({ timeout: 5000 });
    await tableRows.first().click();

    // Chip should be visible
    const chip = refInline.locator(".as-filter-ref-inline-chip");
    await expect(chip.first()).toBeVisible({ timeout: 3000 });

    // Click × on the chip
    await chip.first().locator(".as-filter-ref-inline-chip-remove").click();

    // Chip should be gone
    await expect(chip).toHaveCount(0);
  });

  test("search filters dropdown results and shows matching data", async ({ page }) => {
    // Add Customer filter
    await page.locator(".as-filter-add-btn").click();
    await page.locator(".as-filter-add-item").filter({ hasText: "Customer" }).click();

    const refInline = page.locator(".as-filter-ref-inline").first();
    const searchInput = refInline.locator(".as-filter-ref-inline-search");
    await searchInput.focus();

    const dropdown = page.locator(".as-filter-ref-dropdown");
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Wait for initial results (should have 10 rows)
    const tableRows = dropdown.locator(".as-table tr:has(td)");
    await expect(tableRows.first()).toBeVisible({ timeout: 5000 });
    const initialCount = await tableRows.count();
    expect(initialCount).toBe(10);

    // Search for "Anna" — server returns exactly 1 result
    await searchInput.fill("Anna");

    // Wait for debounce + network + dropdown reopen
    await expect(tableRows).toHaveCount(1, { timeout: 3000 });

    // The row must contain "Anna", not stale data
    await expect(tableRows.first()).toContainText("Anna");
  });

  test("removing inline filter with × button", async ({ page }) => {
    // Add Customer filter
    await page.locator(".as-filter-add-btn").click();
    await page.locator(".as-filter-add-item").filter({ hasText: "Customer" }).click();

    const refInline = page.locator(".as-filter-ref-inline");
    await expect(refInline.first()).toBeVisible({ timeout: 3000 });

    // Click the × remove button on the inline filter
    await refInline.first().locator(".as-filter-ref-inline-remove").click();

    // Inline filter should be gone
    await expect(refInline).toHaveCount(0);
  });
});
