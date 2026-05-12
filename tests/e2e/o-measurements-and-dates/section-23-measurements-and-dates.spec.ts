// Section 23 — Numeric inputs showcase (Phase 6).
//
// Covers the new AsDecimal / AsNumber default renderers and the
// generalised prefix/suffix adornment chain. Demo target:
// `/forms-demo/measurements` — self-contained, no auth.
//
// Schema breakdown (10-field matrix):
//   1.  rate            (number + static prefix + suffix)
//   2.  score           (decimal + static prefix + suffix)
//   3.  simpleFee       (decimal + static USD)
//   4.  orderTotal      (decimal + static EUR)
//   5.  weight          (number + static unit)
//   6.  temperature     (decimal + static unit)
//   7.  quantity        (number + dynamic unit ref)
//   8.  measurement     (decimal + dynamic unit ref)
//   9.  tip             (decimal + dynamic @ui.form.prefix.ref → sibling currency value)
//  10.  invoiceTotal    (decimal + dynamic currency ref, db precision 3)

import { expect, test, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/measurements");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel(/Hourly rate/, { exact: false })).toBeVisible();
}

function decimalLocator(page: Page, label: RegExp) {
  // The integer-half `<input>` carries the field's primary aria label.
  // The decimal half carries `aria-label="decimals of <label>"`. Using
  // `getByLabel` with a regex would match both — we target the integer
  // explicitly via the `.as-decimal-integer` class and use `getByLabel`
  // only to scope the search inside that field's row.
  const fieldRow = page.locator(".as-default-field").filter({ hasText: label });
  const shell = fieldRow.locator(".as-decimal");
  return {
    shell,
    integer: shell.locator(".as-decimal-integer"),
    decimal: shell.locator(".as-decimal-decimal"),
    prefix: shell.locator(".as-prefix"),
    suffix: shell.locator(".as-suffix"),
    sep: shell.locator(".as-decimal-sep"),
  };
}

function numberLocator(page: Page, label: RegExp) {
  const fieldRow = page.locator(".as-default-field").filter({ hasText: label });
  // AsNumber: the `.as-number` shell paints when `hasAdornment` is true;
  // otherwise the plain control renders directly. Reach the input via the
  // `.as-number-input` class when present, else any input inside the field.
  const shell = fieldRow.locator(".as-number");
  return {
    shell,
    input: shell.locator(".as-number-input"),
    prefix: shell.locator(".as-prefix"),
    suffix: shell.locator(".as-suffix"),
  };
}

test.describe("Section 23 — numeric inputs showcase", () => {
  // ── 3. AsDecimal commit path (USD-forced number→decimal chrome) ─
  test("amount input commits decimal value via two-input chrome (USD)", async ({ page }) => {
    await gotoDemo(page);

    const fee = decimalLocator(page, /Simple fee/);
    await expect(fee.prefix).toBeVisible();

    await fee.integer.fill("19");
    await fee.decimal.fill("99");
    await fee.decimal.blur();

    // currency=USD has 2 decimals; @db.column.precision 12, 2 → storage="19.99".
    await expect(page.getByTestId("measurements-preview")).toContainText(
      /"simpleFee":\s*"19\.99"/,
    );
  });

  // ── 9 & 10. Dynamic currency rounds when picker shrinks scale ──
  test("dynamic currency picker re-renders dependent fields and re-rounds JPY", async ({
    page,
  }) => {
    await gotoDemo(page);
    const currencySelect = page.getByLabel("Currency", { exact: true });
    const invoice = decimalLocator(page, /Invoice total/);

    await currencySelect.selectOption("USD");
    await expect(invoice.prefix).toBeVisible();
    const usdGlyph = (await invoice.prefix.textContent())?.trim() ?? "";
    expect(usdGlyph.length).toBeGreaterThan(0);

    // Enter "10.99" EUR-shaped value
    await currencySelect.selectOption("EUR");
    await invoice.integer.fill("10");
    await invoice.decimal.fill("99");
    await invoice.decimal.blur();
    await expect(page.getByTestId("measurements-preview")).toContainText(
      /"invoiceTotal":\s*"10\.990"/,
    );

    // Switch to JPY → effective scale shrinks 2→0; storage stays 3 → "10.000".
    await currencySelect.selectOption("JPY");
    await expect(page.getByTestId("measurements-preview")).toContainText(
      /"invoiceTotal":\s*"10\.000"/,
    );
    // JPY → no decimal half rendered (scale === 0).
    await expect(invoice.decimal).toHaveCount(0);
  });

  test("BHD keeps three decimals; switching to EUR re-rounds the model", async ({ page }) => {
    await gotoDemo(page);
    const currencySelect = page.getByLabel("Currency", { exact: true });
    const invoice = decimalLocator(page, /Invoice total/);

    await currencySelect.selectOption("BHD");
    await invoice.integer.fill("5");
    await invoice.decimal.fill("123");
    await invoice.decimal.blur();
    await expect(page.getByTestId("measurements-preview")).toContainText(
      /"invoiceTotal":\s*"5\.123"/,
    );

    // BHD → EUR: effective scale shrinks 3→2 → "5.120".
    await currencySelect.selectOption("EUR");
    await expect(page.getByTestId("measurements-preview")).toContainText(
      /"invoiceTotal":\s*"5\.120"/,
    );
  });

  // ── 2. Decimal with @ui.form.prefix + @ui.form.suffix (non-currency) ──
  test("decimal with explicit prefix + suffix renders both adornment pills", async ({
    page,
  }) => {
    await gotoDemo(page);
    const score = decimalLocator(page, /Score/);
    await expect(score.prefix).toHaveText("#");
    await expect(score.suffix).toHaveText("/100");
    await score.integer.fill("42");
    await score.decimal.fill("5");
    await score.decimal.blur();
    await expect(page.getByTestId("measurements-preview")).toContainText(
      /"score":\s*"42\.50"/,
    );
  });

  // ── 1. Number with explicit prefix + suffix ──
  test("number with explicit prefix + suffix renders adornment pills + single input", async ({
    page,
  }) => {
    await gotoDemo(page);
    const rate = numberLocator(page, /Hourly rate/);
    await expect(rate.prefix).toHaveText("+1");
    await expect(rate.suffix).toHaveText("/hr");
    await rate.input.fill("42");
    await rate.input.blur();
    // Number-typed field must commit a primitive number (no quotes) —
    // regression for "Expected number, got string" when typing into a
    // null-origin number field with prefix/suffix.
    await expect(page.getByTestId("measurements-preview")).toContainText(/"rate":\s*42(?!")/);
  });

  // ── ArrowUp / ArrowDown step on the merged-chrome number input ──
  test("ArrowUp / ArrowDown increment and decrement on number+adornment input", async ({
    page,
  }) => {
    await gotoDemo(page);
    const rate = numberLocator(page, /Hourly rate/);
    // Empty / null model → ArrowUp lands at 1.
    await rate.input.focus();
    await rate.input.press("ArrowUp");
    await expect(page.getByTestId("measurements-preview")).toContainText(/"rate":\s*1(?!")/);
    // Step again → 2; commit shape must stay number.
    await rate.input.press("ArrowUp");
    await expect(page.getByTestId("measurements-preview")).toContainText(/"rate":\s*2(?!")/);
    // ArrowDown × 3 → -1.
    await rate.input.press("ArrowDown");
    await rate.input.press("ArrowDown");
    await rate.input.press("ArrowDown");
    await expect(page.getByTestId("measurements-preview")).toContainText(/"rate":\s*-1(?!")/);
  });

  // ── 5. Number with @db.unit (static) ──
  test("number with static @db.unit renders trailing unit pill (kg)", async ({ page }) => {
    await gotoDemo(page);
    const weight = numberLocator(page, /^Weight/);
    await expect(weight.suffix).toBeVisible();
    await expect(weight.suffix).toHaveText(/kg/i);
    await weight.input.fill("4.25");
    await weight.input.blur();
    // weight is `number`-typed → primitive number (no quotes).
    await expect(page.getByTestId("measurements-preview")).toContainText(
      /"weight":\s*4\.25(?!")/,
    );
  });

  // ── 6. Decimal with @db.unit static ──
  test("decimal with static @db.unit renders trailing unit pill (°C)", async ({ page }) => {
    await gotoDemo(page);
    const temp = decimalLocator(page, /Temperature/);
    await expect(temp.suffix).toBeVisible();
    await expect(temp.suffix).toHaveText("°C");
    await temp.integer.fill("21");
    await temp.decimal.fill("7");
    await temp.decimal.blur();
    await expect(page.getByTestId("measurements-preview")).toContainText(
      /"temperature":\s*"21\.7"/,
    );
  });

  // ── 7. Number with dynamic unit ──
  test("number with dynamic @db.unit.ref updates the suffix when the picker changes", async ({
    page,
  }) => {
    await gotoDemo(page);
    const unitSelect = page.getByLabel("Unit", { exact: true });
    const quantity = numberLocator(page, /Quantity/);

    await unitSelect.selectOption("kg");
    await expect(quantity.suffix).toHaveText(/kg/i);
    await unitSelect.selectOption("lb");
    await expect(quantity.suffix).toHaveText(/lb/i);
  });

  // ── 8. Decimal with dynamic unit ──
  test("decimal with dynamic @db.unit.ref updates the suffix without breaking the integer/decimal chrome", async ({
    page,
  }) => {
    await gotoDemo(page);
    const unitSelect = page.getByLabel("Unit", { exact: true });
    const measurement = decimalLocator(page, /Measurement/);

    await unitSelect.selectOption("kg");
    await expect(measurement.suffix).toHaveText(/kg/i);
    await unitSelect.selectOption("g");
    await expect(measurement.suffix).toHaveText(/g/i);
    // Decimal half still present (db precision = 3 so scale=3).
    await expect(measurement.decimal).toBeVisible();
  });

  // ── 9. Decimal with @ui.form.prefix.ref (sibling-fed prefix) ──
  test("decimal with @ui.form.prefix.ref reads sibling field value as the prefix string", async ({
    page,
  }) => {
    await gotoDemo(page);
    const currencySelect = page.getByLabel("Currency", { exact: true });
    const tip = decimalLocator(page, /Tip amount/);

    // The sibling field is the Currency picker → the prefix displays the
    // selected option value verbatim (e.g. "USD"), not the locale-narrow
    // glyph (that's only via @db.amount.currency*).
    await currencySelect.selectOption("USD");
    await expect(tip.prefix).toBeVisible();
    await expect(tip.prefix).toHaveText("USD");
    await currencySelect.selectOption("JPY");
    await expect(tip.prefix).toHaveText("JPY");
  });

  // ── AsDecimal keyboard contract (unchanged from Phase 5) ──
  test("decimal half stays empty while integer half is being typed (no '00' artifact)", async ({
    page,
  }) => {
    await gotoDemo(page);
    const fee = decimalLocator(page, /Simple fee/);
    await expect(fee.decimal).toHaveValue("");

    await fee.integer.focus();
    await fee.integer.fill("4");
    await expect(fee.decimal).toHaveValue("");
    await fee.integer.blur();
    await expect(fee.decimal).toHaveValue("00");
  });

  test("keyboard bridge: arrow right at integer end focuses decimal start", async ({
    page,
  }) => {
    await gotoDemo(page);
    const fee = decimalLocator(page, /Simple fee/);
    await fee.integer.click();
    await fee.integer.fill("42");
    await fee.integer.press("End");
    await fee.integer.press("ArrowRight");
    await expect(fee.decimal).toBeFocused();
  });

  test("keyboard bridge: backspace at decimal start focuses integer end (no delete)", async ({
    page,
  }) => {
    await gotoDemo(page);
    const fee = decimalLocator(page, /Simple fee/);
    await fee.integer.fill("42");
    await fee.decimal.fill("50");
    await fee.decimal.focus();
    await fee.decimal.press("Home");
    await fee.decimal.press("Backspace");
    await expect(fee.integer).toBeFocused();
    await expect(fee.decimal).toHaveValue("50");
  });

  test("number input strips non-numeric chars on the fly (typed garbage)", async ({
    page,
  }) => {
    await gotoDemo(page);
    const weight = numberLocator(page, /^Weight/);
    await weight.input.fill("");
    await weight.input.focus();
    await page.keyboard.type("123afas213fasd,fasd");
    const value = await weight.input.inputValue();
    expect(value).not.toMatch(/[a-zA-Z]/);
    expect(value).toMatch(/^-?[0-9]*[.,]?[0-9]*$/);
  });

  test("layout: chrome reads as one merged input (no inner gaps between halves)", async ({
    page,
  }) => {
    await gotoDemo(page);
    const fee = decimalLocator(page, /Simple fee/);

    const prefixBox = await fee.prefix.boundingBox();
    const intBox = await fee.integer.boundingBox();
    const sepBox = await fee.sep.boundingBox();
    const decBox = await fee.decimal.boundingBox();
    expect(prefixBox && intBox && sepBox && decBox).toBeTruthy();

    expect(Math.abs(intBox!.x - (prefixBox!.x + prefixBox!.width))).toBeLessThanOrEqual(2);
    expect(Math.abs(sepBox!.x - (intBox!.x + intBox!.width))).toBeLessThanOrEqual(2);
    expect(Math.abs(decBox!.x - (sepBox!.x + sepBox!.width))).toBeLessThanOrEqual(2);
  });
});

// ── Regression: optional-leaf placeholder-init across the 10-case matrix ──
// Demo target: `/forms-demo/measurements-optional` — same shapes as the
// standard measurements showcase but every numeric field is optional. The
// AsFieldShell empty-state placeholder ("Not set" → hover "Click to edit")
// must transition to an editable input chrome on click for every shape.
//
// Pre-fix: the seven decimal fields stayed stuck in the placeholder state
// because atscript's `finalDefault` doesn't enumerate the `decimal` design
// type — `createFormData` returned `undefined`, AsFieldShell read that as
// "still unset", placeholder kept rendering. Fixed in
// `packages/ui/src/form/path-utils.ts` by backfilling primitive design
// types whose structural default is undefined (decimal → '').
test.describe("Section 23.opt — optional placeholder-init across all 10 numeric shapes", () => {
  type FieldCase = {
    label: RegExp;
    field: keyof MeasurementsOptionalPreview;
    // 'number' fields render as `.as-number` shell when adorned, otherwise
    // as a plain `<input>`. 'decimal' always renders as `.as-decimal` shell.
    chrome: "decimal" | "number" | "plain-number";
  };

  type MeasurementsOptionalPreview = {
    rate: unknown;
    score: unknown;
    simpleFee: unknown;
    orderTotal: unknown;
    weight: unknown;
    temperature: unknown;
    quantity: unknown;
    measurement: unknown;
    tip: unknown;
    invoiceTotal: unknown;
  };

  const FIELDS: FieldCase[] = [
    { label: /Hourly rate/, field: "rate", chrome: "number" },
    { label: /Score/, field: "score", chrome: "decimal" },
    { label: /Simple fee/, field: "simpleFee", chrome: "decimal" },
    { label: /Order total/, field: "orderTotal", chrome: "decimal" },
    { label: /^Weight/, field: "weight", chrome: "number" },
    { label: /Temperature/, field: "temperature", chrome: "decimal" },
    { label: /Quantity/, field: "quantity", chrome: "number" },
    { label: /Measurement/, field: "measurement", chrome: "decimal" },
    { label: /Tip amount/, field: "tip", chrome: "decimal" },
    { label: /Invoice total/, field: "invoiceTotal", chrome: "decimal" },
  ];

  async function gotoOptionalDemo(page: Page) {
    await page.goto("/forms-demo/measurements-optional");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Optional numeric inputs/).first()).toBeVisible();
  }

  for (const fc of FIELDS) {
    test(`optional ${fc.field}: empty-state placeholder click reveals editable input`, async ({
      page,
    }) => {
      await gotoOptionalDemo(page);

      const row = page.locator(".as-default-field").filter({ hasText: fc.label });
      const placeholder = row.locator(".as-no-data");
      // Pre-condition: placeholder is rendered, no input chrome yet.
      await expect(placeholder).toBeVisible();
      if (fc.chrome === "decimal") {
        await expect(row.locator(".as-decimal")).toHaveCount(0);
      } else {
        await expect(row.locator(".as-number")).toHaveCount(0);
      }

      // Act: click the placeholder.
      await placeholder.click();

      // Post-condition: placeholder is gone, input chrome paints.
      await expect(placeholder).toHaveCount(0);
      if (fc.chrome === "decimal") {
        await expect(row.locator(".as-decimal")).toBeVisible();
        // The decimal integer input must be focusable.
        await row.locator(".as-decimal-integer").focus();
        await expect(row.locator(".as-decimal-integer")).toBeFocused();
      } else {
        // `number` fields with adornments → `.as-number` merged shell. The
        // shape on this page guarantees at least one adornment for the
        // number cases (rate has prefix/suffix, weight/quantity have unit).
        await expect(row.locator(".as-number")).toBeVisible();
        await row.locator(".as-number-input").focus();
        await expect(row.locator(".as-number-input")).toBeFocused();
      }
    });
  }
});
