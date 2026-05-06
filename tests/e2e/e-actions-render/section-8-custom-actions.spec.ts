// Section 8 — Actions: custom-processor surfaces (no server hit on the
// action endpoint).
//
// Read-only batch:
//   - 8.3 `Copy invite link` (row, `processor: 'custom'`) writes the
//         literal `${origin}/invite/${preferredId}` via the clipboard
//         sink and pushes a toast. NO `/actions/...` POST fires; no
//         `/pages` re-fetch.
//   - 8.4 `Export CSV` (table, `processor: 'custom'`) — framework
//         contract only: action is rendered in the toolbar, click fires
//         the `@action` event (toast appears) and zero `/actions/...`
//         POSTs. The download / filename / read-endpoint shape is the
//         demo's `onAction` handler in TablePage.vue and out of scope
//         for the framework e2e suite.
//
// Note: `Export CSV` is declared as a table-level action; with rows
// selected, `<AsTableActions>` hides it by design (table-level actions
// don't surface in selection-active mode). Single-test coverage below
// — no "with N rows selected" branch since the action isn't reachable
// in that state.

import { type Locator, type Page, expect, test } from "@playwright/test";

import { expectNoPages, getLastClipboardWrite, gotoTable, installClipboardSink } from "../helpers";

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

/**
 * Inline observer for "did the action endpoint fire?" — increments on any
 * `POST .../actions/<name>` during the action invocation window. Pair with
 * `expectNoPages` to assert the full no-server-hit contract for `processor:
 * 'custom'` actions.
 */
function countActionEndpointHits(page: Page): { count: () => number; dispose: () => void } {
  let count = 0;
  const handler = (req: import("@playwright/test").Request) => {
    if (req.method() !== "POST") return;
    if (/\/api\/db\/tables\/[^/]+\/actions\//u.test(req.url())) count++;
  };
  page.on("request", handler);
  return {
    count: () => count,
    dispose: () => page.off("request", handler),
  };
}

test.describe("Section 8.3 — Custom row action: clipboard via `@action` event", () => {
  test.beforeEach(async ({ page }) => {
    await installClipboardSink(page);
  });

  test("/users `Copy invite link` writes ${origin}/invite/admin to clipboard, no server hit, toast shown", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const usernameIdx = await columnCellIndex(table, "username");
    const adminRow = rowByCellText(table, usernameIdx, "admin").first();
    await expect(adminRow).toHaveCount(1);

    const menu = await openRowActionsMenu(page, adminRow);

    const actionHits = countActionEndpointHits(page);
    try {
      // Wrap the click in `expectNoPages` — `processor: 'custom'` does not
      // hit the server at all (no /actions POST AND no /pages refetch).
      await expectNoPages(
        page,
        async () => {
          await menu
            .locator(".as-row-actions-menu-item")
            .filter({ hasText: "Copy invite link" })
            .click();
          // The clipboard write is synchronous from a user gesture, but
          // the toast is pushed after the promise resolves — wait for the
          // sink before asserting on the value.
          await expect
            .poll(async () => await getLastClipboardWrite(page), {
              timeout: 5_000,
            })
            .not.toBeNull();
        },
        { table: "users" },
      );
      expect(actionHits.count()).toBe(0);
    } finally {
      actionHits.dispose();
    }

    // Clipboard payload is the literal `${origin}/invite/${preferredId}`.
    // `formatIds` URL-encodes the formatted id; admin has no special
    // chars so the encoded form equals `admin`.
    const wrote = await getLastClipboardWrite(page);
    expect(wrote).toBe("http://localhost:3200/invite/admin");

    // Toast appears with the literal demo `pushToast` body. The toast
    // markup is hand-rolled in `ToastStack.vue` (no `as-toast-*` class)
    // — assert by visible text, which is the only stable surface.
    await expect(page.getByText("Copied invite link for admin", { exact: true })).toBeVisible();
  });
});

test.describe("Section 8.4 — Custom table action: Export CSV", () => {
  test("Export CSV is rendered in the toolbar; clicking fires the `@action` event with no `/actions/...` POST", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    // Framework contract: action surfaced in the toolbar dropdown.
    // `Invite user` is `default: true` → labelled primary button;
    // `Export CSV` lives behind the `…` dropdown.
    const tableActions = page.locator(".as-table-actions");
    await tableActions.locator(".as-table-actions-more").click();
    const tableMenu = page.locator(".as-table-actions-menu");
    await expect(tableMenu).toBeVisible();
    const exportItem = tableMenu
      .locator(".as-table-actions-menu-item")
      .filter({ hasText: "Export CSV" });
    await expect(exportItem).toHaveCount(1);

    const actionHits = countActionEndpointHits(page);
    try {
      await exportItem.click();
      // Framework contract: `processor: 'custom'` keeps the click
      // client-side — the `@action` event fires (proven by the toast)
      // and no /actions POST is made. The download / read-endpoint
      // shape is the demo's TablePage.vue handler, not framework.
      await expect(page.getByText("Exporting users (all rows)…", { exact: true })).toBeVisible();
      expect(actionHits.count()).toBe(0);
    } finally {
      actionHits.dispose();
    }
  });
});
