// Section 8.14 + 8.15 + 8.16 — Row-actions cell rendering, per-row gating,
// and synthetic `__remove` (Delete) presence/absence.
//
// Read-only batch — no Confirm clicks (mutations belong to batch F).
//
// Render branches in `<AsRowActions>` (see `as-row-actions.vue`):
//   - total === 0 → empty `<td.as-row-actions>` placeholder.
//   - total === 1 + has icon → square icon button (`as-row-actions-btn`,
//     no `as-row-actions-btn-labelled`).
//   - total === 1 + no icon → labelled text button
//     (`as-row-actions-btn` + `as-row-actions-btn-labelled` carrying
//     `data-default` when the action is the row's default).
//   - total > 1 → dropdown trigger (`as-row-actions-more`) + portalled
//     `.as-row-actions-menu` listing every surviving action.
//
// Per-row gating drops actions until total falls below 2, downgrading
// the cell from dropdown → single button. The seed has 4 active users
// (admin / manager / viewer / alice) + 1 pending (bob) + 1 invited
// (eve); no suspended users. Suspended-row coverage deferred.
//
// `__remove` (Delete) is added when:
//   - user has write permission on the resource AND
//   - consumer didn't set `noRowDelete: true` AND
//   - `/meta.crud.remove` survives the wire envelope.
// /customers sets `noRowDelete: true` so Delete never appears regardless
// of role; viewer-on-/users hits both the wire-strip (crud.remove gone)
// and the row-delete gate (canWrite false).
//
// Action wire-strip: the demo's `AsArbacDbController` overrides
// `applyMetaOverlay` to filter `actions[]` by per-method `@ArbacAction`
// permission, so viewer's `/meta.actions[]` excludes activate / suspend
// / resend-invite (all gated `@ArbacAction("update")`). Class-level
// `@DbTableActions` entries (invite-user / export-csv / edit /
// copy-invite-link) carry no method-level metadata so they pass through
// unfiltered — the demo accepts that navigate-only table actions stay
// visible and rely on destination-route ARBAC for the actual gate.

import { type BrowserContext, type Locator, expect, test } from "@playwright/test";

import { authFileFor, gotoTable, openRowActionsMenu, userRowByName } from "../helpers";

async function menuItemLabels(menu: Locator): Promise<string[]> {
  const items = menu.locator(".as-row-actions-menu-item");
  return await items.evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
}

test.describe("Section 8.14 — Row-actions cell render branches", () => {
  test("Single + labelled: /customers `View orders` is the labelled-button render", async ({
    page,
  }) => {
    await gotoTable(page, "customers");
    const table = page.locator("table.as-table").first();
    const firstRow = table.locator("tbody tr").first();

    // No dropdown trigger — single-button render replaces it.
    await expect(firstRow.locator(".as-row-actions-more")).toHaveCount(0);

    const btn = firstRow.locator(".as-row-actions-btn").first();
    await expect(btn).toHaveCount(1);
    // Labelled = text-only path (no icon glyph). The action also carries
    // `default: true`, so `data-default` is present.
    await expect(btn).toHaveClass(/as-row-actions-btn-labelled/u);
    await expect(btn).toHaveAttribute("data-default", "true");
    await expect(btn.locator(".as-row-actions-btn-icon")).toHaveCount(0);
    await expect(btn.locator(".as-row-actions-btn-label")).toHaveText("View orders");
    // The `aria-label` / `title` is the action's label.
    await expect(btn).toHaveAttribute("aria-label", "View orders");
    await expect(btn).toHaveAttribute("title", "View orders");
  });

  test("Dropdown (total > 1): /users renders `as-row-actions-more` trigger; menu lists Edit / Copy invite link / Delete", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const adminRow = await userRowByName(table, "admin");

    // Single-button paths absent — dropdown trigger present.
    await expect(adminRow.locator(".as-row-actions-btn-labelled")).toHaveCount(0);
    const trigger = adminRow.locator(".as-row-actions-more");
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute("aria-label", "Row actions");
    await expect(trigger.locator(".i-as-menu")).toHaveCount(1);

    const menu = await openRowActionsMenu(page, adminRow);
    const labels = await menuItemLabels(menu);
    // Admin is `active` so `Activate` is gated out by the per-row
    // `$actions[]` predicate; `Resend invite` only fires for `invited`.
    // The menu therefore lists: Edit (default), Copy invite link,
    // Delete (synth __remove), Suspend.
    expect(labels).toEqual(
      expect.arrayContaining(["Edit", "Copy invite link", "Suspend", "Delete"]),
    );
    expect(labels).not.toContain("Activate");
    expect(labels).not.toContain("Resend invite");

    // Default-action marker (data-default) lands on the first menu
    // group's default entry — `Edit`.
    const editItem = menu.locator(".as-row-actions-menu-item").filter({ hasText: "Edit" });
    await expect(editItem).toHaveAttribute("data-default", "true");
  });
});

test.describe("Section 8.15 — Per-row gating drops actions out of the menu", () => {
  test("/users — admin (active) menu excludes Activate + Resend invite", async ({ page }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const adminRow = await userRowByName(table, "admin");
    const menu = await openRowActionsMenu(page, adminRow);
    const labels = await menuItemLabels(menu);
    // active → Suspend stays (predicate fires for status==='suspended'),
    // Activate filtered out, Resend invite filtered out.
    expect(labels).toContain("Suspend");
    expect(labels).not.toContain("Activate");
    expect(labels).not.toContain("Resend invite");
  });

  test("/users — bob (pending) menu includes Activate + Suspend; excludes Resend invite", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const bobRow = await userRowByName(table, "bob");
    const menu = await openRowActionsMenu(page, bobRow);
    const labels = await menuItemLabels(menu);
    // pending → Activate eligible (predicate fires for active);
    // Suspend eligible (predicate fires for suspended); Resend invite
    // filtered out (predicate fires for status !== 'invited').
    expect(labels).toContain("Activate");
    expect(labels).toContain("Suspend");
    expect(labels).toContain("Edit");
    expect(labels).toContain("Copy invite link");
    expect(labels).toContain("Delete");
    expect(labels).not.toContain("Resend invite");
  });
});

test.describe("Section 8.16 — Synthetic `__remove` (Delete) presence + absence", () => {
  test("Present: admin on /users — Delete in the row menu", async ({ page }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const aliceRow = await userRowByName(table, "alice");
    const menu = await openRowActionsMenu(page, aliceRow);
    await expect(
      menu.locator(".as-row-actions-menu-item").filter({ hasText: "Delete" }),
    ).toHaveCount(1);
    // Don't click Confirm — that's batch F's territory. Closing the
    // menu cleans up the portal for the next test.
    await page.keyboard.press("Escape");
  });

  test("Absent — `noRowDelete: true` on /customers: NO Delete anywhere; single labelled-button render persists", async ({
    page,
  }) => {
    await gotoTable(page, "customers");
    const table = page.locator("table.as-table").first();
    const firstRow = table.locator("tbody tr").first();

    // Single labelled button → no dropdown trigger means no menu surface
    // to host Delete on. Verify both: no `as-row-actions-more` AND the
    // labelled button is the sole render.
    await expect(firstRow.locator(".as-row-actions-more")).toHaveCount(0);
    await expect(firstRow.locator(".as-row-actions-btn-labelled")).toHaveCount(1);

    // Defensive: even if a future render path exposes a menu, no
    // descendant in the row carries `Delete` text.
    expect(
      await firstRow.locator(".as-row-actions").evaluate((el) => (el.textContent ?? "").trim()),
    ).not.toContain("Delete");
  });

  test("Absent — viewer (read-only) on /users: ARBAC strips gated actions + synth __remove from the row menu", async ({
    browser,
  }) => {
    let viewerCtx: BrowserContext | undefined;
    try {
      // Spawn a fresh context with the viewer role's stored session.
      // Pattern lifted from batch D's 6.7 recipient block.
      viewerCtx = await browser.newContext({ storageState: authFileFor("viewer") });
      const page = await viewerCtx.newPage();
      await gotoTable(page, "users");

      const table = page.locator("table.as-table").first();
      const adminRow = await userRowByName(table, "admin");

      // Scenarios 8.10 + 8.16 converge: viewer loses activate / suspend /
      // resend-invite (gated `@ArbacAction("update")`) AND the synth
      // `__remove` (`crud.remove` stripped). Survivors are the un-gated
      // row actions `edit` + `copy-invite-link`; toolbar-level
      // `invite-user` / `export-csv` aren't in this menu.
      const menu = await openRowActionsMenu(page, adminRow);
      const labels = await menuItemLabels(menu);
      expect(labels).toEqual(["Edit", "Copy invite link"]);
      expect(labels).not.toContain("Delete");
      expect(labels).not.toContain("Suspend");
      expect(labels).not.toContain("Activate");
      expect(labels).not.toContain("Resend invite");
    } finally {
      await viewerCtx?.close();
    }
  });
});
