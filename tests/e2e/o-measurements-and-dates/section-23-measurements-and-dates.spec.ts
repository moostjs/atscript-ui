// Section 23 — Measurements & dates default inputs (Phase 5).
//
// Covers the bank-UX AsAmount rewrite, the single-input AsMeasure, plus
// the three date-family defaults. AsAmount renders TWO inputs joined by
// a decimal separator pill, with keyboard bridging between integer and
// decimal halves; this suite exercises both the value-commit paths and
// the keyboard-glue logic.
//
// Demo target: `/forms-demo/measurements` — self-contained, no auth.

import { expect, test, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/measurements");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Price", { exact: true })).toBeVisible();
}

function priceLocator(page: Page) {
  // Phase-5 chrome: the integer half is the labelled input (carries the id
  // bound to <label for=...>). Decimal half lives inside `.as-amount`.
  return {
    shell: page.getByLabel("Price", { exact: true }).locator("..").locator(".as-amount"),
    integer: page.getByLabel("Price", { exact: true }),
    decimal: page.getByLabel("Price", { exact: true }).locator("..").locator(".as-amount-decimal"),
    symbol: page.getByLabel("Price", { exact: true }).locator("..").locator(".as-amount-symbol"),
  };
}

function totalLocator(page: Page) {
  return {
    shell: page.getByLabel("Order total", { exact: true }).locator("..").locator(".as-amount"),
    integer: page.getByLabel("Order total", { exact: true }),
    decimal: page.getByLabel("Order total", { exact: true }).locator("..").locator(".as-amount-decimal"),
    symbol: page.getByLabel("Order total", { exact: true }).locator("..").locator(".as-amount-symbol"),
  };
}

test.describe("Section 23 — measurements & dates", () => {
  test("amount input commits decimal value via two-input chrome (USD)", async ({ page }) => {
    await gotoDemo(page);

    const price = priceLocator(page);
    await expect(price.symbol).toBeVisible();

    await price.integer.fill("19");
    await price.decimal.fill("99");
    await price.decimal.blur();

    // Storage shape: db.column.precision _, 2 → padded to "19.99" (number value).
    await expect(page.getByTestId("measurements-preview")).toContainText('"price": "19.99"');
  });

  test("cross-row currency picker re-renders Total adornment + re-rounds JPY", async ({
    page,
  }) => {
    await gotoDemo(page);

    const currencySelect = page.getByLabel("Order currency");
    const total = totalLocator(page);

    // No currency yet → no adornment.
    await expect(total.symbol).toHaveCount(0);

    await currencySelect.selectOption("USD");
    await expect(total.symbol).toBeVisible();
    const usdGlyph = (await total.symbol.textContent())?.trim() ?? "";
    expect(usdGlyph.length).toBeGreaterThan(0);

    // Enter 10.99 EUR-shaped value, switch to JPY → re-rounds.
    await currencySelect.selectOption("EUR");
    await total.integer.fill("10");
    await total.decimal.fill("99");
    await total.decimal.blur();
    await expect(page.getByTestId("measurements-preview")).toContainText('"total": "10.990"');

    await currencySelect.selectOption("JPY");
    // db scale=3 stays as storage; effective scale shrinks 2→0 → "10.000".
    await expect(page.getByTestId("measurements-preview")).toContainText('"total": "10.000"');

    // JPY → no decimal input rendered (scale === 0).
    await expect(total.decimal).toHaveCount(0);
  });

  test("BHD keeps three decimals; switching to EUR re-rounds the model", async ({ page }) => {
    await gotoDemo(page);

    const currencySelect = page.getByLabel("Order currency");
    const total = totalLocator(page);

    await currencySelect.selectOption("BHD");
    await total.integer.fill("5");
    await total.decimal.fill("123");
    await total.decimal.blur();
    await expect(page.getByTestId("measurements-preview")).toContainText('"total": "5.123"');

    // BHD → EUR: effective scale shrinks 3→2; once the user committed, a
    // subsequent currency change is treated as a model change and the
    // watcher re-rounds + re-pads to storageScale=3 → "5.120".
    await currencySelect.selectOption("EUR");
    await expect(page.getByTestId("measurements-preview")).toContainText('"total": "5.120"');
  });

  test("decimal half stays empty while integer half is being typed (no '00' artifact)", async ({
    page,
  }) => {
    await gotoDemo(page);
    const price = priceLocator(page);

    // Empty initial state.
    await expect(price.decimal).toHaveValue("");

    await price.integer.focus();
    await price.integer.fill("4");
    // Canonical model now "4.00", but the user hasn't touched the decimal
    // half — the rendered value must NOT pre-fill with the padding "00".
    await expect(price.decimal).toHaveValue("");

    // Blur snaps the decimal to its formatted/padded form.
    await price.integer.blur();
    await expect(price.decimal).toHaveValue("00");
  });

  test("keyboard bridge: arrow right at integer end focuses decimal start", async ({ page }) => {
    await gotoDemo(page);
    const price = priceLocator(page);

    await price.integer.click();
    await price.integer.fill("42");
    // Move caret to the very end deterministically — `fill` doesn't always
    // leave cursor at end across browser engines.
    await price.integer.press("End");
    await price.integer.press("ArrowRight");
    await expect(price.decimal).toBeFocused();
  });

  test("keyboard bridge: backspace at decimal start focuses integer end (no delete)", async ({
    page,
  }) => {
    await gotoDemo(page);
    const price = priceLocator(page);

    await price.integer.fill("42");
    await price.decimal.fill("50");
    // Move cursor to start of decimal half.
    await price.decimal.focus();
    await price.decimal.press("Home");
    await price.decimal.press("Backspace");
    await expect(price.integer).toBeFocused();
    // Decimal half should not have lost a character.
    await expect(price.decimal).toHaveValue("50");
  });

  test("keyboard bridge: typing the decimal separator key in integer jumps to decimal", async ({
    page,
  }) => {
    await gotoDemo(page);
    const price = priceLocator(page);

    await price.integer.focus();
    await price.integer.fill("1234");
    // en-US locale → "." is the bridge. Press the key after the value.
    await price.integer.press(".");
    await expect(price.decimal).toBeFocused();
  });

  test("measure input renders trailing unit suffix (kg)", async ({ page }) => {
    await gotoDemo(page);

    // Weight input's direct parent IS the `.as-measure` shell.
    const weightWrap = page.getByLabel("Weight", { exact: true }).locator("..");
    const suffix = weightWrap.locator(".as-measure-unit");
    await expect(suffix).toBeVisible();
    await expect(suffix).toHaveText(/kg/i);

    const weightInput = page.getByLabel("Weight", { exact: true });
    await weightInput.fill("4.25");
    await weightInput.blur();
    await expect(page.getByTestId("measurements-preview")).toContainText('"weight": "4.25"');
  });

  test("date / datetime / time inputs render with the expected HTML5 types", async ({ page }) => {
    await gotoDemo(page);

    await expect(page.getByLabel("Birthday")).toHaveAttribute("type", "date");
    await expect(page.getByLabel("Scheduled at")).toHaveAttribute("type", "datetime-local");
    await expect(page.getByLabel("Reminder time")).toHaveAttribute("type", "time");

    const reminder = page.getByLabel("Reminder time");
    await reminder.fill("09:30");
    await expect(page.getByTestId("measurements-preview")).toContainText('"reminderTime": "09:30"');
  });
});
