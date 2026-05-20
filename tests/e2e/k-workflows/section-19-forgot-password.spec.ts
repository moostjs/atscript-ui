// Section 19.12 — Forgot password recovery flow.
//
// Covers the alt-action contract on `LoginForm.password` (`@ui.form.action
// 'forgot-password', 'Forgot password?'`). Clicking the link drives the
// workflow into `login-recover-password`, which returns `httpInputRequired
// (RecoveryForm)`; submitting that form calls `finishWfWithData({ ok: true,
// recovery: true }, message)`. `login.vue`'s `onFinished` refreshes
// `useMe()` and `router.push("/")`; the AppShell then redirects anonymous
// visitors back to `/login` (so the final assertion lives there).

import { expect, test, type Browser, type BrowserContext } from "../fixtures";

/** Fresh anonymous browser context — recovery is reachable before login. */
async function newAnonBrowserContext(browser: Browser): Promise<BrowserContext> {
  return await browser.newContext({ storageState: { cookies: [], origins: [] } });
}

test.describe.configure({ mode: "serial" });

test.describe("Section 19.12 — forgot password recovery", () => {
  test("19.12a — 'Forgot password?' link renders in the password field footer-row", async ({
    browser,
  }) => {
    // WHY: regression guard for the field-shell footer-row contract. If
    // `as-field-action-link` drifts out of `as-field-footer-row`, this fails.
    const ctx = await newAnonBrowserContext(browser);
    try {
      const page = await ctx.newPage();
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "AtShop — Sign In" })).toBeVisible();

      const passwordField = page
        .locator(".as-default-field")
        .filter({ has: page.locator('input[name="password"]') });
      await expect(passwordField).toHaveCount(1);

      const link = passwordField.locator(".as-field-footer-row .as-field-action-link");
      await expect(link).toBeVisible();
      await expect(link).toHaveText(/Forgot password\?/);
    } finally {
      await ctx.close();
    }
  });

  test("19.12b — clicking the link swaps the form to the RecoveryForm step", async ({
    browser,
  }) => {
    // WHY: encodes the workflow-routing chain. Click fires
    // `useWfForm().action("forgot-password")` → server sets `ctx.recovery
    // = true` → schema routes to `login-recover-password` → server returns
    // `httpInputRequired(RecoveryForm)` → AsWfForm swaps the input set.
    const ctx = await newAnonBrowserContext(browser);
    try {
      const page = await ctx.newPage();
      await page.goto("/login");

      const passwordField = page
        .locator(".as-default-field")
        .filter({ has: page.locator('input[name="password"]') });
      await passwordField.locator(".as-field-action-link").click();

      // RecoveryForm has a single `email` field; LoginForm's username/password
      // must unmount when the workflow advances to the next step.
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="username"]')).toHaveCount(0);
      await expect(page.locator('input[name="password"]')).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Send recovery email/i })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("19.12c — submitting the recovery form finishes the workflow and lands back on /login", async ({
    browser,
  }) => {
    // WHY: confirms the full happy-path round-trip — `recoverPassword`
    // receives input, `finishWfWithData(..., message)` ends the workflow,
    // client `onFinished` calls `refresh()` + `router.push("/")`, and the
    // AppShell redirects anonymous visitors back to `/login`. A test that
    // only asserted "request was sent" would let a half-broken finisher
    // pass.
    const ctx = await newAnonBrowserContext(browser);
    try {
      const page = await ctx.newPage();
      await page.goto("/login");

      const passwordField = page
        .locator(".as-default-field")
        .filter({ has: page.locator('input[name="password"]') });
      await passwordField.locator(".as-field-action-link").click();

      await expect(page.locator('input[name="email"]')).toBeVisible();
      await page.locator('input[name="email"]').fill("demo@example.test");

      await Promise.all([
        page.waitForURL(/\/login(?:$|\?)/),
        page.getByRole("button", { name: /Send recovery email/i }).click(),
      ]);

      expect(new URL(page.url()).pathname).toBe("/login");
    } finally {
      await ctx.close();
    }
  });
});
