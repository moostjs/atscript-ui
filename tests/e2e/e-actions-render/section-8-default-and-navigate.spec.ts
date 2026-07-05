// Section 8 — Actions: default-row navigate + main-action interaction.
//
// Read-only batch (no DB mutations):
//   - 8.1  Default row action via dblclick (covered by 8.17 — see scenario doc).
//   - 8.17 Default action interaction with row main-action: dblclick on
//          /users navigates to `/users/<preferredId>/edit`; the row menu
//          marks `Edit` with `data-default`. /customers exposes
//          `view-orders` as the row's only declared action AND default —
//          dblclick on a row navigates to `/orders?customerId=<n>` and
//          the labelled single button does the same.
//   - 8.2  Navigate action with `$1` substitution: `View orders` →
//          `/orders?customerId=<preferredId>` with the orders table
//          loaded in a single composed `/pages` (single-fetch URL bridge,
//          batch D's contract).
//
// Flake notes: dblclick → navigation race is the obvious risk. We use
// `Promise.all([waitForURL(...), dblclick()])` so the listener is armed
// BEFORE the gesture fires.
//
// Scenario-doc divergences:
//   - 8.17 step 3 says `Edit` carries the default-marker indicator. The
//     framework's marker is `data-default=""` on the menu item (passed via
//     `<AsActionMenuItem>` `default` prop → `:data-default="default ? '' : undefined"`).
//     We assert on that attribute.

import { type Locator, expect, test } from "../fixtures";

import {
  columnCellIndex,
  expectSinglePages,
  gotoTable,
  openRowActionsMenu,
  rowByCellText,
} from "../helpers";

/**
 * Read the first customers-table row's id (numeric preferredId). Used
 * three times in this file — extract instead of inlining the cell-text
 * read each time.
 */
async function readFirstCustomerId(table: Locator): Promise<string> {
  const idIdx = await columnCellIndex(table, "id");
  const firstRow = table.locator("tbody tr").first();
  const text = ((await firstRow.locator("td").nth(idIdx).textContent()) ?? "").trim();
  expect(text).toMatch(/^\d+$/u);
  return text;
}

test.describe("Section 8.1 + 8.17 — Default row action via dblclick / main-action", () => {
  test("8.17 /users — dblclick admin row navigates to `/users/admin/edit`; menu marks Edit data-default", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const usernameIdx = await columnCellIndex(table, "username");
    const adminRow = rowByCellText(table, usernameIdx, "admin").first();
    await expect(adminRow).toHaveCount(1);

    // Open the row menu first (BEFORE dblclick navigates away). `Edit` is
    // declared with `default: true`, so its menu item carries `data-default`.
    const menu = await openRowActionsMenu(page, adminRow);
    const editItem = menu.locator(".as-row-actions-menu-item").filter({ hasText: "Edit" });
    await expect(editItem).toHaveCount(1);
    await expect(editItem).toHaveAttribute("data-default", "true");
    // Linkable navigate menu item renders as a real `<a href>` with the
    // `$1`-interpolated destination (`/users/$1/edit` → admin's preferredId).
    await expect(editItem).toHaveJSProperty("tagName", "A");
    await expect(editItem).toHaveAttribute("href", "/users/admin/edit");
    // Other entries do not carry the default marker.
    const copyItem = menu
      .locator(".as-row-actions-menu-item")
      .filter({ hasText: "Copy invite link" });
    await expect(copyItem).toHaveCount(1);
    expect(await copyItem.getAttribute("data-default")).toBeNull();
    // Close the menu before dispatching dblclick on the row body — Reka
    // closes on outside-click which races with our navigation listener.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // dblclick on the username cell of admin's row → main-action path runs
    // the default `edit` action (`processor: 'navigate'`,
    // `value: '/users/$1/edit'`). `$1` substitutes admin's preferredId
    // (`username`) per `@db.table.preferredId.uniqueIndex 'users_username_idx'`.
    await Promise.all([
      page.waitForURL(/\/users\/admin\/edit$/u),
      adminRow.locator("td").nth(usernameIdx).dblclick(),
    ]);
  });

  test("8.17 /customers — dblclick navigates to /orders?customerId=<id>; single click on labelled button does the same", async ({
    page,
  }) => {
    await gotoTable(page, "customers");
    const table = page.locator("table.as-table").first();
    const firstIdText = await readFirstCustomerId(table);
    const firstRow = table.locator("tbody tr").first();

    // The labelled-single render is the load-bearing assertion: customers
    // sets `noRowDelete: true` AND has exactly one declared row action
    // (`view-orders`, no icon). Result: cell is a `as-row-actions-btn`
    // with `as-row-actions-btn-labelled` carrying `data-default`.
    const singleBtn = firstRow.locator(".as-row-actions-btn").first();
    await expect(singleBtn).toHaveClass(/as-row-actions-btn-labelled/u);
    await expect(singleBtn).toHaveAttribute("data-default", "true");
    await expect(singleBtn.locator(".as-row-actions-btn-label")).toHaveText("View orders");
    await expect(singleBtn.locator(".as-row-actions-btn-icon")).toHaveCount(0);
    // Linkable navigate action → real anchor carrying the interpolated href.
    await expect(singleBtn).toHaveJSProperty("tagName", "A");
    await expect(singleBtn).toHaveAttribute("href", `/orders?customerId=${firstIdText}`);

    // Single-click on the labelled button navigates (it IS the default).
    await Promise.all([
      page.waitForURL(new RegExp(`/orders\\?customerId=${firstIdText}(?:&|$)`, "u")),
      singleBtn.click(),
    ]);

    // Back to /customers for the dblclick path.
    await gotoTable(page, "customers");
    const table2 = page.locator("table.as-table").first();
    const firstRow2 = table2.locator("tbody tr").first();
    // Re-read the first id (seed is stable but order is independent).
    const firstIdText2 = await readFirstCustomerId(table2);

    // dblclick on a data cell of the customer row → main-action fires the
    // default `view-orders` action.
    await Promise.all([
      page.waitForURL(new RegExp(`/orders\\?customerId=${firstIdText2}(?:&|$)`, "u")),
      firstRow2
        .locator("td")
        .nth(await columnCellIndex(table2, "name"))
        .dblclick(),
    ]);
  });
});

test.describe("Section 8.2 — Navigate action with $1 substitution", () => {
  test("/customers `View orders` → /orders?customerId=<id> with the customer-scoped /pages firing once", async ({
    page,
  }) => {
    await gotoTable(page, "customers");
    const table = page.locator("table.as-table").first();
    const firstIdText = await readFirstCustomerId(table);
    const firstRow = table.locator("tbody tr").first();

    // The labelled single button is the navigate trigger here — clicking
    // it should replace the route AND fire EXACTLY ONE composed `/pages`
    // on the orders table (Scenario 6.1 — single-fetch URL bridge).
    const captured = await expectSinglePages(
      page,
      async () => {
        await Promise.all([
          page.waitForURL(new RegExp(`/orders\\?customerId=${firstIdText}(?:&|$)`, "u")),
          firstRow.locator(".as-row-actions-btn").first().click(),
        ]);
        // Wait for the orders table loading overlay to clear so the
        // /pages observer's quiet window includes the recipient fetch.
        await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(captured.url)).toMatch(
      new RegExp(`customerId=${firstIdText}\\b`, "u"),
    );

    // Result rows present (filtered to that customer).
    const ordersTable = page.locator("table.as-table").first();
    await expect(ordersTable.locator("tbody tr:has(td)").first()).toBeVisible();
  });
});
