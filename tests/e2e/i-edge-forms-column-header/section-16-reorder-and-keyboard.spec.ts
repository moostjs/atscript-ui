// Section 16 — Drag-reorder + Keyboard nav (batch I).
//
// Read-only batch (model-side `columnNames` reorder; ZERO `/pages` since
// the visible-column SET is unchanged — only the order — Scenario 5.3).
//
//   - 16.8 Drag-reorder: drag /users `Email` header onto `Username` header
//     → `columnNames` reorders so Email comes before Username. ZERO /pages.
//     Settings dialog Columns tab reflects the new order.
//   - 16.8 Locked-column rejection: the synthesized `__actions` column is
//     `col.fixed = true` — the framework strips its `draggable` attr AND
//     skips its drag handlers. We assert the `<th>` for the actions column
//     does NOT carry `draggable="true"`.
//   - 16.9 Header keyboard nav: Reka's `DropdownMenuTrigger` renders the
//     trigger `<button>` with native focusability. Tab reaches the
//     `.as-th-btn`; Enter opens the column menu (DropdownMenu's Enter-on-
//     trigger contract). Esc closes it + restores focus.
//
// Drag-reorder mechanics — `useColumnHeaderDragResize` listens on the
// `<th>`'s native HTML5 `dragstart` / `dragover` / `drop` events.
// Playwright's `locator.dragTo(target)` orchestrates the synthetic
// DataTransfer + dispatches the full sequence in real-browser mode. The
// framework reads `event.clientX` against the target `<th>`'s
// `getBoundingClientRect()` to determine before/after position; dragTo
// drops at the target's center → falls into the after half on left-of-
// center sources moving right, before half on right-of-center sources
// moving left. We pass `targetPosition: { x: 5, y: 10 }` to force the
// `before` half deterministically.
//
// FLAKE NOTE: HTML5 drag-and-drop in headless Chromium is occasionally
// fragile when the drop target's size + position shift mid-drag (resize
// handle on the source `<th>` bumps clientX by ~3px). We pin the source
// to the data column path — NOT the resize handle — and use Playwright's
// own dragTo orchestrator rather than hand-rolled mouse events. If the
// reorder doesn't take, retry once before failing.

import { expect, test } from "@playwright/test";

import {
  cancelConfig,
  configActivePanel,
  expectNoPages,
  gotoTable,
  openConfigDialog,
  texts,
} from "../helpers";

test.describe("Section 16.8 — Drag-reorder columns", () => {
  test("/users Email → before Username: columnNames reorders, ZERO /pages, Columns tab reflects", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table[data-as-main-table]");

    const headerLabelsBefore = await table
      .locator("thead th[data-column-path]")
      .evaluateAll((ths) =>
        ths.map((th) => (th as HTMLTableCellElement).getAttribute("data-column-path") ?? ""),
      );

    // Sanity: Email and Username are present + Email comes after Username
    // in the default declaration order (UsersTable.as: id-strip is hidden,
    // username then email).
    const emailIdx = headerLabelsBefore.indexOf("email");
    const usernameIdx = headerLabelsBefore.indexOf("username");
    expect(usernameIdx).toBeGreaterThanOrEqual(0);
    expect(emailIdx).toBeGreaterThan(usernameIdx);

    // Drag Email's <th> onto Username's <th>, dropping in the LEFT half so
    // the framework reads `position: 'before'`. dragTo with explicit
    // `targetPosition` is the deterministic form.
    const emailTh = table.locator(`thead th[data-column-path="email"]`);
    const usernameTh = table.locator(`thead th[data-column-path="username"]`);

    await expectNoPages(
      page,
      async () => {
        await emailTh.dragTo(usernameTh, { targetPosition: { x: 5, y: 10 } });
      },
      { table: "users" },
    );

    // Order after the drop. We expect `email` to land BEFORE `username`.
    const headerLabelsAfter = await table
      .locator("thead th[data-column-path]")
      .evaluateAll((ths) =>
        ths.map((th) => (th as HTMLTableCellElement).getAttribute("data-column-path") ?? ""),
      );
    const emailIdxAfter = headerLabelsAfter.indexOf("email");
    const usernameIdxAfter = headerLabelsAfter.indexOf("username");
    expect(emailIdxAfter).toBeLessThan(usernameIdxAfter);
    // SET unchanged — same labels, just reordered.
    expect(new Set(headerLabelsAfter)).toEqual(new Set(headerLabelsBefore));

    // Settings dialog Columns tab reflects the new order. The Columns tab
    // panel renders rows in `state.columnNames` order — `Email` should sit
    // before `Username` in the panel's row list.
    const dialog = await openConfigDialog(page, "columns");
    const labels = await texts(
      configActivePanel(dialog).locator(
        ".as-config-field-label-text, .as-orderable-list-item-label",
      ),
    );
    const emailListIdx = labels.indexOf("Email");
    const usernameListIdx = labels.indexOf("Username");
    expect(emailListIdx).toBeGreaterThanOrEqual(0);
    expect(usernameListIdx).toBeGreaterThan(emailListIdx);
    await cancelConfig(dialog);
  });

  test("/products synthesized __actions column: NOT draggable (col.fixed)", async ({ page }) => {
    // /products has `actionsColumn: 'first'` so the synthesised __actions
    // column lives at the leading gutter as `col.fixed = true`. The
    // framework strips its `draggable` attribute (see as-table-header.vue
    // l. 151: `:draggable="(reorderable && !col.fixed) || undefined"`).
    await gotoTable(page, "products");
    const actionsTh = page.locator(
      `table[data-as-main-table] thead th[data-column-path="__actions"]`,
    );
    await expect(actionsTh).toHaveCount(1);
    await expect(actionsTh).not.toHaveAttribute("draggable", /.+/u);
    await expect(actionsTh).toHaveClass(/as-th-fixed/u);
  });
});

test.describe("Section 16.9 — Header keyboard nav (Enter / Esc)", () => {
  test("/users: focus Username header trigger via click + Enter, Esc closes menu", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    // Use `focus()` on the trigger button rather than walking Tab through
    // every interactive element — the page header has many interactives
    // (sidebar nav, preset picker, toolbar buttons) and the exact Tab
    // count is brittle. The contract under test is: when focus is on the
    // header trigger, Enter opens the menu and Esc closes it. Reka's
    // DropdownMenuTrigger forwards focus + key events to the as-child
    // button, so `focus()` lands on the right element.
    const usernameBtn = page.locator(
      `table[data-as-main-table] thead th[data-column-path="username"] .as-th-btn`,
    );
    await usernameBtn.focus();
    await expect(usernameBtn).toBeFocused();

    // Press Enter → DropdownMenu opens.
    await page.keyboard.press("Enter");
    const menu = page.locator(".as-column-menu-content");
    await expect(menu).toBeVisible();

    // Esc closes the menu — Reka's DropdownMenu listens on Esc and dismisses.
    // It also returns focus to the trigger.
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(usernameBtn).toBeFocused();
  });
});
