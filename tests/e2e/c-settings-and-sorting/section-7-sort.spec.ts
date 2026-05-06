// Section 7 — Sorting.
//
// Read-only batch:
//   - 7.1 Single-column sort cycle on /orders Total: asc → desc → cleared,
//     each step its own `expectSinglePages` so a failure on click 2 doesn't
//     mask click 1's success.
//   - 7.2 `sortable=false` column (Address on /customers, `@db.json`):
//     clicking the header opens the column menu (Hide column is always
//     present, so `hasAnyItem` stays true), but the Sort section is absent
//     — the assertion is shaped as a NEGATIVE: no `/pages` fires AND
//     `.as-column-menu-label:text-is("Sort")` is absent inside the open menu.
//   - 7.3 Multi-sort via Sorters dialog on /users: Status desc + Username
//     asc → single `/pages` with `$sort=-status,username`. Result-row
//     ordering check is property-based — status non-increasing across rows,
//     username strictly increasing within each status group — to avoid a
//     hard-coded seed assumption.
//
// Note on URL bar: /users declares `urlQuerySync: { sorters: false }` so
// the browser URL bar does NOT contain `$sort=`. We capture the wire URL
// via `expectSinglePages` and assert on the `/pages?` query string instead
// of `location.href`. URL-bridge round-trip assertions are batch D's scope.

import { type Locator, type Page, expect, test } from "@playwright/test";

import { expectNoPages, expectSinglePages, gotoTable } from "../helpers";

type ConfigTab = "columns" | "filters" | "sorters";

const TAB_ORDER: ConfigTab[] = ["columns", "filters", "sorters"];
const TAB_TITLES: Record<ConfigTab, string> = {
  columns: "Columns",
  filters: "Filters",
  sorters: "Sorters",
};

function dialogLocator(page: Page): Locator {
  return page.locator(".as-config-dialog-content");
}

function tabTrigger(dialog: Locator, tab: ConfigTab): Locator {
  return dialog.locator(".as-config-tab-trigger").nth(TAB_ORDER.indexOf(tab));
}

async function openConfigDialog(page: Page, tab: ConfigTab): Promise<Locator> {
  await page.getByTitle(TAB_TITLES[tab], { exact: true }).click();
  const dialog = dialogLocator(page);
  await expect(dialog).toBeVisible();
  await expect(tabTrigger(dialog, tab)).toHaveAttribute("data-state", "active");
  return dialog;
}

async function applyConfig(dialog: Locator): Promise<void> {
  await dialog.locator(".as-filter-btn-apply").click();
  await expect(dialog).toHaveCount(0);
}

function activePanel(dialog: Locator): Locator {
  return dialog.locator("[role='tabpanel'][data-state='active']");
}

function listRow(dialog: Locator, label: string): Locator {
  return activePanel(dialog).locator(
    `.as-orderable-list-item:has(.as-orderable-list-item-label:text-is("${label}")),` +
      `.as-orderable-list-item:has(.as-config-field-label-text:text-is("${label}"))`,
  );
}

async function toggleListRow(dialog: Locator, label: string): Promise<void> {
  await listRow(dialog, label).click();
}

async function clickColumnHeader(page: Page, columnPath: string): Promise<void> {
  const table = page.locator("table.as-table").first();
  // The actual click target is the inner `<button class="as-th-btn">`. Reka's
  // `DropdownMenuTrigger as-child` slot binds the open handler onto that
  // button (the `<th>` itself is the drag-reorder target).
  await table.locator(`thead th[data-column-path="${columnPath}"] .as-th-btn`).click();
}

async function pickSort(page: Page, direction: "asc" | "desc"): Promise<void> {
  const label = direction === "asc" ? "Ascending" : "Descending";
  // Reka portals dropdown menus to `<body>`, so the menu is reached through
  // `page.locator(...)` rather than relative to the table.
  await page
    .locator(".as-column-menu-content .as-column-menu-item", {
      hasText: label,
    })
    .click();
}

test.describe("Section 7.1 — Single-column sort cycle", () => {
  // Deviation from the scenario text: the scenario specifies clicking the
  // `Total` column on `/orders`, but the demo's `orders.total` schema field
  // declares `@db.column.measure` which marks it un-indexed and therefore
  // un-sortable on the wire (`column.sortable === false` → the Sort section
  // is hidden in `<AsColumnMenu>`, see Scenario 7.2). We retarget the cycle
  // to `Username` on `/users` — a plain string column with `@db.index.unique`
  // — keeping the cycle behaviour assertion intact (asc → desc → cleared).
  // /users declares `urlQuerySync: { sorters: false }` so the URL bar bridge
  // omits `$sort=`; we still capture the wire URL via `expectSinglePages` and
  // assert against that, not `location.href`.
  test("Username header on /users: asc → desc → cleared, single /pages each step", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const usernameHeader = table.locator(`thead th[data-column-path="username"]`);

    // Click 1 — pick Ascending.
    const ascCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "username");
        await pickSort(page, "asc");
      },
      { table: "users" },
    );
    expect(decodeURIComponent(ascCaptured.url)).toMatch(/\$sort=\+?username\b/u);
    // Header indicator: `as-th-sort` glyph + class encoding direction.
    await expect(usernameHeader.locator(".as-th-sort.i-as-arrow-up")).toHaveCount(1);
    await expect(usernameHeader.locator(".as-th-sort.i-as-arrow-down")).toHaveCount(0);

    // Click 2 — pick Descending. `emitSort('desc')` differs from current
    // `props.order === 'asc'`, so it emits `'desc'`.
    const descCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "username");
        await pickSort(page, "desc");
      },
      { table: "users" },
    );
    expect(decodeURIComponent(descCaptured.url)).toMatch(/\$sort=-username\b/u);
    await expect(usernameHeader.locator(".as-th-sort.i-as-arrow-down")).toHaveCount(1);
    await expect(usernameHeader.locator(".as-th-sort.i-as-arrow-up")).toHaveCount(0);

    // Click 3 — pick Descending AGAIN. `emitSort('desc')` matches current
    // `props.order === 'desc'` → emits `null` → sorter cleared.
    const clearedCaptured = await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "username");
        await pickSort(page, "desc");
      },
      { table: "users" },
    );
    expect(decodeURIComponent(clearedCaptured.url)).not.toContain("$sort=");
    await expect(usernameHeader.locator(".as-th-sort")).toHaveCount(0);
  });
});

test.describe("Section 7.2 — Sortable=false columns can't be sorted", () => {
  test("Customers Address (@db.json): column menu opens but Sort section is absent, no /pages", async ({
    page,
  }) => {
    await gotoTable(page, "customers");
    const table = page.locator("table.as-table").first();
    const addressHeader = table.locator(`thead th[data-column-path="address"]`);
    await expect(addressHeader).toHaveCount(1);

    // Clicking the header opens the menu (Hide column keeps `hasAnyItem`
    // true). NO `/pages` fires since neither sort nor any other observed
    // mutation happens.
    await expectNoPages(
      page,
      async () => {
        await clickColumnHeader(page, "address");
        // Menu rendered (portalled to body).
        const menu = page.locator(".as-column-menu-content");
        await expect(menu).toBeVisible();

        // Sort section absent — both the section header and the menu items.
        await expect(menu.locator(".as-column-menu-label", { hasText: "Sort" })).toHaveCount(0);
        await expect(menu.locator(".as-column-menu-item", { hasText: "Ascending" })).toHaveCount(0);
        await expect(menu.locator(".as-column-menu-item", { hasText: "Descending" })).toHaveCount(
          0,
        );

        // Filter items also absent (`@db.json` forces filterable=false too).
        await expect(menu.locator(".as-column-menu-item", { hasText: "Filter" })).toHaveCount(0);

        // Hide column IS present — that's what keeps the menu mountable.
        await expect(menu.locator(".as-column-menu-item", { hasText: "Hide column" })).toHaveCount(
          1,
        );

        // Dismiss menu without picking anything.
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
      },
      { table: "customers" },
    );

    // Header has no sort indicator after the menu interaction.
    await expect(addressHeader.locator(".as-th-sort")).toHaveCount(0);
  });
});

test.describe("Section 7.3 — Multi-sort via Sorters dialog", () => {
  test("Status desc + Username asc on /users — single /pages, correctly grouped", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    const dialog = await openConfigDialog(page, "sorters");

    // Add Status, then Username — selection order = priority order.
    await toggleListRow(dialog, "Status");
    await listRow(dialog, "Status").getByTitle("Descending", { exact: true }).click();
    await toggleListRow(dialog, "Username");
    // `Username` defaults to `asc`, no explicit click needed; assert it.
    await expect(
      listRow(dialog, "Username").locator(".as-sorter-segment-btn", { hasText: "Asc" }).first(),
    ).toHaveClass(/as-sorter-segment-btn-active/);
    await expect(
      listRow(dialog, "Status").locator(".as-sorter-segment-btn", { hasText: "Desc" }).first(),
    ).toHaveClass(/as-sorter-segment-btn-active/);

    const captured = await expectSinglePages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );

    // Wire shape: `$sort` field order reflects priority. `buildUrl(query)`
    // emits `$sort=-status,username` (desc prefix `-`, asc bare). We assert
    // both fields are present and ordered, tolerant of the exact sign-form
    // encoding around `username` (could be `+username` or `username`).
    const decoded = decodeURIComponent(captured.url);
    const sortIdx = decoded.indexOf("$sort=");
    expect(sortIdx).toBeGreaterThanOrEqual(0);
    const sortFragment = decoded.slice(sortIdx);
    const statusAt = sortFragment.search(/-status\b/u);
    const usernameAt = sortFragment.search(/[+,]username\b|=username\b/u);
    expect(statusAt).toBeGreaterThanOrEqual(0);
    expect(usernameAt).toBeGreaterThan(statusAt);

    // Result rows grouped by status (desc) with username asc inside each group.
    const table = page.locator("table.as-table").first();
    const usernameTh = table.locator(`thead th[data-column-path="username"]`);
    const statusTh = table.locator(`thead th[data-column-path="status"]`);
    const usernameIdx = await usernameTh.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
    const statusIdx = await statusTh.evaluate((el) => (el as HTMLTableCellElement).cellIndex);

    const rows = table.locator("tbody tr:has(td)");
    expect(await rows.count()).toBeGreaterThan(1);

    // Single IPC round-trip across all rows; per-row .nth().textContent() is N×2 IPCs.
    const seq = await rows.evaluateAll(
      (trs, [si, ui]) =>
        trs.map((tr) => {
          const cells = (tr as HTMLTableRowElement).cells;
          return {
            status: (cells[si]?.textContent ?? "").trim(),
            username: (cells[ui]?.textContent ?? "").trim(),
          };
        }),
      [statusIdx, usernameIdx],
    );

    // Status non-increasing across the full sequence (desc lexicographic).
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i].status <= seq[i - 1].status).toBe(true);
    }
    // Username strictly increasing within each consecutive same-status block.
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].status === seq[i - 1].status) {
        expect(seq[i].username > seq[i - 1].username).toBe(true);
      }
    }
  });
});
