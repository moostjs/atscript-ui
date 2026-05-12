// Section 27 — Optional Fields Showcase.
//
// Exercises every supported field type rendered in
// `packages/vue-demo/src/client/pages/forms-demo/optional-fields.vue` against
// the `OptionalFieldsForm` schema. Every field is marked optional and has
// validation constraints wired up so an enabled-but-invalid field surfaces
// errors on submit:
//   - text/email/password/age/bio  → AsInput (with shell + AsNoData empty state)
//   - agreed                       → AsCheckbox (chromeless, no empty state)
//   - country                      → AsSelect  (shell + AsNoData empty state)
//   - priority                     → AsRadio   (hideEmptyPlaceholder, no empty state)
//   - address                      → AsObject  (.as-object-empty-add)
//   - tags                         → AsArray   (.as-object-empty-add)
//   - phones                       → AsArray   (.as-object-empty-add)
//   - coords                       → AsTuple   (.as-object-empty-add)
//
// The preview block under the form exposes `formData` as JSON
// (`data-testid=optional-fields-preview`). `formData` is wrapped as
// `{ value: <domainData> }` so the spec unwraps `.value` everywhere.
//
// Priority note: this is the ONLY e2e test of AsRadio in the suite. Treat
// the priority-radio test as high-value coverage.
//
// Selector quirks (all baked into helpers below):
//   - `.as-no-data` is the click target for optional primitive/select fields
//     (text/email/password/age/bio/country) — it lives inside the field's
//     `.as-default-field` wrapper.
//   - `.as-object-empty-add` is the click target for optional structs /
//     arrays / tuples — `<button>` reads "Add <Title>".
//   - Required marker `*` is rendered via CSS `::after` but appears in
//     Playwright's accessible name → `getByLabel("Email", {exact:true})`
//     misses required fields. Use the `labelRegex()` helper.
//   - Inline `Add <singular>` buttons in arrays have one leading space
//     baked from the template — match with regex tolerant of whitespace.
//   - Per-item Remove is `aria-label="Remove"`; the array/optional clear
//     is `aria-label="Unset <Title>"` / `"Clear <Title>"` — different button.

import { expect, test, type Locator, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/optional-fields");
  await page.waitForLoadState("networkidle");
  // Wait for hydration — the submit button is rendered once AsForm has
  // initialised. After this, the testid-scoped locators are interactable.
  await expect(page.getByTestId("optional-fields-form").locator(".as-submit-btn")).toBeVisible();
}

const section = (page: Page): Locator => page.getByTestId("optional-fields-form");

// `formData` is the `{ value: <domainData> }` wrapper, so the preview JSON's
// top-level key is always `value` — unwrap it here.
async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("optional-fields-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

// Required-marker asterisk is painted via CSS `::after` but surfaces in the
// accessible name, so every label match needs to tolerate ` *` at the end.
const LABEL_TAIL = "(\\s*\\*)?";

// Match a leaf label whose required-marker asterisk is painted via CSS but
// surfaces in the accessible name.
function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}${LABEL_TAIL}$`);
}

// Resolve the `.as-default-field` wrapper for a leaf field by walking up from
// its label text. Scoped to the form so it doesn't bleed into the preview.
function fieldByLabel(page: Page, labelText: string | RegExp): Locator {
  return section(page)
    .locator(".as-default-field", {
      has: page.locator(".as-field-label", {
        hasText: typeof labelText === "string" ? labelRegex(labelText) : labelText,
      }),
    })
    .first();
}

// Click the optional primitive's "Not set / Click to edit" placeholder
// rendered by AsFieldShell → AsNoData. Scoped per-field so we don't hit a
// different field's placeholder.
async function enablePrimitive(page: Page, labelText: string): Promise<void> {
  const wrapper = fieldByLabel(page, labelText);
  await wrapper.locator(".as-no-data, .as-no-data-textarea").click();
}

// Enable an optional primitive AND return its inner input locator. Combines
// the two steps every primitive test does back-to-back.
async function enableAndGetInput(page: Page, labelText: string): Promise<Locator> {
  await enablePrimitive(page, labelText);
  return section(page).getByLabel(labelRegex(labelText));
}

// Click the optional struct/array/tuple's "Add <Title>" empty-state button.
async function enableCollection(page: Page, title: string): Promise<void> {
  await section(page)
    .locator(".as-object-empty-add", { hasText: `Add ${title}` })
    .first()
    .click();
}

// Resolve an open `<details>` collapsible section by its visible title.
// Used for arrays / tuples / objects after enabling.
function arraySection(page: Page, title: string): Locator {
  return section(page).locator(
    `details:has(> summary :is(.as-collapsible-title, .as-collapsible-title-nested):text-is("${title}"))`,
  );
}

async function submit(page: Page): Promise<void> {
  await section(page).locator(".as-submit-btn").click();
}

// Locator for an error-slot containing the given text, scoped to a Page (full
// document) or a Locator (form section, array section, …).
function errorSlot(scope: Page | Locator, text: string): Locator {
  return scope.locator(".as-error-slot", { hasText: text });
}

test.describe("Section 27 — optional-fields", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Initial state ─────────────────────────────────────────────────

  test("page loads with empty form data preview", async ({ page }) => {
    const form = section(page);
    await expect(form).toBeVisible();
    const preview = await readPreview(page);
    // All fields optional, none enabled → `value` is `{}` (JSON.stringify
    // drops undefined keys).
    expect(preview).toEqual({});
  });

  test("initial render shows empty-state affordances for every optional field that has one", async ({
    page,
  }) => {
    const form = section(page);
    // text / email / password / age / bio / country → AsNoData
    // (6 fields render the "Not set / Click to edit" placeholder).
    // address / tags / phones / coords → AsObject/Array/Tuple empty-add
    // (4 fields render the ".as-object-empty-add" placeholder).
    // agreed (chromeless checkbox) and priority (radio with hideEmptyPlaceholder)
    // are NOT counted — they render their input directly with no placeholder.
    await expect(form.locator(".as-no-data, .as-no-data-textarea")).toHaveCount(6);
    await expect(form.locator(".as-object-empty-add")).toHaveCount(4);
  });

  // ── Per-type enable → fill → preview ──────────────────────────────

  test("text: enable → type → preview reflects", async ({ page }) => {
    const input = await enableAndGetInput(page, "Text");
    await expect(input).toBeVisible();
    await input.fill("hi");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.text).toBe("hi");
  });

  test("email: enable → type → preview reflects", async ({ page }) => {
    const input = await enableAndGetInput(page, "Email");
    await input.fill("me@example.com");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.email).toBe("me@example.com");
  });

  test("password: enable → type → preview reflects (input type=password)", async ({ page }) => {
    const input = await enableAndGetInput(page, "Password");
    await expect(input).toHaveAttribute("type", "password");
    await input.fill("secret123");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.password).toBe("secret123");
  });

  test("age (number): enable → type → preview reflects as number", async ({ page }) => {
    const input = await enableAndGetInput(page, "Age");
    await expect(input).toHaveAttribute("type", "number");
    await input.fill("25");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.age).toBe(25);
  });

  test("bio (textarea): enable → type → preview reflects", async ({ page }) => {
    const input = await enableAndGetInput(page, "Bio");
    // Textarea renders via AsInputControl's `<textarea>` branch.
    await expect(input).toHaveJSProperty("tagName", "TEXTAREA");
    await input.fill("Long enough bio");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.bio).toBe("Long enough bio");
  });

  test("agreed (checkbox): toggle → preview reflects boolean", async ({ page }) => {
    // Checkbox is chromeless — renders directly, no empty placeholder.
    // Initial state: indeterminate (`checked=mixed` in the ARIA snapshot
    // because model.value is undefined). `getByRole("checkbox")` works
    // even when `checked` is `mixed` (Playwright's role+name match is
    // independent of the boolean checked state).
    const checkbox = section(page).getByRole("checkbox", { name: "I agree to the terms" });
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    const preview = await readPreview(page);
    expect(preview.agreed).toBe(true);
  });

  test("country (select): enable → pick option → preview reflects", async ({ page }) => {
    const select = await enableAndGetInput(page, "Country \\(select\\)");
    await expect(select).toHaveJSProperty("tagName", "SELECT");
    await select.selectOption("de");
    const preview = await readPreview(page);
    expect(preview.country).toBe("de");
  });

  test("priority (radio): pick option → preview reflects [AsRadio coverage]", async ({ page }) => {
    // AsRadio uses `hideEmptyPlaceholder: true` → renders the radio group
    // inline with no "Add Priority" affordance. The label "Priority (radio)"
    // is wired via `aria-labelledby` (a `<span class="as-field-label">`),
    // not a `<label for=>`, so we can't `getByLabel` the group as a whole —
    // each `<input type="radio">` is wrapped in its own `<label>` with the
    // option text as the accessible name.
    const form = section(page);
    const radiogroup = form.locator('[role="radiogroup"][aria-labelledby]');
    await expect(radiogroup).toBeVisible();
    // Sanity: 3 options rendered.
    await expect(radiogroup.locator('input[type="radio"]')).toHaveCount(3);
    // The label wrapping the radio gives each input its accessible name.
    const mediumRadio = radiogroup.getByLabel("Medium", { exact: true });
    await mediumRadio.check();
    await expect(mediumRadio).toBeChecked();
    const preview = await readPreview(page);
    expect(preview.priority).toBe("medium");
  });

  test("address (object): enable → fill nested fields → preview reflects nested shape", async ({
    page,
  }) => {
    await enableCollection(page, "Address");
    const addr = arraySection(page, "Address");
    await expect(addr).toBeVisible();
    await addr.getByLabel(labelRegex("Street")).fill("742 Evergreen Terrace");
    const city = addr.getByLabel(labelRegex("City"));
    await city.fill("Springfield");
    await city.blur();
    const preview = await readPreview(page);
    const address = preview.address as Record<string, unknown>;
    expect(address).toMatchObject({
      street: "742 Evergreen Terrace",
      city: "Springfield",
    });
  });

  test("tags (string array): enable → seed value → preview reflects ['alpha']", async ({
    page,
  }) => {
    await enableCollection(page, "Tags");
    const tagsArray = arraySection(page, "Tags");
    await expect(tagsArray).toBeVisible();
    // The empty-state add flow seeds the first item automatically — fill it.
    const first = tagsArray.locator("input").first();
    await first.fill("alpha");
    await first.blur();
    const preview = await readPreview(page);
    expect(preview.tags).toEqual(["alpha"]);
  });

  test("phones (object array): enable → fill label + number → preview reflects", async ({
    page,
  }) => {
    await enableCollection(page, "Phone numbers");
    const phones = arraySection(page, "Phone numbers");
    await expect(phones).toBeVisible();
    await phones.getByLabel(labelRegex("Label")).fill("Mobile");
    const number = phones.getByLabel(labelRegex("Number"));
    await number.fill("+1 555 0100");
    await number.blur();
    const preview = await readPreview(page);
    const list = preview.phones as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ label: "Mobile", number: "+1 555 0100" });
  });

  test("coords (tuple): enable → fill both positions → preview reflects [45.5, -122.6]", async ({
    page,
  }) => {
    await enableCollection(page, "Coordinates");
    const coords = arraySection(page, "Coordinates");
    await expect(coords).toBeVisible();
    // Tuple seeds both positions on enable; AsTuple's `positionLabeled`
    // labels them by index (#1, #2 or position labels). Two number inputs.
    const inputs = coords.locator('input[type="number"]');
    await expect(inputs).toHaveCount(2);
    await inputs.nth(0).fill("45.5");
    await inputs.nth(1).fill("-122.6");
    await inputs.nth(1).blur();
    const preview = await readPreview(page);
    expect(preview.coords).toEqual([45.5, -122.6]);
  });

  // ── Validation on submit ──────────────────────────────────────────

  test("submit empty form: no errors surface (all fields optional)", async ({ page }) => {
    await submit(page);
    // Allow the validator to settle. `first-validation="on-submit"` means
    // nothing validates until the click. After the click, optional+unset
    // fields stay quiet.
    await section(page).locator(".as-submit-btn").waitFor({ state: "visible" });
    await expect(page.locator(".as-error-slot")).toHaveCount(0);
    await expect(page.locator(".as-collapsible-error")).toHaveCount(0);
  });

  test("text enabled + empty + submit → 'Text is required'", async ({ page }) => {
    const input = await enableAndGetInput(page, "Text");
    await expect(input).toBeVisible();
    // Leave empty — submit.
    await submit(page);
    await expect(errorSlot(page, "Text is required")).toBeVisible();
  });

  test("password enabled + 3 chars + submit → 'At least 8 characters'", async ({ page }) => {
    const input = await enableAndGetInput(page, "Password");
    await input.fill("abc");
    await input.blur();
    await submit(page);
    await expect(errorSlot(page, "At least 8 characters")).toBeVisible();
  });

  test("age enabled + 10 + submit → 'Must be 18 or older'", async ({ page }) => {
    const input = await enableAndGetInput(page, "Age");
    await input.fill("10");
    await input.blur();
    await submit(page);
    await expect(errorSlot(page, "Must be 18 or older")).toBeVisible();
  });

  test("bio enabled + 3 chars + submit → 'Tell us a bit more (min 10 chars)'", async ({ page }) => {
    const input = await enableAndGetInput(page, "Bio");
    await input.fill("hey");
    await input.blur();
    await submit(page);
    await expect(errorSlot(page, "Tell us a bit more (min 10 chars)")).toBeVisible();
  });

  test("phones enabled + submit without filling required leaves → leaf required errors", async ({
    page,
  }) => {
    // Optional arrays/objects, once enabled, expose their inner required
    // fields to the validator. Phones auto-seeds a first item whose Label
    // and Number are required. Submitting without filling them surfaces
    // per-leaf required errors inside the array.
    await enableCollection(page, "Phone numbers");
    const phones = arraySection(page, "Phone numbers");
    await expect(phones.getByLabel(labelRegex("Label"))).toBeVisible();
    await submit(page);
    await expect(errorSlot(phones, "Label is required")).toBeVisible();
    await expect(errorSlot(phones, "Number is required")).toBeVisible();
  });

  // ── Clear flow ────────────────────────────────────────────────────

  test("text: enable + fill + click clear → returns to placeholder, value absent from preview", async ({
    page,
  }) => {
    await enablePrimitive(page, "Text");
    const input = section(page).getByLabel(labelRegex("Text"));
    await input.fill("temp");
    await input.blur();
    let preview = await readPreview(page);
    expect(preview.text).toBe("temp");

    // Optional-clear button. AsOptionalClear renders aria-label="Unset value"
    // when no `label` prop is forwarded (AsFieldShell binds it without a
    // label). Scope to the text field's wrapper so we don't clear another
    // field. Within the field there's exactly one `.as-field-remove-btn`.
    const wrapper = fieldByLabel(page, "Text");
    await wrapper.locator(".as-field-remove-btn").click();

    // Back to empty-state placeholder.
    await expect(wrapper.locator(".as-no-data")).toBeVisible();
    preview = await readPreview(page);
    expect(preview.text ?? undefined).toBeUndefined();
  });

  test("address: enable + fill + click clear → returns to 'Add Address' placeholder", async ({
    page,
  }) => {
    await enableCollection(page, "Address");
    const addr = arraySection(page, "Address");
    await addr.getByLabel(labelRegex("Street")).fill("123 Main");
    await addr.getByLabel(labelRegex("Street")).blur();
    let preview = await readPreview(page);
    expect((preview.address as Record<string, unknown>).street).toBe("123 Main");

    // AsObject renders `<AsOptionalClear :label="title">` so aria-label is
    // "Unset Address" exact.
    await section(page).getByRole("button", { name: "Unset Address", exact: true }).click();
    // Empty-state add button is back.
    await expect(
      section(page).locator(".as-object-empty-add", { hasText: "Add Address" }),
    ).toBeVisible();
    preview = await readPreview(page);
    expect(preview.address ?? undefined).toBeUndefined();
  });
});
