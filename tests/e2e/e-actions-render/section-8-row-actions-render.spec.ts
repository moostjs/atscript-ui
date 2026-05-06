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
// (admin / manager / viewer / alice) + 1 pending (bob); no suspended /
// invited users. Suspended-row + invited-row coverage deferred.
//
// `__remove` (Delete) is added when:
//   - user has write permission on the resource AND
//   - consumer didn't set `noRowDelete: true` AND
//   - `/meta.crud.remove` survives the wire envelope.
// /customers sets `noRowDelete: true` so Delete never appears regardless
// of role; viewer-on-/users hits both the wire-strip and the row-delete
// gate.

import { type BrowserContext, type Locator, type Page, expect, test } from "@playwright/test";

import { authFileFor, gotoTable } from "../helpers";

async function openRowActionsMenu(page: Page, row: Locator): Promise<Locator> {
  await row.locator(".as-row-actions-more").click();
  const menu = page.locator(".as-row-actions-menu");
  await expect(menu).toBeVisible();
  return menu;
}

function rowByCellText(table: Locator, columnIndex: number, text: string): Locator {
  return table.locator("tbody tr").filter({
    has: table.page().locator(`xpath=./td[${columnIndex + 1}][normalize-space(.)="${text}"]`),
  });
}

async function columnCellIndex(table: Locator, columnPath: string): Promise<number> {
  const th = table.locator(`thead th[data-column-path="${columnPath}"]`);
  await expect(th).toHaveCount(1);
  return await th.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
}

async function menuItemLabels(menu: Locator): Promise<string[]> {
  const items = menu.locator(".as-row-actions-menu-item");
  const raw = await items.evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
  return raw;
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
    const usernameIdx = await columnCellIndex(table, "username");
    const adminRow = rowByCellText(table, usernameIdx, "admin").first();

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
    const usernameIdx = await columnCellIndex(table, "username");
    const adminRow = rowByCellText(table, usernameIdx, "admin").first();
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
    const usernameIdx = await columnCellIndex(table, "username");
    const bobRow = rowByCellText(table, usernameIdx, "bob").first();
    await expect(bobRow).toHaveCount(1);
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
    const usernameIdx = await columnCellIndex(table, "username");
    const aliceRow = rowByCellText(table, usernameIdx, "alice").first();
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

  test("Absent — viewer (read-only) on /users: synth __remove (Delete) is stripped from the row menu", async ({
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
      const usernameIdx = await columnCellIndex(table, "username");
      const adminRow = rowByCellText(table, usernameIdx, "admin").first();

      // Scenario 8.16's "Absent — no write permission" claim narrows to:
      // `Delete` (synth __remove) is gated on `crud.remove` AND
      // `canWrite`; viewer fails `canWrite`, so Delete is stripped from
      // the cell's menu. We assert ONLY that — Scenario 8.10's claim
      // that `@ArbacAction("update")` strips `Suspend` / `Activate` /
      // `Resend invite` from `/meta.actions[]` is owned by batch F and
      // not enforced here (the demo currently leaves those in the
      // viewer's row menu — see scenario-doc divergence note in the
      // batch hand-off).
      const menu = await openRowActionsMenu(page, adminRow);
      const labels = await menuItemLabels(menu);
      expect(labels).toEqual(expect.arrayContaining(["Edit", "Copy invite link"]));
      expect(labels).not.toContain("Delete");
    } finally {
      await viewerCtx?.close();
    }
  });
});
