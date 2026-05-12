// Section 29 — Unions Showcase demo.
//
// Exercises every union variant rendered in
// `packages/vue-demo/src/client/pages/forms-demo/unions.vue` against the
// `UnionsShowcaseForm` schema. Variants:
//   - tier:        `'free' | 'pro' | 'enterprise'`        (pure literal union →
//                                                          native <select>, NO
//                                                          variant picker)
//   - qty:         `string | number`                       (heterogeneous
//                                                          primitive → variant
//                                                          picker switches
//                                                          input type)
//   - customer:    `Person | Company`                     (object fingerprint;
//                                                          no discriminator)
//   - notification?: `Email|Sms|Push`                     (optional, 3 obj
//                                                          variants by required-
//                                                          prop fingerprint; no
//                                                          discriminator key in
//                                                          preview JSON)
//   - image?:      `UrlImage | UploadImage`               (optional,
//                                                          discriminated by
//                                                          hidden `kind`)
//   - log:         `(Login|Logout|Note)[]`                (required array of
//                                                          discriminated union;
//                                                          row-level picker;
//                                                          hidden `type`
//                                                          discriminator)
//   - subscriber:  `EmailSubscriber|WebhookSubscriber`    (3-level depth:
//                                                          subscriber → endpoint
//                                                          object → auth?
//                                                          variant)
//
// The preview block under the form exposes `formData` as JSON
// (`data-testid=unions-preview`). `formData` is wrapped as
// `{ value: <domainData> }` so the spec unwraps `.value` everywhere.
//
// Priority note: this is the ONLY direct e2e coverage of the
// `/forms-demo/unions` page — `m-unions/` only exercises the DB edit forms.
//
// Selector quirks:
//   - AsUnion variant picker (active) renders `.as-variant-trigger` inside
//     the variant collapsible (or, for primitive variants, inside the field
//     shell). Clicking it opens an `.as-dropdown-menu` of
//     `.as-dropdown-item` rows. The trigger's text is the current variant
//     label WITHOUT the auto-numbered prefix (e.g. "Person", "Number").
//     Dropdown rows keep the `"N. "` prefix.
//   - When a union field is OPTIONAL and unset, AsUnion renders an
//     `.as-object-empty-add` button "Add <Label>" that doubles as the
//     variant picker — clicking it opens an `.as-dropdown-menu` listing
//     `"1. <Label>"`, `"2. <Label>"`, …
//   - Pure-literal unions skip AsUnion entirely — they reach AsSelect (or
//     similar) directly. Verify by querying for `<select>` and asserting
//     there is no `.as-variant-trigger` for that field.
//   - Optional-clear button reads aria-label="Unset <Label>" exact.
//   - Singular array-row title is `"<Singular> #N"` from
//     `@ui.form.label.singular`; inline add button reads " Add <singular>".
//   - The `kind`/`type` discriminator fields are `@ui.form.hidden` — they
//     never render a label or input, but they DO appear in the preview JSON
//     because the variant picker writes them implicitly.

import { expect, test, type Locator, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/unions");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("unions-form").locator(".as-submit-btn")).toBeVisible();
}

const section = (page: Page): Locator => page.getByTestId("unions-form");

// `formData` is the `{ value: <domainData> }` wrapper.
async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("unions-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

// Required-asterisk surfaces in the accessible name.
const LABEL_TAIL = "(\\s*\\*)?";

function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}${LABEL_TAIL}$`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const escapeQuotes = (s: string): string => s.replace(/"/g, '\\"');

// Title-matcher fragment for collapsible <summary> — matches level-1
// (`.as-collapsible-title`) AND level ≥ 2 (`.as-collapsible-title-nested`).
const titleSel = (escaped: string): string =>
  `:is(.as-collapsible-title, .as-collapsible-title-nested):text-is("${escaped}")`;

// `:is(collapsible-with-title, field-shell-with-label)` wrapper fragment
// used by both `variantTrigger` and `variantSection`. Object/array/tuple
// variants render inside collapsible chrome; primitive variants render
// inside AsFieldShell with no collapsible.
const wrapperSel = (escaped: string): string =>
  `:is(` +
  `[class*="as-collapsible-"]:has(> summary ${titleSel(escaped)}),` +
  `.as-default-field:has(> .as-field-header-row .as-field-label:text-is("${escaped}"))` +
  `)`;

// Resolve a collapsible (object/array/tuple/union variant section) by its
// visible title text. `details:has(...)` keeps the container, not its
// descendant items.
function collapsibleByTitle(page: Page, title: string): Locator {
  return section(page).locator(`details:has(> summary ${titleSel(escapeQuotes(title))})`);
}

// Resolve the active variant-trigger for a labeled union field. Object /
// array / tuple variants render the picker inside a collapsible header.
// Primitive variants render it inside AsFieldShell (no collapsible chrome)
// — picker sits next to the `<label class="as-field-label">`. This helper
// unions both branches.
function variantTrigger(page: Page, fieldLabel: string): Locator {
  return section(page)
    .locator(`${wrapperSel(escapeQuotes(fieldLabel))} .as-variant-trigger`)
    .first();
}

// Resolve the whole wrapper (collapsible OR field-shell) for a union field.
function variantSection(page: Page, fieldLabel: string): Locator {
  return section(page).locator(wrapperSel(escapeQuotes(fieldLabel))).first();
}

// Click a variant inside an OPEN .as-dropdown-menu scoped to `scope`. The
// menu items carry an `"N. "` prefix from buildUnionVariants, so we match
// on regex with optional digit prefix.
async function pickVariant(scope: Locator, label: string): Promise<void> {
  const item = scope.locator(".as-dropdown-item", {
    hasText: new RegExp(`^(\\s*\\d+\\.\\s+)?${escapeRegex(label)}\\s*$`),
  });
  await item.first().click();
}

// Open the variant picker on an ACTIVE union field, then pick a variant.
// Object/array unions render the trigger inside a collapsed <details> — it
// is attached but not visible until summary is clicked. `expandIfClosed`
// is idempotent and a no-op for primitive variants that render no
// `details` chrome.
async function switchVariant(page: Page, fieldLabel: string, label: string): Promise<void> {
  await expandIfClosed(page, fieldLabel);
  const trigger = variantTrigger(page, fieldLabel);
  await trigger.click();
  // The dropdown menu is a sibling of the trigger.
  const ddScope = variantSection(page, fieldLabel);
  await pickVariant(ddScope, label);
  await expect(ddScope.locator(".as-dropdown-menu")).toHaveCount(0);
}

// Resolve the `.as-dropdown` wrapper that contains the empty-state Add
// button for an optional/unset union field within `scope` (defaults to the
// form section). Used both as the click target (Add button) and as the
// scope for the variant menu that opens beneath it.
function emptyStateDropdown(page: Page, fieldLabel: string, scope?: Locator): Locator {
  const root = scope ?? section(page);
  return root
    .locator(`.as-dropdown:has(> .as-object-empty-add:has-text("Add ${escapeQuotes(fieldLabel)}"))`)
    .first();
}

// Open the empty-state picker for an OPTIONAL/unset union field, then pick.
async function addAndPickVariant(page: Page, fieldLabel: string, label: string): Promise<void> {
  // The empty-state button doubles as the picker trigger for multi-variant
  // optional unions — click opens the menu rather than instantly enabling.
  const scope = emptyStateDropdown(page, fieldLabel);
  await scope.locator(".as-object-empty-add").click();
  await pickVariant(scope, label);
}

// Resolve the `.as-dropdown` wrapper around an array's inline add button.
// The button doubles as a variant picker for arrays-of-unions — clicking
// opens a dropdown menu of variant rows.
function arrayAddDropdown(arr: Locator): Locator {
  return arr.locator(".as-dropdown:has(> .as-array-add-btn)").first();
}

// Add a row to an array-of-union via the inline add button + variant menu.
async function addArrayRow(arr: Locator, variant: string): Promise<Locator> {
  const scope = arrayAddDropdown(arr);
  await scope.locator(".as-array-add-btn").click();
  await pickVariant(scope, variant);
  return scope;
}

// Required object unions (Customer, Subscriber) render as collapsed
// `<details>` sections — the variant trigger lives inside `<summary>`'s
// `title-extras` slot but Playwright sees its layout box as collapsed
// while the details element is closed (the title-row wraps to zero-width
// when the body is hidden). Clicking the summary toggles `open` via the
// nested-sections store. Idempotent: no-op if already open.
async function expandIfClosed(page: Page, fieldLabel: string): Promise<void> {
  const details = section(page)
    .locator(`details:has(> summary ${titleSel(escapeQuotes(fieldLabel))})`)
    .first();
  if ((await details.count()) === 0) return;
  const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open);
  if (!isOpen) {
    await details.locator(".as-collapsible-summary").first().click();
    await expect(details).toHaveJSProperty("open", true);
  }
}

test.describe("Section 29 — unions demo", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Initial render / structure ──────────────────────────────────────

  test("page renders form testid and preview block", async ({ page }) => {
    await expect(section(page)).toBeVisible();
    await expect(page.getByTestId("unions-preview")).toBeAttached();
  });

  // ── 1. Pure literal union (tier) ────────────────────────────────────

  test("tier: renders as native <select>, NO variant picker for this field", async ({ page }) => {
    // Pure-literal union dispatches directly to AsSelect — no `.as-variant-
    // trigger` on the Account-tier row.
    const select = section(page).getByLabel(labelRegex("Account tier"));
    await expect(select).toHaveJSProperty("tagName", "SELECT");
    // No variant picker rendered for the tier field. (Other fields like
    // customer/qty render their own pickers, so a global count check would
    // be wrong; scope to the tier wrapper.)
    const tierWrapper = section(page)
      .locator(".as-default-field", {
        has: page.locator(".as-field-label", { hasText: labelRegex("Account tier") }),
      })
      .first();
    await expect(tierWrapper.locator(".as-variant-trigger")).toHaveCount(0);
  });

  test("tier: select 'pro' → preview.tier === 'pro'", async ({ page }) => {
    const select = section(page).getByLabel(labelRegex("Account tier"));
    await select.selectOption("pro");
    const preview = await readPreview(page);
    expect(preview.tier).toBe("pro");
  });

  test("tier: select 'enterprise' → preview.tier === 'enterprise'", async ({ page }) => {
    const select = section(page).getByLabel(labelRegex("Account tier"));
    await select.selectOption("enterprise");
    const preview = await readPreview(page);
    expect(preview.tier).toBe("enterprise");
  });

  // ── 2. Heterogeneous primitive union (qty) ──────────────────────────

  test("qty: renders a variant picker with String / Number options", async ({ page }) => {
    // qty is `string | number` — primitive variants render with a variant
    // trigger so the user can switch the input type. The current trigger
    // label is one of "String" / "Number" (the first variant auto-picks).
    const trigger = variantTrigger(page, "Quantity or label");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveText(/^(String|Number)$/);
  });

  test("qty: pick Number variant → input is type=number; typing 42 → preview.qty === 42", async ({
    page,
  }) => {
    await switchVariant(page, "Quantity or label", "Number");
    const qtySection = variantSection(page, "Quantity or label");
    const input = qtySection.locator("input").first();
    await expect(input).toHaveAttribute("type", "number");
    await input.fill("42");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.qty).toBe(42);
  });

  test("qty: pick String variant → input is type=text; typing 'hello' → preview.qty === 'hello'", async ({
    page,
  }) => {
    await switchVariant(page, "Quantity or label", "String");
    const qtySection = variantSection(page, "Quantity or label");
    const input = qtySection.locator("input").first();
    await expect(input).toHaveAttribute("type", "text");
    await input.fill("hello");
    await input.blur();
    const preview = await readPreview(page);
    expect(preview.qty).toBe("hello");
  });

  // ── 3. Object variants by required-prop fingerprint (customer) ──────

  test("customer: variant picker shows Person / Company", async ({ page }) => {
    await expandIfClosed(page, "Customer");
    const trigger = variantTrigger(page, "Customer");
    await expect(trigger).toBeVisible();
    await trigger.click();
    const scope = variantSection(page, "Customer");
    const menu = scope.locator(".as-dropdown-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator(".as-dropdown-item")).toHaveCount(2);
    await expect(menu.locator(".as-dropdown-item").nth(0)).toHaveText(/Person/);
    await expect(menu.locator(".as-dropdown-item").nth(1)).toHaveText(/Company/);
    // Close the menu so other tests don't inherit it.
    await trigger.click();
  });

  test("customer: pick Person → firstName + lastName + email leaves are visible", async ({
    page,
  }) => {
    await switchVariant(page, "Customer", "Person");
    const scope = variantSection(page, "Customer");
    await expect(scope.getByLabel(labelRegex("First name"))).toBeVisible();
    await expect(scope.getByLabel(labelRegex("Last name"))).toBeVisible();
    // Email is optional — it renders as an "Not set" placeholder until the
    // user activates it. Assert by the field-label chrome (which is always
    // present) rather than by `getByLabel`, which would require an input.
    await expect(scope.locator(".as-field-label", { hasText: labelRegex("Email") })).toBeVisible();
  });

  test("customer: fill Person firstName + lastName → preview reflects", async ({ page }) => {
    await switchVariant(page, "Customer", "Person");
    const scope = variantSection(page, "Customer");
    await scope.getByLabel(labelRegex("First name")).fill("Ada");
    const last = scope.getByLabel(labelRegex("Last name"));
    await last.fill("Lovelace");
    await last.blur();
    const preview = await readPreview(page);
    expect(preview.customer).toMatchObject({ firstName: "Ada", lastName: "Lovelace" });
  });

  test("customer: switch to Company → companyName + taxId + billingEmail visible", async ({
    page,
  }) => {
    await switchVariant(page, "Customer", "Company");
    const scope = variantSection(page, "Customer");
    await expect(scope.getByLabel(labelRegex("Company name"))).toBeVisible();
    await expect(scope.getByLabel(labelRegex("Tax ID"))).toBeVisible();
    // Billing email is optional → renders an "Not set" placeholder, not an
    // input. Assert visibility via the field-label chrome.
    await expect(
      scope.locator(".as-field-label", { hasText: labelRegex("Billing email") }),
    ).toBeVisible();
    // Person-only leaves are no longer rendered for the Company variant.
    await expect(scope.getByLabel(labelRegex("First name"))).toHaveCount(0);
    await expect(scope.getByLabel(labelRegex("Last name"))).toHaveCount(0);
  });

  test("customer: pick Company + fill companyName / taxId → preview reflects", async ({ page }) => {
    await switchVariant(page, "Customer", "Company");
    const scope = variantSection(page, "Customer");
    await scope.getByLabel(labelRegex("Company name")).fill("ACME, Inc.");
    const tax = scope.getByLabel(labelRegex("Tax ID"));
    await tax.fill("US-99-7777777");
    await tax.blur();
    const preview = await readPreview(page);
    expect(preview.customer).toMatchObject({ companyName: "ACME, Inc.", taxId: "US-99-7777777" });
    // No discriminator key on a fingerprint union — confirm Person-only props
    // didn't leak through after the switch.
    expect("firstName" in (preview.customer as Record<string, unknown>)).toBe(false);
  });

  // ── 4. Optional object union (notification, 3 variants, no discriminator) ─

  test("notification: initial state is 'Add Notification channel' placeholder, preview lacks notification", async ({
    page,
  }) => {
    const addBtn = section(page).locator(".as-object-empty-add", {
      hasText: "Add Notification channel",
    });
    await expect(addBtn).toBeVisible();
    const preview = await readPreview(page);
    expect(preview.notification ?? undefined).toBeUndefined();
  });

  test("notification: click Add → 3-variant picker (Email / SMS / Push)", async ({ page }) => {
    const scope = emptyStateDropdown(page, "Notification channel");
    await scope.locator(".as-object-empty-add").click();
    const menu = scope.locator(".as-dropdown-menu");
    await expect(menu).toBeVisible();
    const items = menu.locator(".as-dropdown-item");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveText(/Email channel/);
    await expect(items.nth(1)).toHaveText(/SMS channel/);
    await expect(items.nth(2)).toHaveText(/Push channel/);
  });

  test("notification: pick Email → fill email → preview.notification.email set; NO discriminator key", async ({
    page,
  }) => {
    await addAndPickVariant(page, "Notification channel", "Email channel");
    const scope = variantSection(page, "Notification channel");
    const email = scope.getByLabel(labelRegex("Address"));
    await email.fill("alerts@example.com");
    await email.blur();
    const preview = await readPreview(page);
    const notif = preview.notification as Record<string, unknown>;
    expect(notif).toMatchObject({ email: "alerts@example.com" });
    // This union has NO hidden discriminator field — the preview should
    // contain only the variant's own props, never a synthetic `kind`/`type`.
    expect("kind" in notif).toBe(false);
    expect("type" in notif).toBe(false);
  });

  test("notification: switch to SMS → Phone leaf appears, email leaf gone", async ({ page }) => {
    await addAndPickVariant(page, "Notification channel", "Email channel");
    await switchVariant(page, "Notification channel", "SMS channel");
    const scope = variantSection(page, "Notification channel");
    await expect(scope.getByLabel(labelRegex("Phone"))).toBeVisible();
    await expect(scope.getByLabel(labelRegex("Address"))).toHaveCount(0);
  });

  test("notification: unset returns to placeholder, preview.notification absent", async ({
    page,
  }) => {
    await addAndPickVariant(page, "Notification channel", "Email channel");
    const scope = variantSection(page, "Notification channel");
    await scope.getByLabel(labelRegex("Address")).fill("temp@example.com");
    await scope.getByLabel(labelRegex("Address")).blur();
    let preview = await readPreview(page);
    expect(preview.notification).toBeDefined();

    await section(page)
      .getByRole("button", { name: "Unset Notification channel", exact: true })
      .click();
    await expect(
      section(page).locator(".as-object-empty-add", { hasText: "Add Notification channel" }),
    ).toBeVisible();
    preview = await readPreview(page);
    expect(preview.notification ?? undefined).toBeUndefined();
  });

  // ── 5. Discriminated union with hidden `kind` (image) ───────────────

  test("image: initial state is 'Add Profile image' placeholder", async ({ page }) => {
    await expect(
      section(page).locator(".as-object-empty-add", { hasText: "Add Profile image" }),
    ).toBeVisible();
    const preview = await readPreview(page);
    expect(preview.image ?? undefined).toBeUndefined();
  });

  test("image: pick URL image → url + alt visible AND preview.image.kind === 'url'", async ({
    page,
  }) => {
    await addAndPickVariant(page, "Profile image", "URL image");
    const scope = variantSection(page, "Profile image");
    await expect(scope.getByLabel(labelRegex("URL"))).toBeVisible();
    // Alt text is optional → renders an "Not set" placeholder, not an input.
    // Verify the label chrome is present instead.
    await expect(
      scope.locator(".as-field-label", { hasText: labelRegex("Alt text") }),
    ).toBeVisible();
    // Discriminator field is hidden from the form — no visible "kind" input.
    await expect(scope.getByLabel(labelRegex("kind"))).toHaveCount(0);

    const preview = await readPreview(page);
    expect((preview.image as Record<string, unknown>).kind).toBe("url");
  });

  test("image: fill url → preview.image.url set; switch to Uploaded image → preview.image.kind === 'upload'", async ({
    page,
  }) => {
    await addAndPickVariant(page, "Profile image", "URL image");
    const scope = variantSection(page, "Profile image");
    const url = scope.getByLabel(labelRegex("URL"));
    await url.fill("https://example.com/me.png");
    await url.blur();
    let preview = await readPreview(page);
    expect((preview.image as Record<string, unknown>).url).toBe("https://example.com/me.png");

    await switchVariant(page, "Profile image", "Uploaded image");
    await expect(scope.getByLabel(labelRegex("File ID"))).toBeVisible();
    await expect(scope.getByLabel(labelRegex("URL"))).toHaveCount(0);

    preview = await readPreview(page);
    expect((preview.image as Record<string, unknown>).kind).toBe("upload");
  });

  // ── 6. Array of discriminated union (log) ───────────────────────────

  test("log: required array; inline Add entry button is visible", async ({ page }) => {
    const logArr = collapsibleByTitle(page, "Audit log");
    await expect(logArr).toBeVisible();
    // Singular `'entry'` is configured via @ui.form.label.singular → the
    // inline add button reads " Add entry".
    const addBtn = logArr.locator(".as-array-add-btn");
    await expect(addBtn).toHaveText(/^\s*Add entry\s*$/);
  });

  test("log: add a Note row, fill text → preview.log[0] = {type:'note', text:'Hello'}", async ({
    page,
  }) => {
    const logArr = collapsibleByTitle(page, "Audit log");
    // Expand the array's collapsible so the add button is visible.
    await expandIfClosed(page, "Audit log");
    // The inline add button is itself a variant picker for an array of unions
    // — clicking opens a dropdown menu of variants ("1. Login event", …).
    await addArrayRow(logArr, "Note event");

    // First row's Text input appears.
    const text = logArr.getByLabel(labelRegex("Text"));
    await expect(text).toBeVisible();
    await text.fill("Hello");
    await text.blur();

    const preview = await readPreview(page);
    const list = preview.log as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: "note", text: "Hello" });
  });

  test("log: add a Login row after a Note row → preview.log[1] = {type:'login', user:'mav'}", async ({
    page,
  }) => {
    const logArr = collapsibleByTitle(page, "Audit log");
    await expandIfClosed(page, "Audit log");

    await addArrayRow(logArr, "Note event");
    await logArr.getByLabel(labelRegex("Text")).fill("first");

    await addArrayRow(logArr, "Login event");
    // After the second row, two User leaves? No — the Note row has Text, the
    // Login row has User. Scope `User` to the second row.
    const userInputs = logArr.getByLabel(labelRegex("User"));
    await expect(userInputs).toHaveCount(1);
    await userInputs.fill("mav");
    await userInputs.blur();

    const preview = await readPreview(page);
    const list = preview.log as Array<Record<string, unknown>>;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ type: "note", text: "first" });
    expect(list[1]).toMatchObject({ type: "login", user: "mav" });
  });

  test("log: remove first row leaves second row at index 0", async ({ page }) => {
    const logArr = collapsibleByTitle(page, "Audit log");
    await expandIfClosed(page, "Audit log");

    await addArrayRow(logArr, "Note event");
    await logArr.getByLabel(labelRegex("Text")).fill("doomed");

    await addArrayRow(logArr, "Login event");
    await logArr.getByLabel(labelRegex("User")).fill("survivor");
    await logArr.getByLabel(labelRegex("User")).blur();

    let preview = await readPreview(page);
    expect((preview.log as Array<unknown>).length).toBe(2);

    await logArr.getByRole("button", { name: "Remove", exact: true }).first().click();

    preview = await readPreview(page);
    const list = preview.log as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: "login", user: "survivor" });
  });

  // ── 7. 3-level depth (subscriber → endpoint → auth) ─────────────────

  test("subscriber: variant picker shows Email subscriber / Webhook subscriber", async ({
    page,
  }) => {
    await expandIfClosed(page, "Subscriber");
    const trigger = variantTrigger(page, "Subscriber");
    await expect(trigger).toBeVisible();
    await trigger.click();
    const scope = variantSection(page, "Subscriber");
    const menu = scope.locator(".as-dropdown-menu");
    await expect(menu.locator(".as-dropdown-item")).toHaveCount(2);
    await expect(menu.locator(".as-dropdown-item").nth(0)).toHaveText(/Email subscriber/);
    await expect(menu.locator(".as-dropdown-item").nth(1)).toHaveText(/Webhook subscriber/);
    await trigger.click();
  });

  test("subscriber: pick Email → Address field appears, fill → preview.subscriber.kind === 'email'", async ({
    page,
  }) => {
    await switchVariant(page, "Subscriber", "Email subscriber");
    const scope = variantSection(page, "Subscriber");
    const address = scope.getByLabel(labelRegex("Address"));
    await expect(address).toBeVisible();
    await address.fill("team@example.com");
    await address.blur();

    const preview = await readPreview(page);
    const sub = preview.subscriber as Record<string, unknown>;
    expect(sub).toMatchObject({ kind: "email", address: "team@example.com" });
  });

  test("subscriber: switch to Webhook → nested Endpoint object reveals URL field; preview.subscriber.kind === 'webhook'", async ({
    page,
  }) => {
    await switchVariant(page, "Subscriber", "Webhook subscriber");
    // The Endpoint object is a level-2 nested collapsible that starts
    // closed — expand it so the URL leaf input is interactable.
    await expandIfClosed(page, "Endpoint");
    const scope = variantSection(page, "Subscriber");
    const url = scope.getByLabel(labelRegex("URL"));
    await expect(url).toBeVisible();
    await url.fill("https://api.example.com/hook");
    await url.blur();

    const preview = await readPreview(page);
    const sub = preview.subscriber as Record<string, unknown>;
    expect(sub.kind).toBe("webhook");
    const endpoint = sub.endpoint as Record<string, unknown>;
    expect(endpoint.url).toBe("https://api.example.com/hook");
  });

  test("subscriber: Webhook + add Basic auth → nested 3rd-level union resolves with username/password", async ({
    page,
  }) => {
    await switchVariant(page, "Subscriber", "Webhook subscriber");
    await expandIfClosed(page, "Endpoint");
    const scope = variantSection(page, "Subscriber");
    await scope.getByLabel(labelRegex("URL")).fill("https://api.example.com/hook");

    // Auth is an optional discriminated union nested inside the Endpoint
    // object. It surfaces as an `.as-object-empty-add` "Add Auth" button
    // wrapped in an `.as-dropdown` that also hosts the variant menu.
    const authScope = emptyStateDropdown(page, "Auth", scope);
    await expect(authScope.locator(".as-object-empty-add")).toBeVisible();
    await authScope.locator(".as-object-empty-add").click();
    await pickVariant(authScope, "Basic auth");

    await scope.getByLabel(labelRegex("Username")).fill("admin");
    const pwd = scope.getByLabel(labelRegex("Password"));
    await pwd.fill("s3cret");
    await pwd.blur();

    const preview = await readPreview(page);
    const sub = preview.subscriber as Record<string, unknown>;
    const endpoint = sub.endpoint as Record<string, unknown>;
    const auth = endpoint.auth as Record<string, unknown>;
    expect(auth).toMatchObject({ kind: "basic", username: "admin", password: "s3cret" });
  });
});
