// Section 20 — WfFinished envelope: finish-screen smoke test.
//
// Phase-4 (WfFinished envelope) introduces three rendering modes on the
// terminal screen: `immediate` (auto-redirect on mount), `auto` (countdown +
// skip), `manual` (user picks). Unit tests in `as-wf-finish.spec.ts` already
// cover each branch and the slot contract; this smoke only verifies the
// end-to-end wire-up for the `immediate` mode against the running demo.
//
// We deliberately don't smoke `auto` (would need fake timers in the page)
// or `manual` (the user-interaction surface is covered by unit tests).

import { expect, test } from "../fixtures";

test.describe("Section 20 — WfFinished envelope (smoke)", () => {
  test("20.1 immediate redirect — submit fills the input form, finishWfWithRedirect routes the SPA", async ({
    browser,
  }) => {
    // Anonymous context — the wf-demo routes don't require auth.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/finish-immediate");

      // Wait for the input form to mount and fill it.
      const noteInput = page.locator('input[name="note"]');
      await expect(noteInput).toBeVisible();
      await noteInput.fill("smoke");

      // Submit and assert the SPA navigated to the redirect target via the
      // `@navigate` listener wired to vue-router.push().
      await Promise.all([
        page.waitForURL(/\/wf-demo$/),
        page.getByRole("button", { name: /Run/i }).click(),
      ]);

      // Confirm we landed on the wf-demo index — the heading is the
      // unambiguous marker.
      await expect(page.getByRole("heading", { name: /WfFinished envelope/i })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("20.2 finish-data — payload renders via overridden #wf.finished slot", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/finish-data");
      await page.locator('input[name="note"]').fill("World");
      await page.getByRole("button", { name: /Run/i }).click();
      const payload = page.getByTestId("finish-data-payload");
      await expect(payload).toBeVisible();
      await expect(payload).toContainText("Hello, World!");
    } finally {
      await ctx.close();
    }
  });

  test("20.3 finish-message — default AsWfFinish renders banner-only on submit", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/finish-message");
      await page.locator('input[name="note"]').fill("smoke");
      await page.getByRole("button", { name: /Run/i }).click();
      await expect(page.getByText(/Nothing to do here/i)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("20.4 finish-aborted — submit path emits success banner", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/finish-aborted");
      await page.locator('input[name="name"]').fill("Ada");
      await page.getByRole("button", { name: /^Submit$/ }).click();
      await expect(page.getByText(/Saved\./i)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("20.5 finish-aborted — Cancel action emits warn banner via finishWfAborted", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/finish-aborted");
      await page.getByRole("button", { name: /^Cancel$/ }).click();
      await expect(page.getByText(/Operation cancelled/i)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("20.6 multi-step — three sequential rounds complete via schema swaps", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/multi-step");
      await expect(page.getByTestId("multi-step-indicator")).toContainText("Step 1 of 3");
      await page.locator('input[name="name"]').fill("Ada");
      await page.getByRole("button", { name: /Continue/i }).click();
      await expect(page.getByTestId("multi-step-indicator")).toContainText("Step 2 of 3");
      // Radio: pick "green".
      await page.locator('input[name="color"][value="green"]').check();
      await page.getByRole("button", { name: /Continue/i }).click();
      await expect(page.getByTestId("multi-step-indicator")).toContainText("Step 3 of 3");
      await page.locator('input[name="confirm"]').check();
      await page.getByRole("button", { name: /Confirm/i }).click();
      await expect(page.getByText(/All three steps complete/i)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("20.7 validation-errors — server re-issues form with inline error then accepts retry", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/validation-errors");
      const emailInput = page.locator('input[name="email"]');
      await emailInput.fill("foo@example.com");
      await page.getByRole("button", { name: /^Submit$/ }).click();
      await expect(page.getByText(/Example domain not allowed/i)).toBeVisible();
      // Same-schema re-validation preserves the value — assert + correct it.
      await expect(emailInput).toHaveValue("foo@example.com");
      await emailInput.fill("foo@real.com");
      await page.getByRole("button", { name: /^Submit$/ }).click();
      await expect(page.getByText(/Email accepted/i)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("20.8 outlet-pause — submit emits sent marker, page shows check-your-email screen", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/outlet-pause");
      await page.locator('input[name="note"]').fill("ping");
      await page.getByRole("button", { name: /Send link/i }).click();
      const sent = page.getByTestId("outlet-pause-sent");
      await expect(sent).toBeVisible();
      await expect(sent).toHaveAttribute("data-sent", "true");
    } finally {
      await ctx.close();
    }
  });
});
