// Section 25 — Dynamic fn-driven props.
//
// Exercises every `@ui.form.fn.*` annotation plus the `@ui.form.validate`
// custom-validator string against the EventRegistration schema rendered
// at `/forms-demo/dynamic-form`. The page wires a single `<AsForm>` with
// default types — the only thing under test is that the dynamic resolver
// installed in `entry-client.ts` actually re-evaluates each fn on every
// data mutation.
//
// The preview block under the form exposes the full `{ value }` payload
// as JSON (`data-testid=dynamic-form-preview`) so tests can read the
// current form state without having to scrape input values.

import { expect, test, type Locator, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/dynamic-form");
  await page.waitForLoadState("networkidle");
  // The form is in the DOM the moment hydration completes; wait for the
  // First Name input so subsequent locator queries don't race the SSR →
  // hydration handoff.
  await expect(page.getByTestId("dynamic-form").getByLabel("First Name")).toBeVisible();
}

const section = (page: Page): Locator => page.getByTestId("dynamic-form");

test.describe("Section 25 — Dynamic fn-driven props", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── 1. Form title reacts to firstName (@ui.form.fn.title) ────────
  test("form title (@ui.form.fn.title) reacts to firstName", async ({ page }) => {
    // AsObject renders the form title as `<h2 class="as-form-title">`.
    const title = section(page).locator(".as-form-title");
    await expect(title).toHaveText("Event Registration");
    await section(page).getByLabel("First Name").fill("Alice");
    await expect(title).toHaveText("Registration for Alice");
  });

  // ── 2. Email placeholder reacts to firstName (@ui.form.fn.placeholder) ──
  test("email placeholder (@ui.form.fn.placeholder) reacts to firstName", async ({ page }) => {
    const email = section(page).getByLabel("Email", { exact: true });
    await expect(email).toHaveAttribute("placeholder", "you@example.com");
    await section(page).getByLabel("First Name").fill("Bob");
    await expect(email).toHaveAttribute("placeholder", "Email for Bob");
  });

  // ── 3. Email description reacts to firstName (@ui.form.fn.description) ──
  test("email description (@ui.form.fn.description) reacts to firstName", async ({ page }) => {
    // AsFieldShell renders the description as `.as-field-description`
    // sibling. Field labels are not unique, so anchor on the description
    // text directly.
    const initial = section(page).locator(".as-field-description", {
      hasText: "We will send your registration confirmation here",
    });
    await expect(initial).toBeVisible();
    await section(page).getByLabel("First Name").fill("Carol");
    const reacted = section(page).locator(".as-field-description", {
      hasText: "Confirmation will be sent to this address for Carol",
    });
    await expect(reacted).toBeVisible();
  });

  // ── 4. Submit disabled until firstName + email filled (@ui.form.fn.submit.disabled) ──
  test("submit button (@ui.form.fn.submit.disabled) toggles disabled with firstName + email", async ({
    page,
  }) => {
    const submit = section(page).locator(".as-submit-btn");
    await expect(submit).toBeDisabled();
    await section(page).getByLabel("First Name").fill("Dan");
    await expect(submit).toBeDisabled();
    await section(page).getByLabel("Email", { exact: true }).fill("dan@example.com");
    await expect(submit).toBeEnabled();
  });

  // ── 5. Submit text reacts to attendee count (@ui.form.fn.submit.text) ──
  test("submit button text (@ui.form.fn.submit.text) reflects attendee count", async ({ page }) => {
    const submit = section(page).locator(".as-submit-btn");
    await expect(submit).toHaveText("Register");
    // Toggling hasPlusOne flips `attendees` (a phantom paragraph driven by
    // @ui.form.fn.value) from 1 to 2; the top-level submit-text fn picks
    // up the new value and switches the button label.
    await section(page).getByLabel("Bringing a plus-one?").check();
    await expect(submit).toHaveText("Register 2 attendees");
  });

  // ── 6. plusOneName hidden until hasPlusOne (@ui.form.fn.hidden) ──
  test("plusOneName (@ui.form.fn.hidden) appears only when hasPlusOne is true", async ({
    page,
  }) => {
    const plusOne = section(page).getByLabel("Plus-one's name");
    // Dynamic resolver hides via v-show (`display: none`), not v-if — the
    // input stays in the DOM. Assert visibility rather than count.
    await expect(plusOne).toBeHidden();
    await section(page).getByLabel("Bringing a plus-one?").check();
    await expect(plusOne).toBeVisible();
  });

  // ── 7. shirtSize options expand with hasPlusOne (@ui.form.fn.options) ──
  test("shirtSize (@ui.form.fn.options) grows from 4 → 6 options when hasPlusOne is on", async ({
    page,
  }) => {
    const shirt = section(page).getByLabel("T-shirt size");
    await expect(shirt.locator("option")).toHaveCount(4);
    await section(page).getByLabel("Bringing a plus-one?").check();
    await expect(shirt.locator("option")).toHaveCount(6);
    // The added options carry the "Plus-One" prefix — confirm at least
    // one of them rendered.
    await expect(shirt.locator("option", { hasText: "Plus-One Small" })).toHaveCount(1);
  });

  // ── 8. dietary readonly until email entered (@ui.form.fn.readonly) ──
  test("dietary (@ui.form.fn.readonly) drops readonly attr once email is filled", async ({
    page,
  }) => {
    const dietary = section(page).getByLabel("Dietary preferences");
    await expect(dietary).toHaveAttribute("readonly", "");
    await section(page).getByLabel("Email", { exact: true }).fill("a@b.com");
    await expect(dietary).not.toHaveAttribute("readonly", /.*/);
  });

  // ── 9. dietary hint reacts to email state (@ui.form.fn.hint) ─────
  test("dietary hint (@ui.form.fn.hint) switches text on email entry", async ({ page }) => {
    const hint = section(page).locator(".as-error-slot", {
      hasText: "Enter your email first to enable this",
    });
    await expect(hint).toBeVisible();
    await section(page).getByLabel("Email", { exact: true }).fill("a@b.com");
    const reacted = section(page).locator(".as-error-slot", {
      hasText: "Comma-separated list, e.g. vegan, no nuts",
    });
    await expect(reacted).toBeVisible();
  });

  // ── 10. notes label reacts to length (@ui.form.fn.label) ─────────
  test("notes label (@ui.form.fn.label) appends '(long)' over 200 chars", async ({ page }) => {
    const form = section(page);
    // Two AsObject titles ('attendees' phantom paragraph is the lone other
    // field-level title here) — assert the notes label by its text only.
    await expect(form.locator(".as-field-label", { hasText: /^Notes$/ })).toHaveCount(1);
    const notes = form.getByLabel("Notes");
    await notes.fill("x".repeat(201));
    await expect(form.locator(".as-field-label", { hasText: "Notes (long)" })).toHaveCount(1);
  });

  // ── 11. notes hint reports char count (@ui.form.fn.hint) ─────────
  test("notes hint (@ui.form.fn.hint) reports running char count", async ({ page }) => {
    const form = section(page);
    const notes = form.getByLabel("Notes");
    await notes.fill("hello world!"); // 12 chars
    // Notes hint shares its slot with `dietary` hint (both `.as-error-slot`).
    // Filter by the unique '12 / 500 chars' text.
    await expect(form.locator(".as-error-slot", { hasText: "12 / 500 chars" })).toHaveCount(1);
  });

  // ── 12. notes validate (@ui.form.validate) blocks submit at 501+ chars ──
  test("notes (@ui.form.validate) blocks submit when over 500 chars", async ({ page }) => {
    const form = section(page);
    // Fill firstName + email so the form-level submit-disabled fn lets the
    // user attempt submission.
    await form.getByLabel("First Name").fill("Eve");
    await form.getByLabel("Email", { exact: true }).fill("eve@example.com");

    const notes = form.getByLabel("Notes");
    // 501 chars — one over the 500-char ceiling enforced by the validate
    // function. Use evaluate to set the value without typing one char at a
    // time, then dispatch input so v-model picks it up.
    await notes.evaluate((el, val: string) => {
      const input = el as HTMLInputElement;
      input.value = val;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, "x".repeat(501));

    await form.locator(".as-submit-btn").click();
    // The validator's error message bubbles up into the per-field error
    // slot. Match the message text directly.
    await expect(
      form.locator(".as-error-slot", { hasText: "Notes must be 500 chars or fewer" }),
    ).toBeVisible();
  });

  // ── 13. notes classes (@ui.form.fn.classes) react above 400 chars ──
  test("notes (@ui.form.fn.classes) gains 'as-notes-warn' over 400 chars", async ({ page }) => {
    const form = section(page);
    const notes = form.getByLabel("Notes");
    // The `.as-default-field` wrapper around `notes` is where AsField
    // applies the resolved class list — match by the unique class.
    const wrapper = form.locator(".as-default-field.as-notes-warn");
    await expect(wrapper).toHaveCount(0);
    await notes.fill("y".repeat(401));
    await expect(wrapper).toHaveCount(1);
  });

  // ── 14. confirmAttendance label + disabled (@ui.form.fn.label + .disabled) ──
  test("confirmAttendance reacts when firstName + email are filled", async ({ page }) => {
    const form = section(page);
    const confirm = form.getByLabel(/Confirm attendance/);
    // Initially the fn-resolved label includes the "fill name + email
    // first" suffix and the checkbox is disabled.
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveAccessibleName("Confirm attendance — fill name + email first");
    await form.getByLabel("First Name").fill("Frank");
    await form.getByLabel("Email", { exact: true }).fill("frank@example.com");
    // After both gating fields are filled the disabled fn returns false
    // and the label fn drops the trailing hint.
    await expect(confirm).toBeEnabled();
    await expect(confirm).toHaveAccessibleName("Confirm attendance");
  });

  // ── 15. attendees paragraph value reacts to hasPlusOne (@ui.form.fn.value) ──
  test("attendees paragraph (@ui.form.fn.value) flips 1 → 2 on hasPlusOne", async ({ page }) => {
    const form = section(page);
    // The phantom `ui.paragraph` renders as a bare `<p aria-live="polite">`
    // with no shell/label. There is exactly one such `<p>` inside the
    // form, so a tag-based locator suffices.
    const attendees = form.locator("p[aria-live='polite']");
    await expect(attendees).toHaveText("1");
    await form.getByLabel("Bringing a plus-one?").check();
    await expect(attendees).toHaveText("2");
  });

  // ── 16. notes styles (@ui.form.fn.styles) apply over 400 chars ───
  test("notes (@ui.form.fn.styles) gains an inline border-color over 400 chars", async ({
    page,
  }) => {
    const form = section(page);
    const notes = form.getByLabel("Notes");
    // AsFieldShell binds `style` onto the field wrapper, not the raw
    // input — locate the wrapper as the ancestor `.as-default-field`
    // of the notes input and read its inline style attr.
    const wrapper = form.locator('.as-default-field:has(input[name="notes"])');
    let style = (await wrapper.getAttribute("style")) ?? "";
    expect(style).not.toContain("border-color");
    await notes.fill("z".repeat(401));
    style = (await wrapper.getAttribute("style")) ?? "";
    expect(style).toMatch(/border-color\s*:\s*orange/);
  });

  // ── 17. Sanity — page loads without console errors ───────────────
  test("page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      errors.push(String(err));
    });
    await page.goto("/forms-demo/dynamic-form");
    await page.waitForLoadState("networkidle");
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
