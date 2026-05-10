// Section 22 — AsForm error-handling round-trip.
//
// Covers the three behaviours wired up in the recent error/loading work:
//   - Phase A: external leaf errors auto-dismiss when the user edits the
//     exact field. Reset on `props.errors` identity change.
//   - Phase C: form-level (`__form`) errors render as a dismissable
//     banner with a close button. Local dismissal stays sticky until the
//     next `props.errors` identity change.
//   - Sticky regression guard: leaf edits MUST NOT dismiss `__form`.
//
// The demo target is `/forms-demo/error-dismissal`, a self-contained
// page with manual buttons that inject error objects (each click
// produces a new object reference so the identity-change watch fires).
// No server round-trip — keeps the test isolated from workflow shape
// changes covered by the section 19.W* suites.
//
// Selectors:
//   - `.as-form-error`              — the dismissable banner wrapper
//   - `.as-form-error-message`      — banner text
//   - `.as-form-error-dismiss`      — labeled "Dismiss" banner button
//   - `.as-error-slot`              — leaf field error container
//                                     (rendered inline under each input)

import { expect, test, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/error-dismissal");
  // Wait for hydration. SSR streams the buttons + form into HTML before Vue
  // attaches click handlers; without this, the first `click()` lands on a
  // server-rendered button and the `errors.value = ...` mutation never fires.
  // `networkidle` matches when the SSR + hydration HTTP traffic settles.
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Email")).toBeVisible();
}

const FORM_ERROR_MSG = "Server-side rejection: that email is already taken";
const LEAF_ERROR_MSG = "Already used";

test.describe("Section 22 — AsForm error dismissal & re-arming", () => {
  test("Phase A — external leaf error auto-dismisses on edit", async ({ page }) => {
    await gotoDemo(page);

    // No errors yet.
    await expect(page.locator(".as-error-slot")).toHaveCount(0);

    await page.getByTestId("trigger-leaf-error").click();

    const leafError = page.locator(".as-error-slot", { hasText: LEAF_ERROR_MSG });
    await expect(leafError).toBeVisible();

    // Per-keystroke dismissal: focus the field and type a single character
    // WITHOUT blurring. AsField now watches `model.value` and dismisses
    // on every input — the user expects the error to clear "as I make
    // changes", not after tabbing away.
    const emailInput = page.getByLabel("Email");
    await emailInput.click();
    await emailInput.pressSequentially("a");
    await expect(leafError).toHaveCount(0);
  });

  test("Phase C — __form banner renders, dismisses, and re-arms on next response", async ({
    page,
  }) => {
    await gotoDemo(page);

    const banner = page.locator(".as-form-error");
    const dismiss = page.locator(".as-form-error-dismiss");

    await expect(banner).toHaveCount(0);

    // Trigger #1 → banner visible with the rejection message.
    await page.getByTestId("trigger-form-error").click();
    await expect(banner).toBeVisible();
    await expect(page.locator(".as-form-error-message")).toHaveText(FORM_ERROR_MSG);
    await expect(dismiss).toHaveText("Dismiss");

    // Click dismiss → banner gone (local dismissal flag).
    await dismiss.click();
    await expect(banner).toHaveCount(0);

    // Trigger #2 (NEW object reference) → banner re-renders. Phase C
    // resets `formErrorDismissed` on `props.errors` identity change.
    await page.getByTestId("trigger-form-error").click();
    await expect(banner).toBeVisible();
    await expect(page.locator(".as-form-error-message")).toHaveText(FORM_ERROR_MSG);
  });

  test("Sticky-on-edit — leaf edits do NOT dismiss the __form banner", async ({ page }) => {
    await gotoDemo(page);

    await page.getByTestId("trigger-form-error").click();
    const banner = page.locator(".as-form-error");
    await expect(banner).toBeVisible();

    // Editing the email field (per-keystroke, no blur required)
    // auto-dismisses leaf errors only — the `__form` banner must stay
    // visible (regression guard for the Phase A leaf-only contract).
    const emailInput = page.getByLabel("Email");
    await emailInput.click();
    await emailInput.pressSequentially("changed@example.com");
    await expect(banner).toBeVisible();
    await expect(page.locator(".as-form-error-message")).toHaveText(FORM_ERROR_MSG);
  });
});
