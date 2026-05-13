// Section 26 — Array showcase.
//
// Covers every array variant the AsArray default renders against:
//   - Optional primitive array (`tags?: string[]`) with `@ui.form.label.singular`
//   - Required primitive array (`headers: string[]`) with `@expect.minLength 1`
//   - Optional object array (`contacts?: {...}[]`) with colSpan 6/6 inner fields
//   - Required object array (`phones: {...}[]`) with `@expect.minLength 1`,
//     colSpan 4/8 inner fields
//   - Nested array (`team?: {name, members?: string[]}[]`) — array of objects
//     whose `members` field is itself an array
//
// Demo target: `/forms-demo/array-showcase`. Self-contained, no auth gate.
// The page exposes two stable testids — `array-showcase-form` on the
// `<AsForm>` element and `array-showcase-preview` on the JSON `<pre>` that
// renders `formData` — so the spec can scope DOM queries to the form and
// parse the live JSON snapshot without scraping inputs.
//
// Selectors to know about:
//   - `.as-collapsible-summary`        — clickable section header
//   - `.as-collapsible-title`          — title of an array / object section
//                                        (level ≤ 1)
//   - `.as-collapsible-title-nested`   — title at deeper nesting (level ≥ 2)
//   - `.as-array-add-btn`              — inline "Add <singular>" button inside
//                                        an open array section
//   - `.as-object-empty-add`           — optional empty-state add button
//                                        ("Add <Field Title>") for optional
//                                        arrays / objects collapsed to empty
//   - `.as-field-remove-btn`           — per-item remove button (aria-label="Remove")
//   - `.as-collapsible-error`          — minLength / array-level error rendered
//                                        inside the collapsible body
//   - `.as-field-label`                — label for a leaf field; array items
//                                        render `"<Singular> #N"` here
//
// Selector quirks:
//   - Template indentation leaks one leading space into `.as-array-add-btn`
//     text content (" Add tag" / " Add header" …) — match with `:text-is()`
//     or regex tolerant of leading/trailing whitespace, never `/^Add tag$/`.
//   - The required-marker `*` is rendered via CSS `::after`, but Playwright's
//     accessible-name computation includes it — `getByLabel("Team name")`
//     would miss the field. Use a regex anchored to the base label instead.

import { expect, test, type Locator, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/array-showcase");
  await page.waitForLoadState("networkidle");
  // Wait for hydration — the submit button is rendered once AsForm has
  // initialised. After this, the testid-scoped locators are interactable.
  await expect(page.getByTestId("array-showcase-form").locator(".as-submit-btn")).toBeVisible();
}

const section = (page: Page): Locator => page.getByTestId("array-showcase-form");

// `formData` is the `{ value: <domainData> }` wrapper, so the preview
// JSON's top-level key is always `value` — unwrap it here.
async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("array-showcase-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

// Resolve an array's `<details>` container by its visible title.
//
// Tags/HTTP headers/Contacts/Phones/Team are top-level arrays at level 1
// (variant "section"). Each array's items render at level 2 (variant
// "island") and the item title carries a `#N` suffix appended in its own
// `<span>`, so `:text-is("<title>")` on the title text node would also
// match `Team #1` / `Contact #1` items (the base "Team" text precedes the
// suffix span). Filtering by `details.as-collapsible-section` keeps the
// array container and skips its item containers (which carry
// `.as-collapsible-island`).
//
// The inner `Members` array nested under Team #1 sits at level 3, also
// "section" variant — same selector still hits it.
function arraySection(page: Page, title: string): Locator {
  return section(page).locator(
    `details.as-collapsible-section:has(> summary :is(.as-collapsible-title, .as-collapsible-title-nested):text-is("${title}"))`,
  );
}

// Build a regex that matches an inline "Add <singular>" button, tolerating
// the leading whitespace baked into the template literal and disallowing the
// plural form ("Add tags" must NOT match "Add tag").
function addBtnText(singular: string): RegExp {
  return new RegExp(`^\\s*Add ${singular}\\s*$`);
}

// Build a regex that matches a leaf label whose required-marker asterisk is
// painted via CSS but surfaces in the accessible name.
function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}(\\s*\\*)?$`);
}

// Click the optional empty-state "Add <Title>" placeholder rendered by
// `as-array.vue`'s `empty` slot for optional unset arrays.
async function clickEmptyAdd(page: Page, title: string): Promise<void> {
  await section(page)
    .locator(".as-object-empty-add", { hasText: `Add ${title}` })
    .click();
}

// The inline "Add <singular>" button inside an open array's body.
function inlineAddBtn(scope: Locator, singular: string): Locator {
  return scope.locator(".as-array-add-btn", { hasText: addBtnText(singular) });
}

// Array/object-level minLength error rendered inside the collapsible body.
function collapsibleError(page: Page, hasText: string): Locator {
  return section(page).locator(".as-collapsible-error", { hasText });
}

async function submit(page: Page): Promise<void> {
  await section(page).locator(".as-submit-btn").click();
}

// Per-item Remove (aria-label="Remove" exact) — distinct from the array-level
// "Unset <Title>" / "Clear <Title>" clear buttons.
async function removeFirstItem(scope: Locator): Promise<void> {
  await scope.getByRole("button", { name: "Remove", exact: true }).first().click();
}

test.describe("Section 26 — array-showcase", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Optional primitive array (tags) ──────────────────────────
  test("optional primitive: tags renders empty-state placeholder, preview has no tags key", async ({
    page,
  }) => {
    // Initial state: tags is optional and unset → renders empty-state add
    // button "Add Tags" via `as-array.vue` `empty` slot. No `<details>`
    // container yet, no items.
    const addPlaceholder = section(page).locator(".as-object-empty-add", {
      hasText: "Add Tags",
    });
    await expect(addPlaceholder).toBeVisible();

    const preview = await readPreview(page);
    // Optional unset → `tags` is either omitted or `undefined`. JSON.stringify
    // drops `undefined`-valued keys, so we accept "key missing" as success.
    expect(preview.tags ?? undefined).toBeUndefined();
  });

  test("optional primitive: clicking 'Add Tags' empty-state reveals one editable input", async ({
    page,
  }) => {
    await clickEmptyAdd(page, "Tags");
    // After enable+seed, the array `<details>` renders. The first item's
    // label is `"Tag #1"` (singular + index).
    const tagsArray = arraySection(page, "Tags");
    await expect(tagsArray).toBeVisible();
    const firstItem = tagsArray.locator(".as-field-label", { hasText: /^Tag\s*#1$/ });
    await expect(firstItem).toBeVisible();
    // Assert the input exists + is focusable rather than racing the
    // `runAndFocusNew` heuristic.
    const firstInput = tagsArray.locator("input").first();
    await firstInput.focus();
    await expect(firstInput).toBeFocused();
  });

  test("optional primitive: typing a tag updates preview.tags", async ({ page }) => {
    await clickEmptyAdd(page, "Tags");
    const tagsArray = arraySection(page, "Tags");
    const first = tagsArray.locator("input").first();
    await first.fill("alpha");
    await first.blur();
    const preview = await readPreview(page);
    expect(preview.tags).toEqual(["alpha"]);
  });

  test("optional primitive: Add tag button uses singular label, not plural", async ({ page }) => {
    await clickEmptyAdd(page, "Tags");
    const tagsArray = arraySection(page, "Tags");
    // `@ui.form.label.singular 'tag'` ⇒ the inline Add button reads "Add tag",
    // not the plural "Add tags". Whitespace from the template indentation is
    // tolerated by the helper regex.
    const addBtn = tagsArray.locator(".as-array-add-btn");
    await expect(addBtn).toHaveText(addBtnText("tag"));
    await expect(tagsArray.locator(".as-array-add-btn", { hasText: "Add tags" })).toHaveCount(0);
  });

  test("optional primitive: add 2 tags then remove the first leaves only the second", async ({
    page,
  }) => {
    await clickEmptyAdd(page, "Tags");
    const tagsArray = arraySection(page, "Tags");

    // First tag is already seeded by handleEnableOptional.
    const firstInput = tagsArray.locator("input").first();
    await firstInput.fill("first");
    await firstInput.blur();

    // Add a second item via the inline Add button.
    await inlineAddBtn(tagsArray, "tag").click();
    const inputs = tagsArray.locator("input");
    await expect(inputs).toHaveCount(2);
    await inputs.nth(1).fill("second");
    await inputs.nth(1).blur();

    let preview = await readPreview(page);
    expect(preview.tags).toEqual(["first", "second"]);

    // Remove the first item via its per-item remove button. The array-level
    // clear is "Unset Tags" / "Clear Tags", so scoping by aria-label exact
    // "Remove" never hits the wrong button.
    await removeFirstItem(tagsArray);
    await expect(tagsArray.locator("input")).toHaveCount(1);
    preview = await readPreview(page);
    expect(preview.tags).toEqual(["second"]);
  });

  // ── Required primitive array (headers, minLength 1) ──────────
  test("required primitive: submit with empty headers surfaces the minLength error", async ({
    page,
  }) => {
    // Headers is required → renders as an open `<details>` with no items
    // and an "Add header" footer button.
    const headers = arraySection(page, "HTTP headers");
    await expect(headers).toBeVisible();
    await expect(inlineAddBtn(headers, "header")).toBeVisible();

    await submit(page);

    // The minLength error renders inside the collapsible body via
    // `.as-collapsible-error` (the array's own validator surfaces there,
    // not on a leaf input).
    await expect(collapsibleError(page, "At least one header is required")).toBeVisible();
  });

  test("required primitive: adding a header clears the minLength error", async ({ page }) => {
    const headers = arraySection(page, "HTTP headers");
    await submit(page);
    await expect(collapsibleError(page, "At least one header is required")).toBeVisible();

    await inlineAddBtn(headers, "header").click();
    const firstInput = headers.locator("input").first();
    await firstInput.fill("X-Trace-Id");
    await firstInput.blur();

    // Re-submit and verify the header-specific minLength error is gone.
    // The form may still fail validation on `phones` (also required,
    // minLength 1), so we don't assert on a successful submit here.
    await submit(page);
    await expect(collapsibleError(page, "At least one header is required")).toHaveCount(0);

    const preview = await readPreview(page);
    expect(preview.headers).toEqual(["X-Trace-Id"]);
  });

  // ── Optional object array (contacts) ─────────────────────────
  test("optional object: 'Add Contacts' empty-state reveals firstName/lastName/email row", async ({
    page,
  }) => {
    await clickEmptyAdd(page, "Contacts");
    const contacts = arraySection(page, "Contacts");
    await expect(contacts).toBeVisible();

    // Each contact item has its own `Contact #N` object section with three
    // labeled inputs. The base `.as-field-label` text excludes the
    // required-marker `*` (which is CSS pseudo-content).
    await expect(contacts.locator(".as-field-label", { hasText: /^First name$/ })).toHaveCount(1);
    await expect(contacts.locator(".as-field-label", { hasText: /^Last name$/ })).toHaveCount(1);
    await expect(contacts.locator(".as-field-label", { hasText: /^Email$/ })).toHaveCount(1);
  });

  test("optional object: firstName + lastName render side-by-side (colSpan 6/6)", async ({
    page,
  }) => {
    await clickEmptyAdd(page, "Contacts");
    const contacts = arraySection(page, "Contacts");

    // Each leaf field renders as `.as-default-field` wrapping its label +
    // input. Resolve the firstName / lastName wrappers by walking up from
    // their respective `.as-field-label` nodes.
    const firstNameLabel = contacts.locator(".as-field-label", { hasText: /^First name$/ }).first();
    const lastNameLabel = contacts.locator(".as-field-label", { hasText: /^Last name$/ }).first();
    await expect(firstNameLabel).toBeVisible();
    await expect(lastNameLabel).toBeVisible();

    const firstBox = await firstNameLabel.boundingBox();
    const lastBox = await lastNameLabel.boundingBox();
    expect(firstBox && lastBox).toBeTruthy();
    // Inline colSpan 6/6 means both labels sit on the same row → identical
    // `y` within a couple px of font-baseline jitter.
    expect(Math.abs(firstBox!.y - lastBox!.y)).toBeLessThanOrEqual(2);
    // And lastName starts to the right of firstName (positive gap, modulo a
    // small overlap budget for column padding).
    expect(lastBox!.x).toBeGreaterThan(firstBox!.x);
  });

  test("optional object: typing firstName + email reflects in preview.contacts[0]", async ({
    page,
  }) => {
    await clickEmptyAdd(page, "Contacts");
    const contacts = arraySection(page, "Contacts");

    await contacts.getByLabel(labelRegex("First name")).fill("Jane");
    const email = contacts.getByLabel(labelRegex("Email"));
    await email.fill("jane@example.com");
    await email.blur();

    const preview = await readPreview(page);
    const list = preview.contacts as Array<Record<string, unknown>>;
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ firstName: "Jane", email: "jane@example.com" });
  });

  test("optional object: removing the first of 2 contacts keeps the second intact", async ({
    page,
  }) => {
    await clickEmptyAdd(page, "Contacts");
    const contacts = arraySection(page, "Contacts");

    // First contact (auto-seeded by the empty-state add flow).
    await contacts.getByLabel(labelRegex("First name")).fill("Alpha");
    const emailFirst = contacts.getByLabel(labelRegex("Email"));
    await emailFirst.fill("alpha@example.com");
    await emailFirst.blur();

    // Add a second contact via the inline Add button.
    await inlineAddBtn(contacts, "contact").click();

    // Two contact items now — scope label lookups by item index.
    const firstNames = contacts.getByLabel(labelRegex("First name"));
    const emails = contacts.getByLabel(labelRegex("Email"));
    await expect(firstNames).toHaveCount(2);
    await firstNames.nth(1).fill("Beta");
    await emails.nth(1).fill("beta@example.com");
    await emails.nth(1).blur();

    let preview = await readPreview(page);
    let list = preview.contacts as Array<Record<string, unknown>>;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ firstName: "Alpha", email: "alpha@example.com" });
    expect(list[1]).toMatchObject({ firstName: "Beta", email: "beta@example.com" });

    // Remove the FIRST contact via its item-level Remove button. The
    // array-level clear is "Unset Contacts" / "Clear Contacts" (different
    // aria-label), so name="Remove" exact targets only the item buttons.
    await removeFirstItem(contacts);
    await expect(contacts.getByLabel(labelRegex("First name"))).toHaveCount(1);

    preview = await readPreview(page);
    list = preview.contacts as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ firstName: "Beta", email: "beta@example.com" });
  });

  // ── Required object array (phones, minLength 1) ──────────────
  test("required object: Add phone reveals label + number inputs (colSpan 4/8)", async ({
    page,
  }) => {
    const phones = arraySection(page, "Phone numbers");
    await expect(phones).toBeVisible();

    await inlineAddBtn(phones, "phone").click();

    const labelInput = phones.getByLabel(labelRegex("Label"));
    const numberInput = phones.getByLabel(labelRegex("Number"));
    await expect(labelInput).toBeVisible();
    await expect(numberInput).toBeVisible();

    // Verify colSpan 4/8 layout: the input boxes share the same row and the
    // Number column is meaningfully wider than the Label column (4/8 = 2.0
    // theoretical; allow for cell padding / gutter at narrow viewports).
    const labelBox = await labelInput.boundingBox();
    const numberBox = await numberInput.boundingBox();
    expect(labelBox && numberBox).toBeTruthy();
    expect(Math.abs(labelBox!.y - numberBox!.y)).toBeLessThanOrEqual(2);
    expect(numberBox!.width).toBeGreaterThan(labelBox!.width * 1.4);
  });

  test("required object: submit with no phones surfaces the minLength error", async ({ page }) => {
    await submit(page);
    await expect(collapsibleError(page, "At least one phone is required")).toBeVisible();
  });

  // ── Nested array (team → members) ────────────────────────────
  test("nested array: 'Add Team' reveals name input + inner 'Add Members' control", async ({
    page,
  }) => {
    await clickEmptyAdd(page, "Team");
    const team = arraySection(page, "Team");
    await expect(team).toBeVisible();

    // Team item exposes a `Team name` leaf input.
    await expect(team.getByLabel(labelRegex("Team name"))).toBeVisible();

    // Members is a nested optional array → renders its own empty-state
    // button labeled "Add Members" (capitalised array title).
    await expect(team.locator(".as-object-empty-add", { hasText: "Add Members" })).toBeVisible();
  });

  test("nested array: adding a member inside a team reveals a member input", async ({ page }) => {
    await clickEmptyAdd(page, "Team");
    const team = arraySection(page, "Team");
    await team.locator(".as-object-empty-add", { hasText: "Add Members" }).click();

    // The inner array is now open — `Members` collapsible at level 3 uses
    // `.as-collapsible-title-nested` (matched by `arraySection`'s `:is()`).
    const members = arraySection(page, "Members");
    await expect(members).toBeVisible();
    await expect(members.locator(".as-field-label", { hasText: /^Member\s*#1$/ })).toBeVisible();
  });

  test("nested array: typing team name + a member produces nested preview shape", async ({
    page,
  }) => {
    await clickEmptyAdd(page, "Team");
    const team = arraySection(page, "Team");
    await team.getByLabel(labelRegex("Team name")).fill("Platform");

    await team.locator(".as-object-empty-add", { hasText: "Add Members" }).click();
    const members = arraySection(page, "Members");
    const memberInput = members.locator("input").first();
    await memberInput.fill("alice");
    await memberInput.blur();

    const preview = await readPreview(page);
    const list = preview.team as Array<Record<string, unknown>>;
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Platform", members: ["alice"] });
  });
});
