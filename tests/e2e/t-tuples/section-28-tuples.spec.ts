// Section 28 — Tuples Showcase.
//
// Exercises every AsTuple variant rendered in
// `packages/vue-demo/src/client/pages/forms-demo/tuples.vue` against the
// `TuplesShowcaseForm` schema. Tuple variants:
//   - rgb:      [number, number, number]            (required, unlabeled positions)
//   - coords:   [Latitude, Longitude]               (required, named-type @meta.label
//                                                    + @ui.form.grid.colSpan '4')
//   - origin:   [Latitude, Longitude] | undefined   (optional, same labels)
//   - settings: [string, number, boolean]           (required, mixed types,
//                                                    third position is AsCheckbox)
//
// The preview block under the form exposes `formData` as JSON
// (`data-testid=tuples-preview`). `formData` is wrapped as
// `{ value: <domainData> }` so the spec unwraps `.value` everywhere.
//
// Priority note: this is the ONLY e2e test of AsTuple in the suite.
//
// Selector quirks:
//   - Tuple container is `details.as-collapsible-section` whose summary
//     contains a `.as-collapsible-title` (level 1) or
//     `.as-collapsible-title-nested` (level ≥ 2).
//   - Unlabeled tuple positions render the capitalized type name as the
//     bold base label (`Number`, `String`, `Boolean`) plus a muted
//     `.as-field-label-index` span containing `#1` / `#2` / `#3`.
//   - Labeled positions (named types with `@meta.label`) render only the
//     meta label — no `#N` suffix.
//   - AsCheckbox is `chromeless` — `AsFieldShell` skips its own label
//     rendering; the inline `<label>` next to the checkbox shows the raw
//     `label` prop (lowercase type name `boolean` for unlabeled position).
//     Use `getByRole("checkbox")` with a regex on the name, or scope to
//     the third `.as-default-field` inside the settings tuple.
//   - Optional tuple empty-state: `<button class="as-object-empty-add">`
//     reads `"Add Origin"`.
//   - Optional clear: `aria-label="Unset Origin"` exact.
//   - Required-marker `*` is rendered via CSS `::after` but appears in
//     Playwright's accessible name → labels use `LABEL_TAIL` regex.

import { expect, test, type Locator, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/tuples");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("tuples-form").locator(".as-submit-btn")).toBeVisible();
}

const section = (page: Page): Locator => page.getByTestId("tuples-form");

// `formData` is the `{ value: <domainData> }` wrapper.
async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("tuples-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

// Required-marker asterisk on labels.
const LABEL_TAIL = "(\\s*\\*)?";

function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}${LABEL_TAIL}$`);
}

// Resolve a tuple's `<details>` container by its visible title.
function tupleSection(page: Page, title: string): Locator {
  return section(page).locator(
    `details.as-collapsible-section:has(> summary :is(.as-collapsible-title, .as-collapsible-title-nested):text-is("${title}"))`,
  );
}

async function submit(page: Page): Promise<void> {
  await section(page).locator(".as-submit-btn").click();
}

// Optional `origin` tuple empty-state placeholder button.
function addOriginBtn(page: Page): Locator {
  return section(page).locator(".as-object-empty-add", { hasText: "Add Origin" });
}

// Both labeled positions inside a Latitude/Longitude tuple scope.
function latLng(scope: Locator): { lat: Locator; lng: Locator } {
  return {
    lat: scope.getByLabel(labelRegex("Latitude")),
    lng: scope.getByLabel(labelRegex("Longitude")),
  };
}

test.describe("Section 28 — tuples", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Initial render / structure ──────────────────────────────────────

  test("page renders form testid and preview block", async ({ page }) => {
    const form = section(page);
    await expect(form).toBeVisible();
    await expect(page.getByTestId("tuples-preview")).toBeAttached();
    // RGB / Coordinates / Setting tuple titles all visible; Origin renders
    // as an empty-state placeholder so its details container is absent.
    await expect(tupleSection(page, "RGB color")).toBeVisible();
    await expect(tupleSection(page, "Coordinates")).toBeVisible();
    await expect(tupleSection(page, "Setting tuple")).toBeVisible();
    await expect(addOriginBtn(page)).toBeVisible();
  });

  // ── RGB tuple (required, unlabeled positions) ────────────────────────

  test("rgb: required tuple renders 3 number inputs with #1/#2/#3 position suffix", async ({
    page,
  }) => {
    const rgb = tupleSection(page, "RGB color");
    await expect(rgb).toBeVisible();
    // Three numeric inputs, one per position.
    const inputs = rgb.locator('input[type="number"]');
    await expect(inputs).toHaveCount(3);
    // Each unlabeled position renders an `.as-field-label-index` span with
    // `#1` / `#2` / `#3`. The leading `&nbsp;` baked into the template
    // surfaces as a whitespace prefix in `.textContent`, so use a regex.
    const indexSuffixes = rgb.locator(".as-field-label-index");
    await expect(indexSuffixes).toHaveCount(3);
    await expect(indexSuffixes.nth(0)).toHaveText(/#1/);
    await expect(indexSuffixes.nth(1)).toHaveText(/#2/);
    await expect(indexSuffixes.nth(2)).toHaveText(/#3/);
  });

  test("rgb: required tuple auto-fills on mount → preview.rgb === [0, 0, 0]", async ({ page }) => {
    // AsTuple's `useAsTuple` calls `fillMissing()` in `onMounted` when the
    // field is required. `createFormData` for `number` returns 0, so the
    // initial preview snapshot is `[0, 0, 0]`.
    const preview = await readPreview(page);
    expect(preview.rgb).toEqual([0, 0, 0]);
  });

  test("rgb: fill three positions → preview reflects [255, 128, 64]", async ({ page }) => {
    const rgb = tupleSection(page, "RGB color");
    const inputs = rgb.locator('input[type="number"]');
    await inputs.nth(0).fill("255");
    await inputs.nth(1).fill("128");
    await inputs.nth(2).fill("64");
    await inputs.nth(2).blur();
    const preview = await readPreview(page);
    expect(preview.rgb).toEqual([255, 128, 64]);
  });

  // ── Coordinates tuple (required, labeled positions via named types) ──

  test("coords: positions render with named-type @meta.label (Latitude / Longitude), no #N suffix", async ({
    page,
  }) => {
    const coords = tupleSection(page, "Coordinates");
    await expect(coords).toBeVisible();
    const latLabel = coords.locator(".as-field-label", { hasText: labelRegex("Latitude") });
    const lngLabel = coords.locator(".as-field-label", { hasText: labelRegex("Longitude") });
    await expect(latLabel).toHaveCount(1);
    await expect(lngLabel).toHaveCount(1);
    // Labeled positions do NOT get the muted `#N` suffix span.
    await expect(coords.locator(".as-field-label-index")).toHaveCount(0);
  });

  test("coords: Latitude + Longitude render side-by-side (colSpan 4 each)", async ({ page }) => {
    // `@ui.form.grid.colSpan '4'` on each named type → both leaves occupy
    // one third of the form-grid row. Inputs share the same `y` baseline
    // and Longitude sits to the right of Latitude.
    const { lat, lng } = latLng(tupleSection(page, "Coordinates"));
    const latBox = await lat.boundingBox();
    const lngBox = await lng.boundingBox();
    expect(latBox && lngBox).toBeTruthy();
    expect(Math.abs(latBox!.y - lngBox!.y)).toBeLessThanOrEqual(2);
    expect(lngBox!.x).toBeGreaterThan(latBox!.x);
  });

  test("coords: type 45.5 / -122.6 → preview.coords === [45.5, -122.6]", async ({ page }) => {
    const { lat, lng } = latLng(tupleSection(page, "Coordinates"));
    await lat.fill("45.5");
    await lng.fill("-122.6");
    await lng.blur();
    const preview = await readPreview(page);
    expect(preview.coords).toEqual([45.5, -122.6]);
  });

  // ── Origin tuple (optional, labeled positions) ───────────────────────

  test("origin: initial state renders 'Add Origin' empty placeholder, preview.origin absent", async ({
    page,
  }) => {
    await expect(addOriginBtn(page)).toBeVisible();
    const preview = await readPreview(page);
    expect(preview.origin ?? undefined).toBeUndefined();
  });

  test("origin: clicking 'Add Origin' reveals Latitude + Longitude inputs", async ({ page }) => {
    await addOriginBtn(page).click();
    const origin = tupleSection(page, "Origin");
    await expect(origin).toBeVisible();
    const { lat, lng } = latLng(origin);
    await expect(lat).toBeVisible();
    await expect(lng).toBeVisible();
    // Tuple seeds both positions with the default value (0 for number).
    const preview = await readPreview(page);
    expect(preview.origin).toEqual([0, 0]);
  });

  test("origin: fill values → preview.origin reflects [40.7, -74.0]", async ({ page }) => {
    await addOriginBtn(page).click();
    const { lat, lng } = latLng(tupleSection(page, "Origin"));
    await lat.fill("40.7");
    await lng.fill("-74.0");
    await lng.blur();
    const preview = await readPreview(page);
    expect(preview.origin).toEqual([40.7, -74]);
  });

  test("origin: clicking 'Unset Origin' returns to empty placeholder, preview.origin absent", async ({
    page,
  }) => {
    await addOriginBtn(page).click();
    const { lat } = latLng(tupleSection(page, "Origin"));
    await lat.fill("40.7");
    await lat.blur();
    let preview = await readPreview(page);
    expect((preview.origin as number[])[0]).toBe(40.7);

    // AsTuple renders `<AsArrayClearBtn :optional :label="title">` →
    // aria-label="Unset Origin" exact.
    await section(page).getByRole("button", { name: "Unset Origin", exact: true }).click();
    await expect(addOriginBtn(page)).toBeVisible();
    preview = await readPreview(page);
    expect(preview.origin ?? undefined).toBeUndefined();
  });

  // ── Settings tuple (required, mixed types [string, number, boolean]) ──

  test("settings: renders text input + number input + checkbox in order", async ({ page }) => {
    const settings = tupleSection(page, "Setting tuple");
    await expect(settings).toBeVisible();
    // Position 1: text input. Position 2: number input. Position 3: checkbox.
    await expect(settings.locator('input[type="text"]')).toHaveCount(1);
    await expect(settings.locator('input[type="number"]')).toHaveCount(1);
    await expect(settings.locator('input[type="checkbox"]')).toHaveCount(1);
  });

  test("settings: auto-fills on mount → preview.settings === ['', 0, false]", async ({ page }) => {
    // `createFormData` defaults: "" for string, 0 for number, false for boolean.
    const preview = await readPreview(page);
    expect(preview.settings).toEqual(["", 0, false]);
  });

  test("settings: fill string 'alpha', number 42, toggle checkbox → preview reflects", async ({
    page,
  }) => {
    const settings = tupleSection(page, "Setting tuple");
    const text = settings.locator('input[type="text"]');
    const number = settings.locator('input[type="number"]');
    const check = settings.locator('input[type="checkbox"]');
    await text.fill("alpha");
    await number.fill("42");
    await check.check();
    await check.blur();
    const preview = await readPreview(page);
    expect(preview.settings).toEqual(["alpha", 42, true]);
  });

  // ── Submit / validation ─────────────────────────────────────────────

  test("submit immediately after load: required tuples auto-filled → no error slots", async ({
    page,
  }) => {
    // All required tuples (rgb, coords, settings) auto-fill on mount with
    // primitive defaults; `origin` is optional and absent. Submitting
    // before any user edit should surface no validation errors.
    await submit(page);
    await expect(page.locator(".as-error-slot")).toHaveCount(0);
    await expect(page.locator(".as-collapsible-error")).toHaveCount(0);
  });

  test("submit after filling all required tuples: no error slots surface", async ({ page }) => {
    // Fill RGB.
    const rgb = tupleSection(page, "RGB color");
    const rgbInputs = rgb.locator('input[type="number"]');
    await rgbInputs.nth(0).fill("12");
    await rgbInputs.nth(1).fill("34");
    await rgbInputs.nth(2).fill("56");

    // Fill Coordinates.
    const { lat, lng } = latLng(tupleSection(page, "Coordinates"));
    await lat.fill("10");
    await lng.fill("20");

    // Fill Settings.
    const settings = tupleSection(page, "Setting tuple");
    await settings.locator('input[type="text"]').fill("hello");
    await settings.locator('input[type="number"]').fill("7");

    await submit(page);
    await expect(page.locator(".as-error-slot")).toHaveCount(0);
    await expect(page.locator(".as-collapsible-error")).toHaveCount(0);

    // Sanity: preview reflects the typed values.
    const preview = await readPreview(page);
    expect(preview.rgb).toEqual([12, 34, 56]);
    expect(preview.coords).toEqual([10, 20]);
    expect((preview.settings as unknown[])[0]).toBe("hello");
    expect((preview.settings as unknown[])[1]).toBe(7);
  });
});
