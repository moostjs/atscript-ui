// Section 24 — Custom-component customization mechanisms.
//
// Exercises the two paths the docs page advertises:
//
//   • Section A — global override of the built-in `text` key in the
//     `types` map. Every string field on the form (`displayName`, `bio`)
//     swaps from the default `AsInput` to the consumer-supplied
//     `DemoGrowingTextarea` without touching the schema.
//
//   • Section B — per-field opt-in via `@ui.form.type "<key>"` and
//     `@ui.form.component "<name>"` annotations. Each annotated field
//     resolves to a different custom widget; `displayName` (unannotated)
//     stays on the default `AsInput` as the baseline-vs-custom anchor.
//
// Demo target: `/forms-demo/custom-components` — self-contained, no
// server round-trip, no auth-specific data. Both forms expose their
// model JSON via a `<details>` block (`data-testid=
// custom-components-section-{a,b}-preview`) so we read user commits
// verbatim.

import { expect, test, type Locator, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/custom-components");
  await page.waitForLoadState("networkidle");
  // Section A's form lives in the DOM with two custom textareas the
  // moment the page hydrates. Wait for both before any test acts so
  // we don't race the initial SSR → hydration handoff.
  await expect(
    page.locator(
      '[data-testid="custom-components-section-a-form"] [data-testid="demo-growing-textarea"]',
    ),
  ).toHaveCount(2);
}

const section = (page: Page, s: "a" | "b"): Locator =>
  page.getByTestId(`custom-components-section-${s}-form`);

// Reads the <pre> JSON model's `value` payload (form data is wrapped as
// `{ value }`). textContent() works whether the <details> is open or not.
async function readValue<T = unknown>(page: Page, s: "a" | "b"): Promise<T> {
  const txt =
    (await page.getByTestId(`custom-components-section-${s}-preview`).textContent()) ?? "";
  return (JSON.parse(txt) as { value: T }).value;
}

test.describe("Section 24 — custom-components customization mechanisms", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── A1. Built-in `text` override replaces every string field ─────
  test("Section A renders all string fields via DemoGrowingTextarea (built-in `text` override)", async ({
    page,
  }) => {
    const a = section(page, "a");
    // Both `displayName` and `bio` are `string` → both hit the custom
    // renderer. Exactly 2 wrappers, no more, no fewer.
    await expect(a.locator('[data-testid="demo-growing-textarea"]')).toHaveCount(2);

    // The custom widget renders a `<textarea>`; the default AsInput renders
    // a plain `<input type="text">`. Absence of <input> inside Section A
    // proves the global override actually replaced AsInput rather than
    // rendering alongside it.
    await expect(a.locator("input")).toHaveCount(0);
    await expect(a.locator("textarea")).toHaveCount(2);
  });

  // ── A2. Typing commits to the model for both fields ──────────────
  test("Section A — typing into both textareas commits values to the model", async ({ page }) => {
    const a = section(page, "a");
    const displayName = a.getByLabel("Display Name");
    const bio = a.getByLabel("Short Bio");

    await displayName.fill("Jane Doe\nProduct designer");
    await bio.fill("Line 1\nLine 2\nLine 3");
    // Blur to flush any pending watch reactions before reading.
    await bio.blur();

    const value = await readValue<{ displayName: string; bio: string }>(page, "a");
    expect(value.displayName).toBe("Jane Doe\nProduct designer");
    expect(value.bio).toBe("Line 1\nLine 2\nLine 3");
  });

  // ── A3. Growing textarea auto-resizes on input ───────────────────
  test("Section A — bio textarea auto-resizes when content grows", async ({ page }) => {
    const bio = section(page, "a").getByLabel("Short Bio");
    const heightOf = async () => {
      const box = await bio.boundingBox();
      return box?.height ?? 0;
    };

    const baseline = await heightOf();
    await bio.fill(Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n"));
    // Allow the resize() rAF/post-input mutation to settle.
    await expect
      .poll(async () => (await heightOf()) - baseline, { timeout: 2000 })
      .toBeGreaterThan(40);

    expect(await heightOf()).toBeGreaterThan(baseline);
  });

  // ── B1. `displayName` baseline — default AsInput, not custom ─────
  test("Section B — `displayName` (no annotation) renders the default AsInput", async ({
    page,
  }) => {
    const b = section(page, "b");
    const displayName = b.getByLabel("Display Name");
    await expect(displayName).toBeVisible();
    // The default AsInput is a plain <input>. The custom growing textarea
    // wraps a <textarea> under a demo-growing-textarea testid. Neither
    // condition below would hold if the global `text` override leaked
    // through, so they're a paired baseline-vs-custom assertion.
    await expect(displayName).toHaveJSProperty("tagName", "INPUT");
    const displayNameTestid = b
      .locator('[data-testid="demo-growing-textarea"]')
      .filter({ has: page.getByLabel("Display Name") });
    await expect(displayNameTestid).toHaveCount(0);
  });

  // ── B2. `bio` opts-in to DemoGrowingTextarea ─────────────────────
  test("Section B — `bio` (@ui.form.type 'bio') renders DemoGrowingTextarea", async ({ page }) => {
    const b = section(page, "b");
    const bioWrapper = b.locator('[data-testid="demo-growing-textarea"]');
    await expect(bioWrapper).toHaveCount(1);

    const bio = b.getByLabel("Bio");
    await bio.fill("Crafting small tools.");
    await bio.blur();

    const value = await readValue<{ bio: string }>(page, "b");
    expect(value.bio).toBe("Crafting small tools.");
  });

  // ── B3. `rating` → DemoStarRating ────────────────────────────────
  test("Section B — `rating` (@ui.form.type 'stars') renders DemoStarRating", async ({ page }) => {
    const stars = section(page, "b").getByTestId("demo-star-rating");
    const buttons = stars.locator("button.demo-star-btn");
    await expect(buttons).toHaveCount(5);

    // The stepper input below the stars overlaps the star buttons' hit
    // boxes in the headless viewport. Dispatch the click directly on the
    // element to bypass the pointer-intercept check (the component is the
    // contract under test, not the layout).
    async function pickStar(index1Based: number) {
      const btn = stars.getByRole("radio", {
        name: `${index1Based} star${index1Based === 1 ? "" : "s"}`,
      });
      await btn.dispatchEvent("click");
    }

    const readRating = () => readValue<{ rating: number | null }>(page, "b");

    // Pick the 4th star → rating: 4.
    await pickStar(4);
    expect((await readRating()).rating).toBe(4);

    // Re-click the active star clears the model (per component contract).
    await pickStar(4);
    expect((await readRating()).rating).toBeNull();

    // Pick the 2nd star → rating: 2.
    await pickStar(2);
    expect((await readRating()).rating).toBe(2);
  });

  // ── B4. `quantity` → DemoNumberStepper via @ui.form.component ────
  test("Section B — `quantity` (@ui.form.component 'stepper') renders DemoNumberStepper", async ({
    page,
  }) => {
    const stepper = section(page, "b").getByTestId("demo-number-stepper");
    const minus = stepper.locator("button", { hasText: "−" });
    const plus = stepper.locator("button", { hasText: "+" });
    const input = stepper.locator("input.demo-stepper-input");
    await expect(input).toHaveCount(1);
    await expect(minus).toHaveCount(1);
    await expect(plus).toHaveCount(1);

    const readQty = () => readValue<{ quantity: number | null }>(page, "b");

    // Default is null (no @meta.default). First "+" lands at 1 because
    // commit(current + 1) with current = (value ?? 0) → 1.
    await plus.click();
    await plus.click();
    await plus.click();
    expect((await readQty()).quantity).toBe(3);

    // "-" twice → 1.
    await minus.click();
    await minus.click();
    expect((await readQty()).quantity).toBe(1);

    // Clamp test: keep pressing "-" until disabled. The component disables
    // the button when current <= 0, so we stop on disabled. Final value: 0.
    for (let i = 0; i < 12; i++) {
      if (await minus.isDisabled()) break;
      await minus.click();
    }
    await expect(minus).toBeDisabled();
    expect((await readQty()).quantity).toBe(0);
  });

  // ── B5. `brandColor` → DemoColorSwatch (palette of 8) ────────────
  test("Section B — `brandColor` (@ui.form.type 'color-swatch') renders DemoColorSwatch", async ({
    page,
  }) => {
    const swatches = section(page, "b")
      .getByTestId("demo-color-swatch")
      .locator("button.demo-swatch");
    await expect(swatches).toHaveCount(8);

    const readColor = () => readValue<{ brandColor: string | null }>(page, "b");

    // Component's palette[2] is "#facc15" (yellow).
    await swatches.nth(2).click();
    expect((await readColor()).brandColor).toBe("#facc15");

    // Pick another swatch → palette[4] = "#0ea5e9" (blue).
    await swatches.nth(4).click();
    expect((await readColor()).brandColor).toBe("#0ea5e9");
  });

  // ── B6–B9. FIXME: `createFieldDef` in packages/ui/src/form/create-form-def.ts
  // skips `@ui.form.type` for array/object/tuple/multi-variant-union kinds, so
  // custom widgets never render. Step 6 addresses; unmark `.fixme` then.

  // ── B6. `tags` → DemoTagInput (Enter/comma/× pill/Backspace) ─────
  test.fixme("Section B — `tags` (@ui.form.type 'tag-input') renders DemoTagInput", async ({
    page,
  }) => {
    const widget = section(page, "b").getByTestId("demo-tag-input");
    const field = widget.locator("input.demo-tag-input-field");
    const readTags = () => readValue<{ tags: string[] | null }>(page, "b");

    // Add three tags via Enter / comma / Enter.
    await field.click();
    await field.pressSequentially("alpha");
    await field.press("Enter");
    await field.pressSequentially("beta");
    await field.press(",");
    await field.pressSequentially("gamma");
    await field.press("Enter");
    expect((await readTags()).tags).toEqual(["alpha", "beta", "gamma"]);

    // Remove the "beta" pill via its × button (aria-label exposes the tag).
    await widget.getByRole("button", { name: "Remove beta" }).click();
    expect((await readTags()).tags).toEqual(["alpha", "gamma"]);

    // Backspace on the empty input strips the trailing pill ("gamma").
    await field.click();
    await expect(field).toHaveValue("");
    await field.press("Backspace");
    expect((await readTags()).tags).toEqual(["alpha"]);
  });

  // ── B7. `address` → DemoAddressCard with 4 nested string fields ──
  test.fixme("Section B — `address` (@ui.form.type 'address-card') renders DemoAddressCard", async ({
    page,
  }) => {
    const card = section(page, "b").getByTestId("demo-address-card");
    await expect(card).toBeVisible();

    await card.getByLabel("Street").fill("221B Baker St");
    await card.getByLabel("City").fill("London");
    await card.getByLabel("ZIP").fill("NW1 6XE");
    await card.getByLabel("Country").fill("UK");

    const value = await readValue<{
      address: { street: string; city: string; zip: string; country: string };
    }>(page, "b");
    expect(value.address).toEqual({
      street: "221B Baker St",
      city: "London",
      zip: "NW1 6XE",
      country: "UK",
    });
  });

  // ── B8. `logoRgb` → DemoRgbPicker (3 range sliders + live swatch) ─
  test.fixme("Section B — `logoRgb` (@ui.form.type 'rgb-picker') renders DemoRgbPicker", async ({
    page,
  }) => {
    const picker = section(page, "b").getByTestId("demo-rgb-picker");
    const sliders = picker.locator('input[type="range"]');
    await expect(sliders).toHaveCount(3);

    // Range inputs commit via 'input' events; `fill` dispatches them.
    await sliders.nth(0).fill("50");
    await sliders.nth(1).fill("100");
    await sliders.nth(2).fill("150");

    const value = await readValue<{ logoRgb: [number, number, number] | null }>(page, "b");
    expect(value.logoRgb).toEqual([50, 100, 150]);

    // Visual: the live preview swatch's background must follow the model.
    // Browsers normalize `rgb(...)` to `rgb(r, g, b)` (with spaces) in the
    // computed style, so the comparison is a string match.
    const swatch = picker.locator(".demo-rgb-swatch");
    await expect(swatch).toHaveCSS("background-color", "rgb(50, 100, 150)");
  });

  // ── B9. `contact` → DemoContactCard variant picker ───────────────
  test.fixme("Section B — `contact` (@ui.form.type 'contact-card') renders DemoContactCard variant picker", async ({
    page,
  }) => {
    const card = section(page, "b").getByTestId("demo-contact-card");
    const variants = card.locator("button.demo-contact-variant");
    const readContact = () => readValue<{ contact: Record<string, string> }>(page, "b");
    await expect(variants).toHaveCount(3);

    // Pick "Email".
    await variants.filter({ hasText: "Email" }).click();
    const emailInput = card.getByLabel("Email Address");
    await expect(emailInput).toBeVisible();
    await emailInput.fill("jane@example.com");
    expect((await readContact()).contact).toEqual({ email: "jane@example.com" });

    // Switch to "Phone" — Email input must be gone, phone input must render.
    await variants.filter({ hasText: "Phone" }).click();
    await expect(card.getByLabel("Email Address")).toHaveCount(0);
    const phoneInput = card.getByLabel("Phone");
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill("+1 555 1234");
    expect((await readContact()).contact).toEqual({ phone: "+1 555 1234" });
  });

  // ── B10. Sanity — page loads without console errors ──────────────
  test("page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      errors.push(String(err));
    });
    // Re-navigate to capture any errors from a clean run (beforeEach
    // already did one navigation but listeners were not attached yet).
    await page.goto("/forms-demo/custom-components");
    await page.waitForLoadState("networkidle");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
