import { test, expect } from "@playwright/test";

async function enableAndTypeInCombobox(
  page: import("@playwright/test").Page,
  label: string,
  nthNoData: number,
  text: string,
) {
  await page.getByRole("button", { name: "No Data" }).nth(nthNoData).click();
  const combobox = page.getByRole("combobox", { name: label });
  await expect(combobox).toBeVisible();
  await combobox.focus();
  await page.waitForTimeout(1000);
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text, { delay: 50 });
  await page.waitForTimeout(1000);
  return combobox;
}

test.describe("FK Ref (Value Help) form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ref");
    await expect(page.getByRole("heading", { name: "FK Ref (Value Help)" })).toBeVisible();
  });

  test("renders form with optional FK fields", async ({ page }) => {
    const noDataButtons = page.getByRole("button", { name: "No Data" });
    await expect(noDataButtons).toHaveCount(3);
  });

  test("enables Customer field and shows combobox", async ({ page }) => {
    await page.getByRole("button", { name: "No Data" }).first().click();
    const combobox = page.getByRole("combobox", { name: "Customer" });
    await expect(combobox).toBeVisible();
  });

  test("typing in combobox shows search results with id and label", async ({ page }) => {
    await enableAndTypeInCombobox(page, "Customer", 0, "a");
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible({ timeout: 5000 });
    // Two-column: id + label
    await expect(option.locator(".as-ref-item-id")).toBeVisible();
    await expect(option.locator(".as-ref-item-label")).toContainText("Alice");
  });

  test("selecting a result sets form data with FK id", async ({ page }) => {
    await enableAndTypeInCombobox(page, "Customer", 0, "a");
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    const formDebug = page.locator(".form-debug");
    await expect(formDebug).toContainText("customerId");
    await expect(formDebug).not.toContainText('"customerId": 0');
  });

  test("typing an exact PK shows that record", async ({ page }) => {
    await enableAndTypeInCombobox(page, "Customer", 0, "18");
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await expect(option.locator(".as-ref-item-id")).toContainText("18");
  });

  test("Product combobox shows search results", async ({ page }) => {
    await enableAndTypeInCombobox(page, "Product", 1, "P");
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible({ timeout: 5000 });
  });
});
