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
});
