// Section 23 — Measurements & dates default inputs.
//
// Covers the five new defaults registered in Phase 4:
//   - AsAmount with static currency code (Price field, USD)
//   - AsAmount with @db.amount.currency.ref (Total field, follows
//     the Currency picker selection live)
//   - AsMeasure with static unit (Weight, kg)
//   - AsDate via @ui.form.type 'date' (Birthday)
//   - AsDatetime via number.timestamp (Scheduled at)
//   - AsTime via @ui.form.type 'time' (Reminder time)
//
// The demo target is `/forms-demo/measurements`, a self-contained page
// with no auth or server round-trip. Selectors mirror the AsForm /
// AsField conventions documented elsewhere — labels by `getByLabel`,
// adornments via the `.as-amount-*` / `.as-measure-*` shortcut classes.

import { expect, test, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/measurements");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Price")).toBeVisible();
}

test.describe("Section 23 — measurements & dates", () => {
  test("amount input commits a numeric value with static currency adornment", async ({ page }) => {
    await gotoDemo(page);

    // Static currency adornment for the USD-pinned Price field.
    const priceWrap = page.getByLabel("Price").locator("..");
    await expect(priceWrap.locator(".as-amount-prefix")).toBeVisible();

    const priceInput = page.getByLabel("Price");
    await priceInput.fill("19.99");
    await priceInput.blur();

    // Form-data preview reflects the committed numeric value.
    const preview = page.getByTestId("measurements-preview");
    await expect(preview).toContainText('"price": 19.99');
  });

  test("cross-row currency: changing Currency picker re-renders Total adornment", async ({
    page,
  }) => {
    await gotoDemo(page);

    const currencySelect = page.getByLabel("Order currency");
    const totalWrap = page.getByLabel("Order total").locator("..");
    const totalPrefix = totalWrap.locator(".as-amount-prefix");

    // No currency picked yet → no adornment renders (siblingValue is empty).
    await expect(totalPrefix).toHaveCount(0);

    // Pick USD → adornment appears with the USD glyph.
    await currencySelect.selectOption("USD");
    await expect(totalPrefix).toBeVisible();
    const usdGlyph = (await totalPrefix.textContent())?.trim() ?? "";
    expect(usdGlyph.length).toBeGreaterThan(0);

    // Switch to JPY — adornment text must update reactively.
    await currencySelect.selectOption("JPY");
    await expect(totalPrefix).toBeVisible();
    const jpyGlyph = (await totalPrefix.textContent())?.trim() ?? "";
    expect(jpyGlyph).not.toBe(usdGlyph);
    expect(jpyGlyph.length).toBeGreaterThan(0);
  });

  test("measure input renders trailing unit suffix (kg)", async ({ page }) => {
    await gotoDemo(page);

    const weightWrap = page.getByLabel("Weight").locator("..");
    const suffix = weightWrap.locator(".as-measure-suffix");
    await expect(suffix).toBeVisible();
    await expect(suffix).toHaveText(/kg/i);

    const weightInput = page.getByLabel("Weight");
    await weightInput.fill("4.25");
    await weightInput.blur();
    await expect(page.getByTestId("measurements-preview")).toContainText('"weight": 4.25');
  });

  test("date / datetime / time inputs render with the expected HTML5 types", async ({ page }) => {
    await gotoDemo(page);

    await expect(page.getByLabel("Birthday")).toHaveAttribute("type", "date");
    await expect(page.getByLabel("Scheduled at")).toHaveAttribute("type", "datetime-local");
    await expect(page.getByLabel("Reminder time")).toHaveAttribute("type", "time");

    // `<input type="time">` accepts HH:mm via fill().
    const reminder = page.getByLabel("Reminder time");
    await reminder.fill("09:30");
    await expect(page.getByTestId("measurements-preview")).toContainText('"reminderTime": "09:30"');
  });
});
