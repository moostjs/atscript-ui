// Section 31 — Nested Collapsible (Company Settings).
//
// Exercises the deeply-nested collapsible-section UX rendered in
// `packages/vue-demo/src/client/pages/forms-demo/nested-collapsible.vue`
// against the `CompanySettings` schema. The form chains REQUIRED nested
// structs five levels deep:
//   companyName (top-level leaf, NOT inside a section)
//   headquarters → country → timezone → dst → reminders
//   contact      (siblings of headquarters)
//   billing      → paymentTerms
//
// Each nested struct renders an `AsCollapsible` (`<details>` chrome) that
// registers itself with a single page-level `AsNestedSectionsStore` (see
// `provideAsNestedSectionsStore` in `nested-collapsible.vue`). The page
// chrome exposes shared "Expand all" / "Collapse all" buttons wired to
// the store.
//
// Key facts confirmed against the runtime:
//   - Default state for every registered section is CLOSED — see
//     `use-as-nested-sections-store.ts` ("**Default state is closed.**").
//   - Sections are native HTML `<details>` (with `<summary>` toggling
//     `open`). Reka-ui is NOT used here. Click on the summary toggles
//     `open` on the parent details and the store stays in sync via the
//     native `toggle` event.
//   - `.as-collapsible-title` ≡ level 1 ; `.as-collapsible-title-nested`
//     ≡ level ≥ 2.
//   - `companyName` lives at the form root → no collapsible wrapper, so
//     it stays visible regardless of expand/collapse state.
//   - `first-validation="on-submit"` is set, so error slots only appear
//     after the user clicks the submit button.
//
// Preview block: `data-testid="nested-collapsible-preview"` — `formData`
// is the `{ value: <domainData> }` wrapper, unwrap `.value`.

import { expect, test, type Locator, type Page } from "../fixtures";

// Selectors — kept as named consts so the "magic" strings have one source
// of truth (and so a vunor rename only requires one edit here).
const SEL_SECTION = "details.as-collapsible-section";
const SEL_OPEN_SECTION_OR_ISLAND = "details:is(.as-collapsible-section, .as-collapsible-island)[open]";
const SEL_SUMMARY = ".as-collapsible-summary";
const SEL_TITLE = ":is(.as-collapsible-title, .as-collapsible-title-nested)";
const SEL_SUBMIT = ".as-submit-btn";
const SEL_ERROR_SLOT = ".as-error-slot";
const SEL_FIELD_LABEL = ".as-field-label";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/nested-collapsible");
  await page.waitForLoadState("networkidle");
  // Wait for hydration — submit button appears after AsForm mounts.
  await expect(form(page).locator(SEL_SUBMIT)).toBeVisible();
}

const form = (page: Page): Locator => page.getByTestId("nested-collapsible-form");

// `formData` is `{ value: <domainData> }` — unwrap `.value` to access the
// real shape.
async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("nested-collapsible-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

// Required-marker asterisk leaks into the accessible name via CSS `::after`.
const LABEL_TAIL = "(\\s*\\*)?";
function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}${LABEL_TAIL}$`);
}

const escapeQuotes = (s: string): string => s.replace(/"/g, '\\"');

// Resolve the `<details>` for a section by its visible title. Matches both
// L1 (`.as-collapsible-title`) and L≥2 (`.as-collapsible-title-nested`).
function sectionByTitle(page: Page, title: string): Locator {
  return form(page)
    .locator(`details:has(> summary ${SEL_TITLE}:text-is("${escapeQuotes(title)}"))`)
    .first();
}

// Read `details.open` via JS property to avoid the HTML-vs-property edge
// case where `:open="false"` still attaches the boolean attribute in
// some browsers.
async function isOpen(details: Locator): Promise<boolean> {
  return details.evaluate((el) => (el as HTMLDetailsElement).open);
}

// Click the summary chrome of a section to toggle it.
async function toggleSection(details: Locator): Promise<void> {
  await details.locator(SEL_SUMMARY).first().click();
}

// Idempotent expand: only toggles if currently closed. Returns when the
// store flushes `open=true` to the DOM.
async function expandIfClosed(details: Locator): Promise<void> {
  if (await isOpen(details)) return;
  await toggleSection(details);
  await expect(details).toHaveJSProperty("open", true);
}

// Convenience: open a chain of sections in order via their titles.
async function expandPath(page: Page, ...titles: string[]): Promise<void> {
  for (const t of titles) {
    await expandIfClosed(sectionByTitle(page, t));
  }
}

// Field locators inside the form by accessible label.
function fieldByLabel(page: Page, label: string): Locator {
  return form(page).getByLabel(labelRegex(label));
}

// Field-label chrome (used when an optional field renders no input control).
function fieldLabelByText(page: Page, label: string): Locator {
  return form(page).locator(SEL_FIELD_LABEL, { hasText: labelRegex(label) });
}

// Assert exactly one `.as-error-slot` carries the given message text.
async function expectErrorSlot(page: Page, hasText: string): Promise<void> {
  await expect(form(page).locator(SEL_ERROR_SLOT, { hasText })).toHaveCount(1);
}

// Submit the form to surface required-field errors on the on-submit path.
async function submit(page: Page): Promise<void> {
  await form(page).locator(SEL_SUBMIT).click();
}

test.describe("Section 31 — nested-collapsible", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Initial render / structure ──────────────────────────────────────

  test("page renders form testid, preview, and Expand/Collapse buttons", async ({ page }) => {
    await expect(form(page)).toBeVisible();
    await expect(page.getByTestId("nested-collapsible-preview")).toBeAttached();
    await expect(page.getByTestId("expand-all-btn")).toBeVisible();
    await expect(page.getByTestId("collapse-all-btn")).toBeVisible();
  });

  test("top-level sections render: Headquarters, Primary contact, Billing & invoicing", async ({
    page,
  }) => {
    await expect(sectionByTitle(page, "Headquarters")).toBeVisible();
    await expect(sectionByTitle(page, "Primary contact")).toBeVisible();
    await expect(sectionByTitle(page, "Billing & invoicing")).toBeVisible();
  });

  test("all collapsible sections start CLOSED (store default = closed)", async ({ page }) => {
    // Every registered section starts collapsed — `use-as-nested-sections-
    // store.ts` only adds IDs to `open` on explicit user interaction.
    const openCount = await form(page).locator(`${SEL_SECTION}[open]`).count();
    expect(openCount).toBe(0);
    // No nested-island sections render until their parent is expanded, so
    // the global "any details[open]" count should also be 0 at this point.
    const anyOpen = await form(page).locator(SEL_OPEN_SECTION_OR_ISLAND).count();
    expect(anyOpen).toBe(0);
  });

  test("companyName is NOT inside a collapsible — visible even when all sections collapsed", async ({
    page,
  }) => {
    // Top-level leaf renders directly in the form grid, not wrapped in a
    // <details>. With all sections collapsed (default state), the input
    // for "Company Name" should be visible.
    await expect(fieldByLabel(page, "Company Name")).toBeVisible();
  });

  // ── Per-section expand / collapse ───────────────────────────────────

  test("Headquarters: clicking summary toggles open; click again toggles back", async ({
    page,
  }) => {
    const hq = sectionByTitle(page, "Headquarters");
    expect(await isOpen(hq)).toBe(false);

    await toggleSection(hq);
    await expect(hq).toHaveJSProperty("open", true);

    await toggleSection(hq);
    await expect(hq).toHaveJSProperty("open", false);
  });

  test("Primary contact and Billing toggle independently of Headquarters", async ({ page }) => {
    const hq = sectionByTitle(page, "Headquarters");
    const contact = sectionByTitle(page, "Primary contact");
    const billing = sectionByTitle(page, "Billing & invoicing");

    await toggleSection(contact);
    await expect(contact).toHaveJSProperty("open", true);
    // Touching Primary contact must not flip Headquarters or Billing.
    expect(await isOpen(hq)).toBe(false);
    expect(await isOpen(billing)).toBe(false);

    await toggleSection(billing);
    await expect(billing).toHaveJSProperty("open", true);
    // Headquarters is still untouched; Primary contact stays open.
    expect(await isOpen(hq)).toBe(false);
    expect(await isOpen(contact)).toBe(true);
  });

  // ── Nested levels ───────────────────────────────────────────────────

  test("Headquarters expanded reveals nested Country subsection (closed by default)", async ({
    page,
  }) => {
    await expandIfClosed(sectionByTitle(page, "Headquarters"));
    const country = sectionByTitle(page, "Country");
    await expect(country).toBeAttached();
    // Country is a nested island; the store starts each registered section
    // closed, so it should NOT auto-open just because its parent did.
    expect(await isOpen(country)).toBe(false);
  });

  test("drill 5 levels deep: HQ → Country → Timezone → DST handling → Reminder rules", async ({
    page,
  }) => {
    const deepChain = ["Headquarters", "Country", "Timezone", "DST handling", "Reminder rules"];
    await expandPath(page, ...deepChain);

    // Confirm every level is open via the DOM property.
    for (const t of deepChain) {
      expect(await isOpen(sectionByTitle(page, t))).toBe(true);
    }

    // L4 leaves: Auto-adjust (checkbox, chromeless), Manual offset (optional
    // number → renders AsNoData "Not set" button until enabled). The optional
    // ones have no input control yet, so assert via the `.as-field-label`
    // chrome rather than `getByLabel`.
    await expect(form(page).getByRole("checkbox", { name: "Auto-adjust" })).toBeVisible();
    await expect(fieldLabelByText(page, "Manual offset \\(minutes\\)")).toBeVisible();

    // L5 leaves: Channel (required select — input rendered), Lead time
    // (optional → "Not set" placeholder).
    const channel = fieldByLabel(page, "Channel");
    await expect(channel).toBeVisible();
    await expect(channel).toHaveJSProperty("tagName", "SELECT");
    await expect(fieldLabelByText(page, "Lead time \\(days\\)")).toBeVisible();
  });

  // ── Expand all / Collapse all ───────────────────────────────────────

  test("Expand all opens every registered section (top + deep) in a single click", async ({
    page,
  }) => {
    // Children mount inside collapsed `<details>` (the browser just hides
    // the body), so they register with the sections store on initial mount
    // — by the time the user clicks Expand all, EVERY nested section is
    // already in the registered set. A single click expands them all at
    // every depth, and the button immediately becomes disabled because
    // `allOpen` === true.
    await page.getByTestId("expand-all-btn").click();
    const allTitles = [
      "Headquarters",
      "Country",
      "Timezone",
      "DST handling",
      "Reminder rules",
      "Primary contact",
      "Billing & invoicing",
      "Payment Terms",
    ];
    for (const t of allTitles) {
      await expect(sectionByTitle(page, t)).toHaveJSProperty("open", true);
    }
    // Button disables once all registered sections are open.
    await expect(page.getByTestId("expand-all-btn")).toBeDisabled();
  });

  test("Collapse all closes every open section (top + deep)", async ({ page }) => {
    // Open a deep chain first so there's something to collapse.
    await expandPath(
      page,
      "Headquarters",
      "Country",
      "Timezone",
      "Primary contact",
      "Billing & invoicing",
    );

    await page.getByTestId("collapse-all-btn").click();

    // Zero `<details>` rendered by AsCollapsible should remain open.
    const openCount = await form(page).locator(SEL_OPEN_SECTION_OR_ISLAND).count();
    expect(openCount).toBe(0);
  });

  test("after Collapse all, top-level companyName input remains visible", async ({ page }) => {
    await expandIfClosed(sectionByTitle(page, "Headquarters"));
    await page.getByTestId("collapse-all-btn").click();
    await expect(fieldByLabel(page, "Company Name")).toBeVisible();
  });

  // ── Hint reactivity at L2 (country.code) ────────────────────────────

  test("country.code: typing 1-letter value surfaces ISO-code hint; correcting clears it", async ({
    page,
  }) => {
    await expandPath(page, "Headquarters", "Country");

    const code = fieldByLabel(page, "ISO Code");
    await expect(code).toBeVisible();

    // One letter → hint appears in the field-shell's `.as-error-slot`
    // (which doubles as the hint container — see `as-field-shell.vue`).
    await code.fill("U");
    await code.blur();
    const hint = form(page).locator(SEL_ERROR_SLOT, { hasText: "Use a 2-letter ISO code" });
    await expect(hint).toBeVisible();

    // Two letters → fn.hint returns "" → slot vanishes.
    await code.fill("US");
    await code.blur();
    await expect(hint).toHaveCount(0);
  });

  // ── Validation at depth ─────────────────────────────────────────────

  test("submit with mostly-empty form surfaces deeply-nested required errors", async ({ page }) => {
    // Fill only the top-level leaf so submit triggers nested validation.
    await fieldByLabel(page, "Company Name").fill("Acme");

    await submit(page);

    // Errors at depth render `.as-error-slot` once validation runs (the
    // form is set to `first-validation="on-submit"`). At L≥2 the error
    // must surface somewhere in the form's error-slot pool — assert by
    // the canonical messages from the schema.
    for (const msg of [
      "Street is required",
      "City is required",
      "ZIP code is required",
      "Country name is required",
      "ISO code is required",
      "Timezone is required",
      "Channel is required",
    ]) {
      await expectErrorSlot(page, msg);
    }
  });

  test("submit auto-expands every ancestor of an erroring field (no need to dig manually)", async ({
    page,
  }) => {
    // The AsForm root has a watcher that, on every error-map change, calls
    // `setOpen(ancestor, true)` for every path between the form root and
    // the erroring field — see `use-as-form.ts`. So a fresh submit with
    // mostly-empty data should open every parent section that contains an
    // error, all the way down to the deepest required leaf
    // (Headquarters → Country → Timezone → DST handling → Reminder rules).
    await fieldByLabel(page, "Company Name").fill("Acme");
    const ancestors = ["Headquarters", "Country", "Timezone", "DST handling", "Reminder rules"];
    // Initially every section starts closed.
    for (const t of ancestors) {
      expect(await isOpen(sectionByTitle(page, t))).toBe(false);
    }

    await submit(page);

    // After submit, the auto-open watcher has expanded every ancestor of
    // a required error path.
    for (const t of ancestors) {
      await expect(sectionByTitle(page, t)).toHaveJSProperty("open", true);
    }
    // No error-count badge on an OPEN section — badges only render while
    // `!isOpen`. Confirm that auto-expand consumed the badge instead of
    // leaving it as a stale chrome element.
    await expect(
      sectionByTitle(page, "Headquarters").locator("> summary .as-collapsible-error-badge"),
    ).toHaveCount(0);
  });

  // ── Form data preview ───────────────────────────────────────────────

  test("filling top-level + deep-nested fields reflects in preview JSON", async ({ page }) => {
    await fieldByLabel(page, "Company Name").fill("Acme");

    // Open Billing → fill currency (top-level inside Billing).
    await expandIfClosed(sectionByTitle(page, "Billing & invoicing"));
    const currency = fieldByLabel(page, "Currency");
    await expect(currency).toHaveJSProperty("tagName", "SELECT");
    await currency.selectOption("USD");

    // Open Payment Terms → fill Due (days).
    await expandIfClosed(sectionByTitle(page, "Payment Terms"));
    const due = fieldByLabel(page, "Due \\(days\\)");
    await due.fill("30");
    await due.blur();

    const preview = await readPreview(page);
    expect(preview.companyName).toBe("Acme");
    const billing = preview.billing as Record<string, unknown>;
    expect(billing.currency).toBe("USD");
    const terms = billing.paymentTerms as Record<string, unknown>;
    expect(terms.dueDays).toBe(30);
  });
});
