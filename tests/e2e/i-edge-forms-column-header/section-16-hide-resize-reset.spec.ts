// Section 16 — Hide column + Resize + Reset width + Auto-fit (batch I).
//
// Read-only batch (model-side mutations on `columnNames` / `columnWidths`,
// but no server roundtrip for hide/resize/reorder beyond the `/pages` re-
// query that hide triggers via `$select` change — Scenario 5.3).
//
//   - 16.4 Hide hotkey (`h`): /users Username column → press `h` → column
//     hides, single /pages with new $select. Settings dialog Columns tab
//     shows the column unchecked. Restore via toolbar Settings.
//   - 16.5 Reset width hotkey (`w`): pre-resize a column manually first
//     (sub-test "16.6 path"), open menu, assert Reset width visible, press
//     `w` → width snaps to default; menu closes. Re-open → item gone.
//   - 16.6 Resize via drag: hover right edge of `<th>` → cursor col-resize.
//     `mouse.down()` / `move()` / `up()` over `.as-th-resize-handle` →
//     column widens; ZERO /pages during drag.
//   - 16.7 Auto-fit on dblclick of resize handle: dblclick on the handle
//     fires `onResizeHandleDoubleClick` → measureNaturalColumnWidth →
//     width snaps to fit content; Reset width becomes available.
//
// Selectors verified (`as-table-header.vue`):
//   - resize handle: `.as-th-resize-handle` (NOT `.as-th-resize` — that's
//     a `as-th-` class collision used elsewhere)
//   - resize handle is `<div draggable="false">` inside the `<th>`,
//     positioned at the right edge with `cursor: col-resize` style.
//   - drag uses pointer events (`pointerdown` / `pointermove` / `pointerup`).
//
// Pointer drag mechanics — `useColumnHeaderDragResize` listens on the
// handle's own pointer events. We compute the handle's center via
// `boundingBox()` and dispatch `mouse.move + down + move + up`, all over
// the same screen coords because the handler reads `event.clientX`
// directly. Playwright's `mouse.down()` fires both `pointerdown` and
// `mousedown` so the framework's `@pointerdown` handler fires correctly.

import { expect, test } from "../fixtures";

import {
  applyConfig,
  clickColumnHeader,
  configListRow,
  expectNoPages,
  expectSinglePages,
  gotoTable,
  openConfigDialog,
  toggleConfigListRow,
} from "../helpers";

async function thWidth(page: import("@playwright/test").Page, columnPath: string): Promise<number> {
  return page
    .locator(`table[data-as-main-table] thead th[data-column-path="${columnPath}"]`)
    .evaluate((el) => Math.round((el as HTMLElement).getBoundingClientRect().width));
}

/**
 * Drag the resize handle of `columnPath` by `dx` pixels horizontally. Uses
 * pointer events because the framework wires `@pointerdown` /
 * `@pointermove` / `@pointerup` on the handle directly. Multiple `move`
 * calls during the drag mimic real cursor motion so the framework's RAF
 * batch flushes a final pixel value.
 */
async function dragResize(
  page: import("@playwright/test").Page,
  columnPath: string,
  dx: number,
): Promise<void> {
  const handle = page.locator(
    `table[data-as-main-table] thead th[data-column-path="${columnPath}"] .as-th-resize-handle`,
  );
  await expect(handle).toHaveCount(1);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`No bounding box for ${columnPath} resize handle`);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Multi-step move so RAF coalescing produces frames during drag.
  for (let step = 1; step <= 4; step++) {
    await page.mouse.move(startX + (dx * step) / 4, startY, { steps: 4 });
  }
  await page.mouse.up();
}

test.describe("Section 16.4 — Hide hotkey (`h`)", () => {
  test("/users press `h` on Username header → column hides + single /pages with new $select", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table[data-as-main-table]");
    const usernameTh = table.locator(`thead th[data-column-path="username"]`);
    await expect(usernameTh).toHaveCount(1);

    // Open menu, press `h`. Hide drops the column from `state.columnNames`,
    // which triggers the root watcher's re-query because the visible-column
    // SET changed (Scenario 5.3).
    const captured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "username");
        await expect(page.locator(".as-column-menu-content")).toBeVisible();
        await page.keyboard.press("h");
      },
      { table: "users" },
    );

    // Wire shape: $select carries the remaining columns, no `username`.
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).not.toMatch(/\$select=[^&]*\busername\b/u);

    // Column gone from header.
    await expect(usernameTh).toHaveCount(0);

    // Settings dialog → Columns tab shows Username unchecked.
    const dialog = await openConfigDialog(page, "columns");
    const usernameRow = configListRow(dialog, "Username");
    await expect(usernameRow).toHaveCount(1);
    // The unchecked state is reflected via the absence of `data-state="checked"`
    // (or the checkbox `aria-checked="false"`) — concretely, the row's
    // `.as-orderable-list-item-checkbox` shouldn't carry the checked tick.
    await expect(usernameRow.locator(".as-table-checkbox-checked")).toHaveCount(0);

    // Restore via the dialog so subsequent tests in the file start clean.
    await expectSinglePages(
      page,
      async () => {
        await toggleConfigListRow(dialog, "Username");
        await applyConfig(dialog);
      },
      { table: "users" },
    );
    await expect(usernameTh).toHaveCount(1);
  });
});

test.describe("Section 16.6 — Resize via drag", () => {
  test("/users Email: drag handle 80px right → widens; ZERO /pages during drag", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    const before = await thWidth(page, "email");

    // Drag fires NO /pages — width is display-only.
    await expectNoPages(
      page,
      async () => {
        await dragResize(page, "email", 80);
      },
      { table: "users" },
    );

    const after = await thWidth(page, "email");
    // Width grew by ~80px (allow ±8 for layout reflow / sub-pixel rounding).
    expect(after - before).toBeGreaterThan(60);
    expect(after - before).toBeLessThan(100);

    // Reset width is now available (column menu).
    await clickColumnHeader(page, "email");
    await expect(
      page.locator(".as-column-menu-content .as-column-menu-item", { hasText: "Reset width" }),
    ).toHaveCount(1);
    await page.keyboard.press("Escape");
  });
});

test.describe("Section 16.5 — Reset width hotkey (`w`)", () => {
  test("/users Email: pre-resize → menu shows Reset width → press `w` → width snaps back", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    const original = await thWidth(page, "email");

    await dragResize(page, "email", 100);
    const wide = await thWidth(page, "email");
    expect(wide - original).toBeGreaterThan(60);

    // Open column menu, press `w`. Reset width fires
    // `state.resetColumnWidth(path)` which sets `widthEntry.w = widthEntry.d`.
    // No /pages — width is display-only (NOT in the $select / $sort / $filter
    // wire shape). Use `expectNoPages` to confirm.
    await clickColumnHeader(page, "email");
    await expect(page.locator(".as-column-menu-content")).toBeVisible();
    await expectNoPages(
      page,
      async () => {
        await page.keyboard.press("w");
      },
      { table: "users" },
    );
    await expect(page.locator(".as-column-menu-content")).toHaveCount(0);

    const restored = await thWidth(page, "email");
    expect(Math.abs(restored - original)).toBeLessThan(8);

    // Re-open menu — Reset width gone.
    await clickColumnHeader(page, "email");
    await expect(
      page.locator(".as-column-menu-content .as-column-menu-item", { hasText: "Reset width" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
});

test.describe("Section 16.7 — Auto-fit on resize-handle dblclick", () => {
  // The auto-fit path invokes `measureNaturalColumnWidth` which temporarily
  // toggles `table-layout: auto` + `width: max-content`. In a real-browser
  // Playwright run this returns a measured pixel value > 0; in
  // happy-dom/jsdom it would fall back to scrollWidth (covered by the unit
  // test in `as-table-base-resize.spec.ts`). We assert the column width
  // CHANGED + that Reset width becomes available.
  test("/users Email: dblclick handle → column auto-fits + Reset width appears", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    const original = await thWidth(page, "email");

    const handle = page.locator(
      `table[data-as-main-table] thead th[data-column-path="email"] .as-th-resize-handle`,
    );
    await expect(handle).toHaveCount(1);

    // Auto-fit fires NO /pages.
    await expectNoPages(
      page,
      async () => {
        await handle.dblclick();
      },
      { table: "users" },
    );

    const auto = await thWidth(page, "email");
    // Width CHANGED — the email column has long values (e.g. `viewer@demo.test`)
    // and the natural fit is non-zero. Don't pin the absolute value; just
    // assert non-equality at a comfortable threshold.
    expect(Math.abs(auto - original)).toBeGreaterThan(4);

    // Reset width visible.
    await clickColumnHeader(page, "email");
    await expect(
      page.locator(".as-column-menu-content .as-column-menu-item", { hasText: "Reset width" }),
    ).toHaveCount(1);
    await page.keyboard.press("Escape");
  });
});
