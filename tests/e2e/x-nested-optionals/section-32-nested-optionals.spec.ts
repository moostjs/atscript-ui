// Section 32 — Nested Optional Structs.
//
// Exercises the cascading optional-struct UX rendered in
// `packages/vue-demo/src/client/pages/forms-demo/nested-optionals.vue`
// against the `NestedOptionalsForm` schema. Every level except the root
// is optional, so the user has to click "Add <Label>" once per layer to
// reveal the next one:
//
//   (root)
//     name                    required (renders directly)
//     address?     L1 optional struct  → reveals geo? placeholder
//       geo?       L2 optional struct  → reveals precision? placeholder
//         precision?  L3 optional struct → reveals audit? placeholder
//           audit?    L4 optional struct → reveals timestamps? placeholder
//             timestamps?  L5 optional struct (terminal)
//     notes?       top-level optional textarea (independent of address chain)
//
// Each L≥1 layer renders an `AsObject` whose empty state is the
// `.as-object-empty-add` button ("Add <Label>"). Clicking it sets the
// optional model to a fresh struct, the collapsible mounts open and
// `useAsOptionalAddFlow` focuses the first new input inside it.
//
// Chrome alternation: per the form-collapsible system,
// `.as-collapsible-title` ≡ level 1 (rendered as a section card) and
// `.as-collapsible-title-nested` ≡ level ≥ 2 (rendered as a nested
// island). Address (L1) gets the section chrome; Geo / Precision /
// Audit / Timestamps (L2-L5) all get the nested-island chrome.
//
// Selector quirks (see Section 27 / 31 for the original write-ups):
//   - Required-marker `*` leaks into the accessible name via CSS
//     `::after`, so every label match tolerates `(\s*\*)?` at the end.
//   - `.as-object-empty-add` is the click target for revealing any
//     optional struct in this page. Text reads "Add <Label>".
//   - Optional clear button is `aria-label="Unset <Label>"` exact when
//     a label is forwarded (AsObject forwards `title`); on the field
//     shell (text inputs) it falls back to `aria-label="Unset value"`
//     and the only stable target inside the wrapper is the
//     `.as-field-remove-btn`.
//
// Preview block: `data-testid="nested-optionals-preview"` — `formData`
// is the `{ value: <domainData> }` wrapper, unwrap `.value`.

import { expect, test, type Locator, type Page } from "../fixtures";

const SEL_SUBMIT = ".as-submit-btn";
const SEL_ERROR_SLOT = ".as-error-slot";
const SEL_EMPTY_ADD = ".as-object-empty-add";
const SEL_NO_DATA = ".as-no-data, .as-no-data-textarea";
const SEL_FIELD_LABEL = ".as-field-label";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/nested-optionals");
  await page.waitForLoadState("networkidle");
  // Wait for hydration — submit button appears once AsForm mounts.
  await expect(form(page).locator(SEL_SUBMIT)).toBeVisible();
}

const form = (page: Page): Locator => page.getByTestId("nested-optionals-form");

async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("nested-optionals-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

// Required-marker asterisk leaks into the accessible name via CSS `::after`.
const LABEL_TAIL = "(\\s*\\*)?";
function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}${LABEL_TAIL}$`);
}

const escapeQuotes = (s: string): string => s.replace(/"/g, '\\"');

// Resolve the `.as-object-empty-add` button for an optional struct by its
// "Add <Label>" text. Scoped to the form so it doesn't bleed into the
// preview or other pages.
function emptyAddButton(page: Page, label: string): Locator {
  return form(page)
    .locator(SEL_EMPTY_ADD, { hasText: `Add ${label}` })
    .first();
}

// Resolve the open `<details>` for a revealed optional struct by its
// visible title. Matches both L1 (`.as-collapsible-title`) and L≥2
// (`.as-collapsible-title-nested`).
function sectionByTitle(page: Page, title: string): Locator {
  return form(page)
    .locator(
      `details:has(> summary :is(.as-collapsible-title, .as-collapsible-title-nested):text-is("${escapeQuotes(title)}"))`,
    )
    .first();
}

function fieldByLabel(page: Page, labelText: string): Locator {
  return form(page).getByLabel(labelRegex(labelText));
}

// Resolve the `.as-default-field` wrapper for a leaf by its label text —
// used when the leaf is optional and renders an `.as-no-data` placeholder
// instead of an input (so `getByLabel` would miss it).
function fieldWrapperByLabel(page: Page, labelText: string): Locator {
  return form(page)
    .locator(".as-default-field", {
      has: page.locator(SEL_FIELD_LABEL, { hasText: labelRegex(labelText) }),
    })
    .first();
}

async function submit(page: Page): Promise<void> {
  await form(page).locator(SEL_SUBMIT).click();
}

async function expectErrorSlot(page: Page, hasText: string): Promise<void> {
  await expect(form(page).locator(SEL_ERROR_SLOT, { hasText })).toHaveCount(1);
}

// Convenience: click "Add <Label>" and wait for the section to mount open.
async function addAndOpen(page: Page, label: string): Promise<void> {
  await emptyAddButton(page, label).click();
  await expect(sectionByTitle(page, label)).toHaveJSProperty("open", true);
}

// Open the full L1-L5 chain in order. Each Add reveals the next placeholder.
async function openFullChain(page: Page): Promise<void> {
  await addAndOpen(page, "Address");
  await addAndOpen(page, "Geo");
  await addAndOpen(page, "Precision");
  await addAndOpen(page, "Audit");
  await addAndOpen(page, "Timestamps");
}

// Click the optional clear button for a struct (AsObject forwards `title`
// so `aria-label="Unset <Label>"` is exact).
async function unsetOptional(page: Page, label: string): Promise<void> {
  await form(page)
    .getByRole("button", { name: `Unset ${label}`, exact: true })
    .click();
}

// Assert a labelled input is NOT mounted (used to verify chain collapse
// and that deeper levels haven't been revealed yet).
async function expectNotMounted(page: Page, label: string): Promise<void> {
  await expect(form(page).getByLabel(labelRegex(label))).toHaveCount(0);
}

// Fill a labelled input by visible label. Tolerates the required-asterisk tail.
async function fillLabel(page: Page, label: string, value: string): Promise<void> {
  await fieldByLabel(page, label).fill(value);
}

test.describe("Section 32 — nested-optionals", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Initial render / structure ────────────────────────────────────

  test("page renders form testid, preview block, and submit button", async ({ page }) => {
    await expect(form(page)).toBeVisible();
    await expect(page.getByTestId("nested-optionals-preview")).toBeAttached();
    await expect(form(page).locator(SEL_SUBMIT)).toBeVisible();
  });

  test("initial render: Profile Name input visible; Address / Notes empty-state placeholders only", async ({
    page,
  }) => {
    await expect(fieldByLabel(page, "Profile Name")).toBeVisible();
    // Top-level Address (L1) renders as "Add Address" placeholder.
    await expect(emptyAddButton(page, "Address")).toBeVisible();
    // Deeper labels are NOT in the DOM yet — Geo / Precision / Audit /
    // Timestamps only mount once Address is revealed.
    await expect(form(page).locator(SEL_EMPTY_ADD, { hasText: "Add Geo" })).toHaveCount(0);
    await expect(form(page).locator(SEL_EMPTY_ADD, { hasText: "Add Precision" })).toHaveCount(0);
    // No nested input controls before the first Add click.
    await expectNotMounted(page, "Street");
    await expectNotMounted(page, "Latitude");
    await expectNotMounted(page, "Radius \\(m\\)");
  });

  test("initial preview JSON is minimal — only top-level required keys", async ({ page }) => {
    const preview = await readPreview(page);
    // `name` may be present as empty-string or absent depending on the
    // form initializer; either way, no optional keys are populated.
    expect(preview.address ?? undefined).toBeUndefined();
    expect(preview.notes ?? undefined).toBeUndefined();
    // Sanity: no stray optional descendants leaked into the JSON.
    expect(JSON.stringify(preview)).not.toMatch(/geo|precision|audit|timestamps/);
  });

  // ── Cascading Add — one level at a time ───────────────────────────

  test("L1: Add Address reveals street/city inputs + ZIP no-data placeholder + 'Add Geo'", async ({
    page,
  }) => {
    await addAndOpen(page, "Address");
    // Required leaves render their input directly.
    await expect(fieldByLabel(page, "Street")).toBeVisible();
    await expect(fieldByLabel(page, "City")).toBeVisible();
    // ZIP is optional → renders an AsNoData "Not set / Click to edit"
    // placeholder, not an input. Assert via the field-label chrome.
    await expect(fieldWrapperByLabel(page, "ZIP").locator(SEL_NO_DATA)).toBeVisible();
    // Geo is now mounted as the next-level empty-state placeholder.
    await expect(emptyAddButton(page, "Geo")).toBeVisible();
    // No deeper inputs revealed yet.
    await expectNotMounted(page, "Latitude");
  });

  test("Add Address auto-focuses the first new input (Street)", async ({ page }) => {
    // `useAsOptionalAddFlow` runs the toggle inside `focusNewFocusableAfter`,
    // which queries focusables from the just-mounted subtree and focuses
    // the first one. With the Address payload (street, city, zip, geo
    // placeholder) the first focusable is the Street `<input>`.
    await emptyAddButton(page, "Address").click();
    await expect(sectionByTitle(page, "Address")).toHaveJSProperty("open", true);
    await expect(fieldByLabel(page, "Street")).toBeFocused();
  });

  test("L2: Add Geo reveals lat/lng inputs + 'Add Precision' placeholder", async ({ page }) => {
    await addAndOpen(page, "Address");
    await addAndOpen(page, "Geo");
    await expect(fieldByLabel(page, "Latitude")).toBeVisible();
    await expect(fieldByLabel(page, "Longitude")).toBeVisible();
    await expect(emptyAddButton(page, "Precision")).toBeVisible();
    await expectNotMounted(page, "Radius \\(m\\)");
  });

  test("L3: Add Precision reveals radiusM + Source no-data placeholder + 'Add Audit'", async ({
    page,
  }) => {
    await addAndOpen(page, "Address");
    await addAndOpen(page, "Geo");
    await addAndOpen(page, "Precision");
    await expect(fieldByLabel(page, "Radius \\(m\\)")).toBeVisible();
    // Source is optional → no-data placeholder, not a `<select>`, until the
    // user clicks to enable it.
    await expect(fieldWrapperByLabel(page, "Source").locator(SEL_NO_DATA)).toBeVisible();
    await expect(emptyAddButton(page, "Audit")).toBeVisible();
  });

  test("L4: Add Audit reveals capturedBy + Notes no-data placeholder + 'Add Timestamps'", async ({
    page,
  }) => {
    await addAndOpen(page, "Address");
    await addAndOpen(page, "Geo");
    await addAndOpen(page, "Precision");
    await addAndOpen(page, "Audit");
    // Captured by is required → its input renders directly.
    await expect(fieldByLabel(page, "Captured by")).toBeVisible();
    // Notes is optional → AsNoData placeholder (textarea variant).
    await expect(fieldWrapperByLabel(page, "Notes").locator(SEL_NO_DATA)).toBeVisible();
    await expect(emptyAddButton(page, "Timestamps")).toBeVisible();
  });

  test("L5: Add Timestamps reveals created input + Updated no-data — full depth-5 chain assembled", async ({
    page,
  }) => {
    await openFullChain(page);
    // Created is required → input visible.
    await expect(fieldByLabel(page, "Created \\(ISO\\)")).toBeVisible();
    // Updated is optional → no-data placeholder.
    await expect(fieldWrapperByLabel(page, "Updated \\(ISO\\)").locator(SEL_NO_DATA)).toBeVisible();
    // No more "Add X" beyond timestamps inside the address chain.
    await expect(sectionByTitle(page, "Timestamps").locator(SEL_EMPTY_ADD)).toHaveCount(0);
  });

  // ── Section vs island chrome alternation ──────────────────────────

  test("L1 (Address) uses .as-collapsible-title; L≥2 (Geo/Precision/...) uses .as-collapsible-title-nested", async ({
    page,
  }) => {
    await openFullChain(page);
    // L1 lives under `.as-collapsible-title` (section chrome).
    await expect(
      sectionByTitle(page, "Address").locator("> summary .as-collapsible-title"),
    ).toHaveCount(1);
    await expect(
      sectionByTitle(page, "Address").locator("> summary .as-collapsible-title-nested"),
    ).toHaveCount(0);
    // L2..L5 all live under `.as-collapsible-title-nested` (island chrome).
    for (const label of ["Geo", "Precision", "Audit", "Timestamps"]) {
      await expect(
        sectionByTitle(page, label).locator("> summary .as-collapsible-title-nested"),
      ).toHaveCount(1);
      await expect(
        sectionByTitle(page, label).locator("> summary .as-collapsible-title"),
      ).toHaveCount(0);
    }
  });

  // ── Fill at depth — preview reflection ────────────────────────────

  test("fill leaves at every depth → preview JSON reflects each nested path", async ({ page }) => {
    await openFullChain(page);
    await fillLabel(page, "Profile Name", "Acme");
    await fillLabel(page, "Street", "123 Main");
    await fillLabel(page, "Latitude", "45.5");
    await fillLabel(page, "Longitude", "-122.6");
    await fillLabel(page, "Radius \\(m\\)", "10");
    // Source is optional → click its no-data placeholder to enable.
    await fieldWrapperByLabel(page, "Source").locator(SEL_NO_DATA).click();
    await fieldByLabel(page, "Source").selectOption("gps");
    await fillLabel(page, "Captured by", "jane@acme.com");
    const created = fieldByLabel(page, "Created \\(ISO\\)");
    await created.fill("2026-01-15");
    await created.blur();

    const preview = await readPreview(page);
    expect(preview.name).toBe("Acme");
    const address = preview.address as Record<string, unknown>;
    expect(address.street).toBe("123 Main");
    const geo = address.geo as Record<string, unknown>;
    expect(geo.lat).toBe(45.5);
    expect(geo.lng).toBe(-122.6);
    const precision = geo.precision as Record<string, unknown>;
    expect(precision.radiusM).toBe(10);
    expect(precision.source).toBe("gps");
    const audit = precision.audit as Record<string, unknown>;
    expect(audit.capturedBy).toBe("jane@acme.com");
    const timestamps = audit.timestamps as Record<string, unknown>;
    expect(timestamps.created).toBe("2026-01-15");
  });

  // ── Constraint validation at depth ────────────────────────────────

  test("L2 constraint: lat=200 + submit → 'Latitude must be ≤ 90' surfaces in form errors", async ({
    page,
  }) => {
    await addAndOpen(page, "Address");
    await addAndOpen(page, "Geo");
    // Fill street to silence the L1 required-error; we only care that
    // the L2 constraint surfaces.
    await fillLabel(page, "Street", "123 Main");
    const lat = fieldByLabel(page, "Latitude");
    await lat.fill("200");
    await lat.blur();
    // Longitude is required at L2 too — fill a valid value.
    await fillLabel(page, "Longitude", "0");
    await submit(page);
    await expectErrorSlot(page, "Latitude must be ≤ 90");
  });

  test("L4 required: capturedBy left empty + submit → 'Captured-by is required'", async ({
    page,
  }) => {
    await addAndOpen(page, "Address");
    await addAndOpen(page, "Geo");
    await addAndOpen(page, "Precision");
    await addAndOpen(page, "Audit");
    // Fill ancestors' required leaves so only the L4 required error fires.
    await fillLabel(page, "Street", "123 Main");
    await fillLabel(page, "City", "SF");
    await fillLabel(page, "Latitude", "45");
    await fillLabel(page, "Longitude", "-122");
    await fillLabel(page, "Radius \\(m\\)", "10");
    // Leave Captured by empty — submit.
    await submit(page);
    await expectErrorSlot(page, "Captured-by is required");
  });

  test("L5 required: created left empty + submit → 'Created timestamp is required'", async ({
    page,
  }) => {
    await openFullChain(page);
    // Fill every ancestor required leaf — only the L5 created error fires.
    await fillLabel(page, "Profile Name", "Acme");
    await fillLabel(page, "Street", "123 Main");
    await fillLabel(page, "City", "SF");
    await fillLabel(page, "Latitude", "45");
    await fillLabel(page, "Longitude", "-122");
    await fillLabel(page, "Radius \\(m\\)", "10");
    await fillLabel(page, "Captured by", "jane@acme.com");
    // Leave Created empty — submit.
    await submit(page);
    await expectErrorSlot(page, "Created timestamp is required");
  });

  // ── Clear / unset cascade ─────────────────────────────────────────

  test("Unset Address: full chain collapses; preview address absent", async ({ page }) => {
    await openFullChain(page);
    await fillLabel(page, "Street", "123 Main");
    await fillLabel(page, "Latitude", "45");
    await fillLabel(page, "Longitude", "0");
    await fillLabel(page, "Radius \\(m\\)", "10");
    await fillLabel(page, "Captured by", "jane@acme.com");
    let preview = await readPreview(page);
    expect(preview.address).toBeTruthy();

    // Top-level optional clear — aria-label="Unset Address" exact.
    await unsetOptional(page, "Address");

    // Back to "Add Address" empty-state placeholder.
    await expect(emptyAddButton(page, "Address")).toBeVisible();
    // No deeper labels remain mounted.
    await expectNotMounted(page, "Latitude");
    await expectNotMounted(page, "Radius \\(m\\)");
    preview = await readPreview(page);
    expect(preview.address ?? undefined).toBeUndefined();
  });

  test("re-Add Address after clear starts empty — no residual chain", async ({ page }) => {
    await openFullChain(page);
    await fillLabel(page, "Street", "123 Main");
    await fillLabel(page, "Latitude", "45");
    await fillLabel(page, "Longitude", "0");

    await unsetOptional(page, "Address");
    await expect(emptyAddButton(page, "Address")).toBeVisible();

    await addAndOpen(page, "Address");
    // Geo placeholder should be back to empty-state; lat input is NOT
    // mounted, so the chain is genuinely fresh.
    await expect(emptyAddButton(page, "Geo")).toBeVisible();
    await expectNotMounted(page, "Latitude");
    const street = fieldByLabel(page, "Street");
    await expect(street).toBeVisible();
    await expect(street).toHaveValue("");
    const preview = await readPreview(page);
    const address = preview.address as Record<string, unknown> | undefined;
    expect(address).toBeTruthy();
    expect(address?.geo ?? undefined).toBeUndefined();
  });

  test("Unset Precision (L3): L1/L2 stay filled; L3+ cleared in preview", async ({ page }) => {
    await openFullChain(page);
    await fillLabel(page, "Street", "123 Main");
    await fillLabel(page, "Latitude", "45");
    await fillLabel(page, "Longitude", "-122");
    await fillLabel(page, "Radius \\(m\\)", "10");
    await fillLabel(page, "Captured by", "jane@acme.com");

    // Mid-level optional clear on Precision (L3).
    await unsetOptional(page, "Precision");

    // L1 / L2 inputs still mounted with their values.
    await expect(fieldByLabel(page, "Street")).toHaveValue("123 Main");
    await expect(fieldByLabel(page, "Latitude")).toHaveValue("45");
    // L3+ inputs gone; Precision is back to its empty-state placeholder.
    await expect(emptyAddButton(page, "Precision")).toBeVisible();
    await expectNotMounted(page, "Radius \\(m\\)");
    await expectNotMounted(page, "Captured by");

    const preview = await readPreview(page);
    const address = preview.address as Record<string, unknown>;
    const geo = address.geo as Record<string, unknown>;
    expect(geo.lat).toBe(45);
    expect(geo.lng).toBe(-122);
    expect(geo.precision ?? undefined).toBeUndefined();
  });
});
