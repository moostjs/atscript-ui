// Section 30 — Grid Layout Showcase.
//
// Exercises the form grid layout system rendered at
// `/forms-demo/grid-layout` against the `GridLayoutForm` schema. Unlike
// every other forms-demo spec, this one assertion-set is dominated by
// **geometry checks** via `locator.boundingBox()` — we're verifying the
// 12-column grid, two-arg responsive col/row span, aliases, and the
// nested-grid container-query stacking behaviour, NOT the field values.
//
// Schema highlights:
//   - title                            → no grid annotation → full row
//   - firstName / lastName             → colSpan '6'  (side-by-side)
//   - city / state / zip               → colSpan '4'  (3 across one row)
//   - email (alias 'half'  = 6)        → half-width
//   - country (alias 'third' = 4)      → third-width
//   - phone (responsive)               → colSpan '6', '12'  (desktop 6,
//                                                            narrow 12)
//   - mobile                           → colSpan '6'
//   - bio                              → colSpan '6' + rowSpan '2'
//   - nickname / website               → colSpan '6'  (stack into bio's
//                                                     right column)
//   - discount                         → colSpan '4', '6'  (desktop third,
//                                                           narrow half)
//   - address?                         → optional struct colSpan '6';
//                                        inner grid stacks because the
//                                        inner container is < 480px
//   - phones?                          → optional array; each item full-
//                                        width; inside row: label '4' +
//                                        number '8'
//
// Narrow breakpoint:
//   The `as-narrow:` variant is a CSS container-query against the
//   `as-form-grid`'s inline size (`max-width: 480px`), NOT the viewport.
//   Setting MOBILE_VIEWPORT (390px) shrinks the outer container under
//   480px so the narrow branch resolves.
//
// Preview block: `data-testid="grid-layout-preview"` — `formData` is the
// `{ value: <domainData> }` wrapper, unwrap `.value`.

import { expect, test, type Locator, type Page } from "../fixtures";
import { setDesktopViewport, setMobileViewport } from "../helpers";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/grid-layout");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("grid-layout-form").locator(".as-submit-btn")).toBeVisible();
}

const section = (page: Page): Locator => page.getByTestId("grid-layout-form");

// The top-level grid container. AsObject renders `<div class="as-form-grid">`
// as the immediate iteration body — that's the box every colSpan is
// measured against.
const formGrid = (page: Page): Locator => section(page).locator(".as-form-grid").first();

async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("grid-layout-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

const LABEL_TAIL = "(\\s*\\*)?";
function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}${LABEL_TAIL}$`);
}

// Geometry tolerances. UnoCSS computes col-span as a fraction of an integer
// 12 — with a 32px container + variable gap we can see 4-6 px of slop in
// both alignment and width, so start permissive.
const TOL_Y = 6;
const TOL_RATIO = 0.06;

type Box = { x: number; y: number; width: number; height: number };

async function box(loc: Locator): Promise<Box> {
  const b = await loc.boundingBox();
  if (!b) throw new Error("no bounding box");
  return b;
}

// Resolve the `.as-default-field` wrapper for a leaf field by walking up
// from its label text. Scoped to the form so it doesn't bleed into the
// preview. This is the wrapper that AsField stamps the grid classes on,
// so its bounding box reflects the col-span / row-span footprint.
function fieldByLabel(page: Page, labelText: string | RegExp): Locator {
  return fieldByLabelScoped(section(page), labelText);
}

// Same as fieldByLabel but scoped to a sub-section (e.g. an open
// `<details>` collapsible). Resolve the input via accessible name, then
// walk up to its nearest `.as-default-field` ancestor — that's the
// wrapper AsField stamps the grid classes on, so its bounding box
// reflects the col-span / row-span footprint.
function fieldByLabelScoped(scope: Locator, labelText: string | RegExp): Locator {
  const re = typeof labelText === "string" ? labelRegex(labelText) : labelText;
  return scope
    .getByLabel(re)
    .first()
    .locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' as-default-field ')][1]",
    );
}

// Click the optional struct/array's "Add <Title>" empty-state button.
async function enableCollection(page: Page, title: string): Promise<void> {
  await section(page)
    .locator(".as-object-empty-add", { hasText: `Add ${title}` })
    .first()
    .click();
}

// Resolve an open `<details>` collapsible section by its visible title.
function arraySection(page: Page, title: string): Locator {
  return section(page).locator(
    `details:has(> summary :is(.as-collapsible-title, .as-collapsible-title-nested):text-is("${title}"))`,
  );
}

// Geometry assertions. Tolerances stay TOL_Y / TOL_RATIO — these helpers
// only collapse repetition, never tighten the bounds.
function expectSameRow(a: Box, b: Box): void {
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(TOL_Y);
}
function expectRightOf(left: Box, right: Box): void {
  expect(right.x).toBeGreaterThan(left.x);
}
function expectFraction(field: Box, grid: Box, fraction: number): void {
  expect(Math.abs(field.width / grid.width - fraction)).toBeLessThanOrEqual(TOL_RATIO);
}

test.describe("Section 30 — grid-layout", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Initial render / structure ──────────────────────────────────────

  test("page renders form testid and preview block", async ({ page }) => {
    await setDesktopViewport(page);
    await expect(section(page)).toBeVisible();
    await expect(page.getByTestId("grid-layout-preview")).toBeAttached();
    await expect(formGrid(page)).toBeVisible();
  });

  // ── Desktop layout ──────────────────────────────────────────────────

  test("title: no grid annotation → full-row width on desktop", async ({ page }) => {
    await setDesktopViewport(page);
    const grid = await box(formGrid(page));
    const title = await box(fieldByLabel(page, "Title"));
    // Full-row width === grid container width within tolerance.
    expectFraction(title, grid, 1);
    // First name should sit on a different row, strictly below title.
    const firstName = await box(fieldByLabel(page, "First name"));
    expect(firstName.y).toBeGreaterThan(title.y + title.height - TOL_Y);
  });

  test("firstName + lastName (colSpan 6): same row, each ≈ half width on desktop", async ({
    page,
  }) => {
    await setDesktopViewport(page);
    const grid = await box(formGrid(page));
    const firstName = await box(fieldByLabel(page, "First name"));
    const lastName = await box(fieldByLabel(page, "Last name"));
    expectSameRow(firstName, lastName);
    expectRightOf(firstName, lastName);
    expectFraction(firstName, grid, 0.5);
    expectFraction(lastName, grid, 0.5);
  });

  test("city + state + zip (colSpan 4): same row, three across, each ≈ third width", async ({
    page,
  }) => {
    await setDesktopViewport(page);
    const grid = await box(formGrid(page));
    const city = await box(fieldByLabel(page, "City").first());
    const state = await box(fieldByLabel(page, "State"));
    const zip = await box(fieldByLabel(page, "ZIP").first());
    expectSameRow(city, state);
    expectSameRow(state, zip);
    expectRightOf(city, state);
    expectRightOf(state, zip);
    expectFraction(city, grid, 1 / 3);
    expectFraction(state, grid, 1 / 3);
    expectFraction(zip, grid, 1 / 3);
  });

  test("email (alias 'half' = 6): ≈ half-width on desktop", async ({ page }) => {
    await setDesktopViewport(page);
    const grid = await box(formGrid(page));
    const email = await box(fieldByLabel(page, "Email \\(alias half\\)"));
    expectFraction(email, grid, 0.5);
  });

  test("country (alias 'third' = 4): ≈ third-width on desktop", async ({ page }) => {
    await setDesktopViewport(page);
    const grid = await box(formGrid(page));
    const country = await box(fieldByLabel(page, "Country \\(alias third\\)"));
    expectFraction(country, grid, 1 / 3);
  });

  test("phone (responsive 6/12) + mobile (6): same row, each ≈ half width on desktop", async ({
    page,
  }) => {
    await setDesktopViewport(page);
    const grid = await box(formGrid(page));
    const phone = await box(fieldByLabel(page, "Phone \\(responsive default\\)"));
    const mobile = await box(fieldByLabel(page, "Mobile \\(single-arg\\)"));
    expectSameRow(phone, mobile);
    expectRightOf(phone, mobile);
    expectFraction(phone, grid, 0.5);
    expectFraction(mobile, grid, 0.5);
  });

  test("bio (rowSpan 2): ≈ 2× normal field height, nickname + website stack to its right", async ({
    page,
  }) => {
    await setDesktopViewport(page);
    const grid = await box(formGrid(page));
    const bio = await box(fieldByLabel(page, "Bio"));
    const nickname = await box(fieldByLabel(page, "Nickname"));
    const website = await box(fieldByLabel(page, "Website"));

    // Bio sits at the same row top as Nickname (both occupy the top of
    // their respective half-column slots).
    expectSameRow(bio, nickname);
    // Website is one row below Nickname.
    expect(website.y).toBeGreaterThan(nickname.y + nickname.height - TOL_Y);
    // Nickname + Website share the same x (right column).
    expect(Math.abs(nickname.x - website.x)).toBeLessThanOrEqual(TOL_Y);
    expectRightOf(bio, nickname);
    expectFraction(bio, grid, 0.5);
    // Bio's height is roughly twice a single short field (Nickname).
    // Allow generous slop: textareas have their own min-height baseline +
    // grid `gap` adds to the doubled span. Lower-bound at 1.6× nickname.
    expect(bio.height / nickname.height).toBeGreaterThan(1.6);
  });

  test("discount (colSpan 4 desktop): ≈ third-width on desktop", async ({ page }) => {
    await setDesktopViewport(page);
    const grid = await box(formGrid(page));
    const discount = await box(fieldByLabel(page, "Discount %"));
    expectFraction(discount, grid, 1 / 3);
  });

  // ── Optional address (nested grid stacks below 480px container width) ──

  test("address (colSpan 6): once added, occupies ≈ half-width on desktop", async ({ page }) => {
    await setDesktopViewport(page);
    await enableCollection(page, "Address");
    const grid = await box(formGrid(page));
    const addr = arraySection(page, "Address");
    await expect(addr).toBeVisible();
    const addrBox = await box(addr);
    expectFraction(addrBox, grid, 0.5);
  });

  test("address: nested City + ZIP (colSpan 6 inside half-width container) STACK because inner container < 480px", async ({
    page,
  }) => {
    await setDesktopViewport(page);
    await enableCollection(page, "Address");
    const addr = arraySection(page, "Address");
    await expect(addr).toBeVisible();
    // Inner fields render inside their OWN `as-form-grid` (each AsObject
    // body opens its own grid container). That inner container's inline
    // size is half of the outer (~half of 672px max-w-2xl content = ~336
    // — well under 480px), so the narrow track resolves: each inner
    // field claims col-span-12 (full width of the inner grid), making
    // City and ZIP stack rather than sit side-by-side.
    const city = await box(fieldByLabelScoped(addr, "City"));
    const zip = await box(fieldByLabelScoped(addr, "ZIP"));
    // Stacked = different y rows. Difference is at least one row height.
    expect(zip.y - city.y).toBeGreaterThan(city.height / 2);
  });

  // ── Optional phones array (inner row label/number side-by-side) ─────

  test("phones: add one row → Label (4) + Number (8) share row; widths ≈ 1/3 and 2/3", async ({
    page,
  }) => {
    await setDesktopViewport(page);
    await enableCollection(page, "Phone numbers");
    const phones = arraySection(page, "Phone numbers");
    await expect(phones).toBeVisible();
    // Each phone item renders its own inner grid; inside it Label (4) +
    // Number (8) sit side-by-side because the inner container is still
    // wide (the outer phones array is full-width, so its first item
    // is also full-width and over 480px).
    const label = await box(fieldByLabelScoped(phones, "Label"));
    const number = await box(fieldByLabelScoped(phones, "Number"));
    expectSameRow(label, number);
    expectRightOf(label, number);
    // 1/3 vs 2/3 ratio: Number should be ≈ 2× Label width.
    expect(number.width / label.width).toBeGreaterThan(1.6);
    expect(number.width / label.width).toBeLessThan(2.4);
  });

  // ── Narrow / mobile container-query branch ──────────────────────────

  test("narrow (mobile viewport): firstName + lastName collapse to stacked rows", async ({
    page,
  }) => {
    // Default colSpan narrow = 12 unless overridden. firstName/lastName
    // only declare `'6'` (single-arg) → narrow defaults to 12 → stack.
    await setMobileViewport(page);
    const firstName = await box(fieldByLabel(page, "First name"));
    const lastName = await box(fieldByLabel(page, "Last name"));
    // Different rows.
    expect(Math.abs(firstName.y - lastName.y)).toBeGreaterThan(TOL_Y);
    expect(lastName.y).toBeGreaterThan(firstName.y);
  });

  test("narrow: discount (4/6) becomes ≈ half-width (narrow=6)", async ({ page }) => {
    await setMobileViewport(page);
    const grid = await box(formGrid(page));
    const discount = await box(fieldByLabel(page, "Discount %"));
    // narrow=6 → half of the (now narrow) grid.
    expectFraction(discount, grid, 0.5);
  });

  test("narrow: phone (6/12) becomes ≈ full width (narrow=12)", async ({ page }) => {
    await setMobileViewport(page);
    const grid = await box(formGrid(page));
    const phone = await box(fieldByLabel(page, "Phone \\(responsive default\\)"));
    expectFraction(phone, grid, 1);
  });

  // ── Submit / preview sanity ─────────────────────────────────────────

  test("fill all top-level required leaves → preview reflects each key", async ({ page }) => {
    await setDesktopViewport(page);
    const form = section(page);
    await form.getByLabel(labelRegex("Title")).fill("Hello");
    await form.getByLabel(labelRegex("First name")).fill("Ada");
    await form.getByLabel(labelRegex("Last name")).fill("Lovelace");
    await form.getByLabel(labelRegex("City")).first().fill("London");
    await form.getByLabel(labelRegex("State")).fill("LDN");
    await form.getByLabel(labelRegex("ZIP")).first().fill("EC1A");
    await form.getByLabel(labelRegex("Email \\(alias half\\)")).fill("ada@example.com");
    await form.getByLabel(labelRegex("Country \\(alias third\\)")).fill("UK");
    await form.getByLabel(labelRegex("Phone \\(responsive default\\)")).fill("+44 0000");
    await form.getByLabel(labelRegex("Mobile \\(single-arg\\)")).fill("+44 9999");
    await form.getByLabel(labelRegex("Bio")).fill("Long enough bio for the minLength check.");
    await form.getByLabel(labelRegex("Nickname")).fill("ada");
    await form.getByLabel(labelRegex("Website")).fill("https://ada.example");
    const discount = form.getByLabel(labelRegex("Discount %"));
    await discount.fill("25");
    await discount.blur();

    const preview = await readPreview(page);
    expect(preview).toMatchObject({
      title: "Hello",
      firstName: "Ada",
      lastName: "Lovelace",
      city: "London",
      state: "LDN",
      zip: "EC1A",
      email: "ada@example.com",
      country: "UK",
      phone: "+44 0000",
      mobile: "+44 9999",
      bio: "Long enough bio for the minLength check.",
      nickname: "ada",
      website: "https://ada.example",
      discount: 25,
    });
  });
});
