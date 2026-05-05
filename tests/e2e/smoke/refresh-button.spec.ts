// Scenario 12.2 — Refresh button.
//
// Toolbar's Refresh button calls `state.query()` directly — that's the ONE
// case CLAUDE.md allows a non-watcher caller of `state.query()`. So clicking
// it must produce exactly one /pages request (no debounce window since this
// is a user-initiated refresh, not a model mutation). `expectSinglePages`
// uses 700 ms quiet-window heuristics regardless, so it tolerates the immediate-fire case too.

import { expect, test } from "@playwright/test";

import { expectSinglePages, gotoTable } from "../helpers";

test("toolbar refresh button fires exactly one /pages", async ({ page }) => {
  await gotoTable(page, "users");

  await expectSinglePages(
    page,
    async () => {
      await page.getByRole("button", { name: "Refresh" }).click();
    },
    { table: "users" },
  );

  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
});
