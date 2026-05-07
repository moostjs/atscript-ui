// Section 16 — Column header menu (sort + filter + clear-filters), batch I.
//
// Read-only batch (no server mutations).
//   - 16.1 Menu items gated by capability + config:
//       - /users Username (sortable + filterable + write-perm) → Sort + Filter
//         + Hide visible. ResetWidth NOT visible until column is resized.
//       - /customers Address (`@db.json`, scenario 3.2 forces both flags off)
//         → Sort + Filter sections absent; Hide column item still present
//         (per Scenario 7.2's positive assertion). The "no menu trigger at
//         all" sub-case requires both sortable=false AND filterable=false
//         AND consumer config disabling Hide+ResetWidth — no demo route
//         exposes that combo. DEFERRED.
//       - The "configure column-menu={ sort:false, filters:false, hide:true }"
//         sub-case requires a custom demo consumer route — none exists.
//         DEFERRED.
//   - 16.2 Sort items + hotkeys (a, d):
//       - On /orders Total: hotkey `a` → asc, `d` → desc, `d` again → cleared.
//       - Mouse click Asc behaves identically to hotkey.
//       - Modifier-prefixed (`Cmd+a`) does not toggle the sort. The handler
//         in `as-column-menu.vue` returns early on `metaKey || ctrlKey ||
//         altKey`, so the browser's default behaviour passes through.
//   - 16.3 Filter items + hotkeys (f, c):
//       - On /users Username: `f` opens the per-column filter dialog.
//       - After applying a filter, re-opening the menu shows `Clear filters`.
//       - `c` clears all conditions on the column → single /pages dropping
//         that filter; menu closes.
//
// Selectors verified (`as-column-menu.vue`, `as-table-header-cell.vue`):
//   - menu trigger: `<button class="as-th-btn">` (clickColumnHeader helper)
//   - portalled menu: `.as-column-menu-content` (DropdownMenuContent)
//   - sort items: `.as-column-menu-item` w/ text "Ascending" / "Descending"
//   - filter item: text "Filter..."
//   - clear filters item: text "Clear filters"
//   - hide column item: text "Hide column"
//   - reset width item: text "Reset width"
//   - per-column filter dialog content root: `.as-filter-dialog-content`

import { expect, test } from "../fixtures";

import {
  clickColumnHeader,
  expectNoPages,
  expectSinglePages,
  gotoTable,
  pickSort,
  sortIndicator,
} from "../helpers";

test.describe("Section 16.1 — Menu items gated by capability + config", () => {
  test("/users Username column-menu: Sort + Filter + Hide visible (no Reset width pre-resize)", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    await clickColumnHeader(page, "username");
    const menu = page.locator(".as-column-menu-content");
    await expect(menu).toBeVisible();

    // Sort section + items.
    await expect(menu.locator(".as-column-menu-label", { hasText: "Sort" })).toHaveCount(1);
    await expect(menu.locator(".as-column-menu-item", { hasText: "Ascending" })).toHaveCount(1);
    await expect(menu.locator(".as-column-menu-item", { hasText: "Descending" })).toHaveCount(1);

    // Filter item.
    await expect(menu.locator(".as-column-menu-item", { hasText: "Filter..." })).toHaveCount(1);

    // Hide column item.
    await expect(menu.locator(".as-column-menu-item", { hasText: "Hide column" })).toHaveCount(1);

    // Reset width is gated on `widthEntry.w !== widthEntry.d` — pre-resize
    // they're equal so the item is suppressed.
    await expect(menu.locator(".as-column-menu-item", { hasText: "Reset width" })).toHaveCount(0);

    // Clear filters NOT visible (no filter applied yet).
    await expect(menu.locator(".as-column-menu-item", { hasText: "Clear filters" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("/customers Address (@db.json): Sort + Filter sections absent, Hide present", async ({
    page,
  }) => {
    await gotoTable(page, "customers");

    await clickColumnHeader(page, "address");
    const menu = page.locator(".as-column-menu-content");
    await expect(menu).toBeVisible();

    // Sort section absent (sortable=false forced via @db.json).
    await expect(menu.locator(".as-column-menu-label", { hasText: "Sort" })).toHaveCount(0);
    await expect(menu.locator(".as-column-menu-item", { hasText: "Ascending" })).toHaveCount(0);
    await expect(menu.locator(".as-column-menu-item", { hasText: "Descending" })).toHaveCount(0);

    // Filter item absent (filterable=false forced via @db.json).
    await expect(menu.locator(".as-column-menu-item", { hasText: "Filter..." })).toHaveCount(0);

    // Hide column kept the menu mountable — `hasAnyItem` stays true.
    await expect(menu.locator(".as-column-menu-item", { hasText: "Hide column" })).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  test("/orders-no-menu Lines (@db.json + hide:false + resetWidth:false): no menu mounts on click", async ({
    page,
  }) => {
    // `lines` is @db.json (sortable=false + filterable=false) and the route
    // disables hide + resetWidth, so all four gates collapse to
    // `hasAnyItem === false` and `as-column-menu.vue` renders the slot
    // without DropdownMenuRoot — clicking the header doesn't portal a menu.
    await gotoTable(page, "orders-no-menu", { apiPath: "orders" });

    await clickColumnHeader(page, "lines");
    await page.waitForTimeout(150);
    await expect(page.locator(".as-column-menu-content")).toHaveCount(0);

    // Sibling sortable column on the same route still gets a menu — proves
    // the no-menu fallback is column-scoped, not route-wide.
    await clickColumnHeader(page, "total");
    await expect(page.locator(".as-column-menu-content")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".as-column-menu-content")).toHaveCount(0);
  });
});

test.describe("Section 16.2 — Sort items + hotkeys (a, d)", () => {
  test("/orders Total: hotkey `a` → asc, `d` → desc, `d` again → cleared", async ({ page }) => {
    await gotoTable(page, "orders");
    const totalAsc = sortIndicator(page, "total", "asc");
    const totalDesc = sortIndicator(page, "total", "desc");

    // Step 1 — open menu, press `a` → asc.
    const ascCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "total");
        await expect(page.locator(".as-column-menu-content")).toBeVisible();
        await page.keyboard.press("a");
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(ascCaptured.url)).toMatch(/\$sort=\+?total\b/u);
    await expect(totalAsc).toHaveCount(1);
    await expect(totalDesc).toHaveCount(0);
    // Menu closed on hotkey.
    await expect(page.locator(".as-column-menu-content")).toHaveCount(0);

    // Step 2 — re-open, press `d` → desc.
    const descCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "total");
        await expect(page.locator(".as-column-menu-content")).toBeVisible();
        await page.keyboard.press("d");
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(descCaptured.url)).toMatch(/\$sort=-total\b/u);
    await expect(totalDesc).toHaveCount(1);
    await expect(totalAsc).toHaveCount(0);

    // Step 3 — re-open, press `d` again → cleared (same direction toggles
    // off, same contract as 7.1 Click 3).
    const clearedCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "total");
        await expect(page.locator(".as-column-menu-content")).toBeVisible();
        await page.keyboard.press("d");
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(clearedCaptured.url)).not.toContain("$sort=");
    await expect(totalAsc).toHaveCount(0);
    await expect(totalDesc).toHaveCount(0);
  });

  test("/orders Total: mouse click Asc parity with hotkey + modifier-prefixed key passthrough", async ({
    page,
  }) => {
    await gotoTable(page, "orders");

    // Mouse click parity — `pickSort` from the barrel.
    const ascCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "total");
        await pickSort(page, "asc");
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(ascCaptured.url)).toMatch(/\$sort=\+?total\b/u);
    await expect(sortIndicator(page, "total", "asc")).toHaveCount(1);

    // Now exercise the modifier-key passthrough: open the menu, press
    // Cmd/Meta+a — handler returns early, NO sort change. Cmd+A is OS-
    // intercepted on macOS for select-all but does not change sort state
    // either way; we just assert the indicator stays asc.
    await expectNoPages(
      page,
      async () => {
        await clickColumnHeader(page, "total");
        await expect(page.locator(".as-column-menu-content")).toBeVisible();
        // Use both Meta and Control to cover macOS + Linux/Windows.
        await page.keyboard.press("Meta+a");
        await page.keyboard.press("Control+a");
        await page.keyboard.press("Alt+a");
        // Menu may or may not close on Cmd+A (browser default focus
        // movement); explicitly close it to leave the page clean.
        await page.keyboard.press("Escape");
      },
      { table: "orders" },
    );

    // Sort indicator unchanged.
    await expect(sortIndicator(page, "total", "asc")).toHaveCount(1);
    await expect(sortIndicator(page, "total", "desc")).toHaveCount(0);
  });
});

test.describe("Section 16.3 — Filter items + hotkeys (f, c)", () => {
  test("/users Username: `f` opens dialog → apply → Clear filters appears → `c` drops filter", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    // Step 1 — open column menu on Username, press `f`. The per-column
    // filter dialog is `.as-filter-dialog-content` (NOT .as-config-dialog-
    // content; that's the toolbar's three-tab settings dialog).
    await clickColumnHeader(page, "username");
    await expect(page.locator(".as-column-menu-content")).toBeVisible();
    await expectNoPages(
      page,
      async () => {
        await page.keyboard.press("f");
      },
      { table: "users" },
    );
    const filterDialog = page.locator(".as-filter-dialog-content");
    await expect(filterDialog).toBeVisible();
    // Column menu closes when the dialog opens (the menu's outside-click
    // handler fires on the dialog overlay).
    await expect(page.locator(".as-column-menu-content")).toHaveCount(0);

    // Step 2 — apply a filter via the Conditions tab. Pick the
    // `Conditions` tab (default may be `Values` for indexed text columns).
    // Type a value into the first condition input + apply.
    const conditionsTab = filterDialog.getByRole("tab", { name: /Conditions/u });
    if ((await conditionsTab.count()) > 0) {
      await conditionsTab.click();
    }
    // The conditions tab renders a `.as-filter-condition-row` per condition;
    // we type the contains-pattern into the first input.
    const conditionInput = filterDialog.locator(".as-filter-input").first();
    await expect(conditionInput).toBeVisible();
    await conditionInput.fill("admin");

    // Apply via Apply button — fires single /pages.
    await expectSinglePages(
      page,
      async () => {
        await filterDialog.locator(".as-filter-btn-apply").click();
      },
      { table: "users" },
    );
    await expect(filterDialog).toHaveCount(0);

    // Step 3 — re-open the column menu; Clear filters now visible.
    await clickColumnHeader(page, "username");
    const menu = page.locator(".as-column-menu-content");
    await expect(menu).toBeVisible();
    const clearFiltersItem = menu.locator(".as-column-menu-item", { hasText: "Clear filters" });
    await expect(clearFiltersItem).toHaveCount(1);

    // Step 4 — press `c` → clear all column filters → single /pages drops
    // the predicate. Header filter badge clears too.
    const clearedCaptured = await expectSinglePages(
      page,
      async () => {
        await page.keyboard.press("c");
      },
      { table: "users" },
    );
    // Wire URL no longer carries `username~='admin'` or any `username` clause.
    expect(decodeURIComponent(clearedCaptured.url)).not.toMatch(/username[=~]/u);
    await expect(menu).toHaveCount(0);

    // Step 5 — re-open menu; Clear filters gone (filledCount=0).
    await clickColumnHeader(page, "username");
    await expect(
      page.locator(".as-column-menu-content .as-column-menu-item", { hasText: "Clear filters" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
});
