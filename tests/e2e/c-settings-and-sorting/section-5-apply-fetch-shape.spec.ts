// Section 5.3 — Apply: only query-affecting changes trigger a /pages refetch.
//
// This is the load-bearing assertion for the Settings dialog. Each row in
// the scenario's matrix gets its own `test()` so a single misclassification
// surfaces with a clean per-row failure rather than a swallowed combined
// assertion.
//
// Matrix (TABLE_SCENARIOS.md, Scenario 5.3):
//
//   1. Reorder columns (same set)               | Columns | NO   ← `sameColumnSet`
//   2. Hide a column (uncheck)                  | Columns | YES  ← `$select` shrinks
//   3. Show a previously hidden column (check)  | Columns | YES  ← `$select` widens
//   4. Add a filter pill (no value entered yet) | Filters | NO   ← display-only
//   5. (skipped) Remove a filter pill that had a value
//                                                          ← see deviation note
//   6. Reorder filter pills                     | Filters | NO   ← order is display
//   7. Add a sorter                             | Sorters | YES  ← `$sort` gains field
//   8. Remove a sorter                          | Sorters | YES  ← `$sort` shrinks
//   9. Reorder sorters (priority swap)          | Sorters | YES  ← order matters
//
// Plus a sanity-net assertion that the Filters tab's pill-toggle path does
// NOT clear an already-applied predicate (the value lives in `state.filters`,
// the dialog only mutates `state.filterFields` — display vs applied separation
// from CLAUDE.md's "model-driven state" rule).
//
// Deviation: matrix row 5 ("Remove a filter pill that had a value → YES") is
// intentionally skipped. The scenario text already flags the ambiguity — the
// dialog's pill-toggle path does NOT clear values per CLAUDE.md (filterFields
// removal does not mutate `filters`); that's the b-filtering batch's 4.7
// assertion. Re-stating it here as a YES would contradict the rest of the
// suite. Sanity-net test below pins the inverse direction.

import { type Locator, expect, test } from "@playwright/test";

import {
  applyConfig,
  configListRow,
  expectNoPages,
  expectSinglePages,
  gotoTable,
  moveConfigListRowDown,
  openConfigDialog,
  pillByLabel,
  toggleConfigListRow,
} from "../helpers";

async function rowChecked(dialog: Locator, label: string): Promise<boolean> {
  return (await configListRow(dialog, label).getAttribute("data-state")) === "checked";
}

test.describe("Section 5.3 — Apply: only query-affecting changes trigger /pages", () => {
  test("Reorder columns (same set) — NO /pages", async ({ page }) => {
    await gotoTable(page, "users");
    const dialog = await openConfigDialog(page, "columns");

    // Move `Username` down one slot — visible-column set unchanged, just order
    // (covered by the `sameColumnSet` short-circuit in `use-table-state`).
    await moveConfigListRowDown(dialog, "Username");

    await expectNoPages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );

    // Reorder is committed: header order updated.
    const table = page.locator("table.as-table").first();
    const headers = (await table.locator("thead th .as-th-label").allTextContents())
      .map((s) => s.trim())
      .filter(Boolean);
    const usernameIdx = headers.indexOf("Username");
    expect(usernameIdx).toBeGreaterThan(0);
    // Row that was below `Username` is now at the original Username position.
    expect(headers[usernameIdx - 1]).not.toBe("Id");
  });

  test("Hide a column (uncheck) — YES /pages", async ({ page }) => {
    await gotoTable(page, "users");
    const dialog = await openConfigDialog(page, "columns");

    // Uncheck `Email` → `$select` shrinks.
    expect(await rowChecked(dialog, "Email")).toBe(true);
    await toggleConfigListRow(dialog, "Email");
    expect(await rowChecked(dialog, "Email")).toBe(false);

    await expectSinglePages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );

    // Email column removed from the rendered header strip.
    const table = page.locator("table.as-table").first();
    const headers = (await table.locator("thead th .as-th-label").allTextContents())
      .map((s) => s.trim())
      .filter(Boolean);
    expect(headers).not.toContain("Email");
  });

  test("Show a previously hidden column (check) — YES /pages", async ({ page }) => {
    await gotoTable(page, "users");

    // Step 1: hide `Email` so we have something to re-show. Wrap in the
    // observer so the per-test assertion isn't polluted by setup traffic.
    const setup = await openConfigDialog(page, "columns");
    await toggleConfigListRow(setup, "Email");
    await expectSinglePages(
      page,
      async () => {
        await applyConfig(setup);
      },
      { table: "users" },
    );

    // Step 2: re-open and toggle Email back on — `$select` widens, /pages fires.
    const dialog = await openConfigDialog(page, "columns");
    expect(await rowChecked(dialog, "Email")).toBe(false);
    await toggleConfigListRow(dialog, "Email");
    expect(await rowChecked(dialog, "Email")).toBe(true);

    await expectSinglePages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );

    // Email column rendered in the header strip again.
    const table = page.locator("table.as-table").first();
    const headers = (await table.locator("thead th .as-th-label").allTextContents())
      .map((s) => s.trim())
      .filter(Boolean);
    expect(headers).toContain("Email");
  });

  test("Add a filter pill (no value entered yet) — NO /pages", async ({ page }) => {
    await gotoTable(page, "users");
    const dialog = await openConfigDialog(page, "filters");

    // Add `Username` to filterFields. `Status`/`Role` already pinned by the
    // Standard preset, so `Username` is the safest pick (it's not in the
    // baseline set — toggling it adds a NEW pill rather than removing one).
    expect(await rowChecked(dialog, "Username")).toBe(false);
    await toggleConfigListRow(dialog, "Username");

    await expectNoPages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );

    // Pill rendered with no chip — empty-valued, no predicate applied.
    const pill = pillByLabel(page, "Username");
    await expect(pill).toHaveCount(1);
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(0);
  });

  test("Reorder filter pills — NO /pages", async ({ page }) => {
    await gotoTable(page, "users");
    const dialog = await openConfigDialog(page, "filters");

    // Standard preset baseline = ['status', 'roleId']. Move `Status` down so
    // the order becomes ['roleId', 'status']. `filters` map is unaffected
    // (display-only mutation; `filterFields` array order is the only change).
    await moveConfigListRowDown(dialog, "Status");

    await expectNoPages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );

    // Visible pill order swapped: Role now precedes Status in the toolbar.
    const pillLabels = await page
      .locator(".as-filter-field label.as-filter-field-label")
      .allTextContents();
    const trimmed = pillLabels.map((s) => s.trim());
    expect(trimmed).toEqual(["Role", "Status"]);
  });

  test("Add a sorter — YES /pages", async ({ page }) => {
    await gotoTable(page, "users");
    const dialog = await openConfigDialog(page, "sorters");

    await toggleConfigListRow(dialog, "Username");
    expect(await rowChecked(dialog, "Username")).toBe(true);

    const captured = await expectSinglePages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );

    // Wire shape: `buildUrl(query)` emits `$sort=username` (ascending; sign
    // prefix `-` only on desc). Decoded check tolerates the URLSearchParams
    // re-encoding of operator chars (none in this case but the round-trip
    // discipline lives in `expectUrlQuery`).
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("$sort=username");
  });

  test("Remove a sorter — YES /pages", async ({ page }) => {
    await gotoTable(page, "users");

    // Setup: add `Username` asc.
    const setup = await openConfigDialog(page, "sorters");
    await toggleConfigListRow(setup, "Username");
    await expectSinglePages(
      page,
      async () => {
        await applyConfig(setup);
      },
      { table: "users" },
    );

    // Now remove it — toggle off.
    const dialog = await openConfigDialog(page, "sorters");
    expect(await rowChecked(dialog, "Username")).toBe(true);
    await toggleConfigListRow(dialog, "Username");
    expect(await rowChecked(dialog, "Username")).toBe(false);

    const captured = await expectSinglePages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).not.toContain("$sort=");
  });

  test("Reorder sorters (priority swap) — YES /pages", async ({ page }) => {
    await gotoTable(page, "users");

    // Setup: add `Status` asc + `Username` asc (in that order).
    const setup = await openConfigDialog(page, "sorters");
    await toggleConfigListRow(setup, "Status");
    await toggleConfigListRow(setup, "Username");
    await expectSinglePages(
      page,
      async () => {
        await applyConfig(setup);
      },
      { table: "users" },
    );

    // Re-open and swap priority — move Status DOWN so Username becomes #1.
    const dialog = await openConfigDialog(page, "sorters");

    // Sanity: priority badges read 1, 2 in the current order.
    await expect(configListRow(dialog, "Status").locator(".as-sorter-index")).toHaveText("1");
    await expect(configListRow(dialog, "Username").locator(".as-sorter-index")).toHaveText("2");

    await moveConfigListRowDown(dialog, "Status");

    // Priority badges flip — Username is now #1, Status #2.
    await expect(configListRow(dialog, "Username").locator(".as-sorter-index")).toHaveText("1");
    await expect(configListRow(dialog, "Status").locator(".as-sorter-index")).toHaveText("2");

    const captured = await expectSinglePages(
      page,
      async () => {
        await applyConfig(dialog);
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    // Field order in `$sort=...` reflects priority; Username precedes Status.
    const sortIdx = decoded.indexOf("$sort=");
    expect(sortIdx).toBeGreaterThanOrEqual(0);
    const sortFragment = decoded.slice(sortIdx);
    const usernameAt = sortFragment.indexOf("username");
    const statusAt = sortFragment.indexOf("status");
    expect(usernameAt).toBeGreaterThanOrEqual(0);
    expect(statusAt).toBeGreaterThan(usernameAt);
  });

  test("Sanity net: toggling a filter pill in the dialog does NOT clear its applied value", async ({
    page,
  }) => {
    // CLAUDE.md "model-driven state" invariant: `filterFields` (display) and
    // `filters` (applied) are independent. The b-filtering batch's 4.7 spec
    // asserts the same on the chip-remove path; this asserts the dialog-toggle
    // path. Routing both makes regressions unambiguous.
    await gotoTable(page, "orders");

    // Pre-populate Status = shipped via the per-column dialog. We avoid the
    // toolbar Filters dialog here (that mutates `filterFields`, not `filters`).
    const statusPill = pillByLabel(page, "Status");
    await statusPill.locator(".as-filter-field-search").focus();
    await statusPill.locator(".as-filter-field-f4").click();
    const filterDialog = page.locator(".as-filter-dialog-content");
    await expect(filterDialog).toBeVisible();
    await filterDialog.locator("table.as-table tbody tr:has(td)", { hasText: /^shipped$/ }).click();
    await expectSinglePages(
      page,
      async () => {
        await filterDialog.locator(".as-filter-btn-apply").click();
        await expect(filterDialog).toHaveCount(0);
      },
      { table: "orders" },
    );
    await expect(statusPill.locator(".as-filter-field-chip")).toHaveText("shipped");

    // Now toggle Status OFF in the toolbar Filters dialog — pill disappears
    // from the toolbar but the applied predicate (`filters.status`) survives.
    const cfg = await openConfigDialog(page, "filters");
    await toggleConfigListRow(cfg, "Status");
    expect(await rowChecked(cfg, "Status")).toBe(false);

    await expectNoPages(
      page,
      async () => {
        await applyConfig(cfg);
      },
      { table: "orders" },
    );

    // Pill is hidden from the toolbar (display state).
    await expect(pillByLabel(page, "Status")).toHaveCount(0);

    // Re-toggle Status ON — pill reappears with the preserved value chip.
    const cfg2 = await openConfigDialog(page, "filters");
    await toggleConfigListRow(cfg2, "Status");
    expect(await rowChecked(cfg2, "Status")).toBe(true);
    await expectNoPages(
      page,
      async () => {
        await applyConfig(cfg2);
      },
      { table: "orders" },
    );
    await expect(pillByLabel(page, "Status").locator(".as-filter-field-chip")).toHaveText(
      "shipped",
    );
  });
});
