// Section 5 — Table Settings dialog (Columns / Filters / Sorters tabs).
//
// Read-only batch. Covers the layout / interaction / cancel / live-badge
// scenarios that share the `<AsConfigDialog>` mount but do NOT touch the
// "what triggers a /pages refetch" matrix — that's section-5-apply-fetch-shape.
//
//   - 5.1 Three-tab layout: clicking each toolbar entry button opens the same
//     dialog with the named tab pre-active; tab triggers carry icon + count
//     badges; switching tabs inside the dialog fires NO `/pages` traffic.
//   - 5.2 Each tab has search + reorder + select/unselect: typing into the
//     `.as-orderable-list-search` input filters the list, the inline
//     "Move down" arrow buttons move rows visually, and toggling a
//     `<ListboxItem>` checks/unchecks the row — all without firing HTTP.
//   - 5.4 Cancel discards: reorder + hide one column + add a sorter, then
//     Cancel — table state is untouched and no `/pages` fires.
//   - 5.5 Tab badges update live as the user mutates inside the dialog (the
//     `.as-config-tab-count` is bound to the dialog-local `*Model.length`,
//     not to committed state). On the next open after Cancel they reflect
//     committed state, not the discarded preview.
//
// Reka's `<TabsTrigger value="...">` does NOT render `value` as an HTML
// attribute — only `data-state`, `aria-controls`, and a synthesised `id`. We
// locate triggers by their declared positional order (`columns/filters/sorters`).

import { type Locator, expect, test } from "../fixtures";

import {
  type ConfigTab,
  cancelConfig,
  configActivePanel,
  configListRow,
  configTabTrigger,
  expectNoPages,
  gotoTable,
  moveConfigListRowDown,
  openConfigDialog,
  toggleConfigListRow,
} from "../helpers";

async function expectActiveTab(dialog: Locator, tab: ConfigTab): Promise<void> {
  await expect(configTabTrigger(dialog, tab)).toHaveAttribute("data-state", "active");
}

async function countBadge(dialog: Locator, tab: ConfigTab): Promise<number> {
  const text = await configTabTrigger(dialog, tab).locator(".as-config-tab-count").textContent();
  return Number((text ?? "0").trim());
}

async function rowChecked(dialog: Locator, label: string): Promise<boolean> {
  return (await configListRow(dialog, label).getAttribute("data-state")) === "checked";
}

async function listOrder(dialog: Locator): Promise<string[]> {
  const labels = await configActivePanel(dialog)
    .locator(".as-orderable-list-item .as-orderable-list-item-label")
    .allTextContents();
  return labels.map((s) => s.trim()).filter(Boolean);
}

test.describe("Section 5 — Settings dialog (layout, interactions, cancel, live badges)", () => {
  test("5.1: Three-tab layout — toolbar entry buttons + in-dialog tab switching", async ({
    page,
  }) => {
    await gotoTable(page, "users");

    // Open via the toolbar Columns button — Columns tab pre-active.
    let dialog = await openConfigDialog(page, "columns");
    await expect(dialog.locator(".as-config-dialog-title")).toHaveText("Table Settings");

    // Three tab triggers in declared order, each with an icon + count badge.
    const triggers = dialog.locator(".as-config-tab-trigger");
    await expect(triggers).toHaveCount(3);
    await expect(dialog.locator(".as-config-tab-trigger .as-config-tab-icon")).toHaveCount(3);
    await expect(dialog.locator(".as-config-tab-trigger .as-config-tab-count")).toHaveCount(3);

    // Verify the trigger ordering matches `columns/filters/sorters` by reading
    // the visible body text on each (icon span has no text; the count badge
    // contributes a digit but the leading text is the tab name).
    const triggerLabels = await triggers.evaluateAll((els) =>
      els.map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()),
    );
    expect(triggerLabels[0]).toMatch(/^Columns\b/);
    expect(triggerLabels[1]).toMatch(/^Filters\b/);
    expect(triggerLabels[2]).toMatch(/^Sorters\b/);

    // Initial badge shape on /users: Columns=N>0, Filters=2 (Standard preset
    // pins Status + Role), Sorters=0.
    expect(await countBadge(dialog, "columns")).toBeGreaterThan(0);
    expect(await countBadge(dialog, "filters")).toBe(2);
    expect(await countBadge(dialog, "sorters")).toBe(0);

    // The dialog's `<DialogOverlay>` is modal — toolbar entry buttons are
    // unreachable while it's open. Real users close the existing dialog before
    // re-opening with a different tab pre-active. Verify both re-open paths
    // (Filters toolbar → Filters tab; Sorters toolbar → Sorters tab) plus the
    // in-dialog tab switching as a single network-silent flow.
    await cancelConfig(dialog);
    dialog = await openConfigDialog(page, "filters");
    await expectActiveTab(dialog, "filters");
    await cancelConfig(dialog);

    dialog = await openConfigDialog(page, "sorters");
    await expectActiveTab(dialog, "sorters");

    // Switch tabs by clicking the in-dialog tab triggers — network-silent.
    await expectNoPages(page, async () => {
      await configTabTrigger(dialog, "columns").click();
      await expectActiveTab(dialog, "columns");
      await configTabTrigger(dialog, "filters").click();
      await expectActiveTab(dialog, "filters");
      await configTabTrigger(dialog, "sorters").click();
      await expectActiveTab(dialog, "sorters");
    });

    await cancelConfig(dialog);
  });

  test("5.2: Each tab has search + reorder + select/unselect (no HTTP)", async ({ page }) => {
    await gotoTable(page, "users");

    const dialog = await openConfigDialog(page, "columns");

    await expectNoPages(page, async () => {
      // Search — substring filter applied to visible rows. `Email` matches a
      // single column; assert the row appears and an unrelated header
      // (`Status`) is filtered out.
      const search = configActivePanel(dialog).locator(".as-orderable-list-search");
      await search.fill("email");
      await expect(
        configActivePanel(dialog).locator(".as-orderable-list-item:has-text('Email')"),
      ).toHaveCount(1);
      await expect(
        configActivePanel(dialog).locator(".as-orderable-list-item:has-text('Status')"),
      ).toHaveCount(0);
      await search.fill("");

      // Reorder via the inline `Move down` arrow (avoids HTML5 drag flakiness;
      // the orderable list also exposes those buttons in its action toolbar).
      // Capture the row that was previously below `Username` so we can prove
      // they swapped.
      const orderBefore = await listOrder(dialog);
      const usernameIdx = orderBefore.indexOf("Username");
      expect(usernameIdx).toBeGreaterThanOrEqual(0);
      const wasBelow = orderBefore[usernameIdx + 1];
      expect(wasBelow).toBeTruthy();
      await moveConfigListRowDown(dialog, "Username");
      const orderAfter = await listOrder(dialog);
      expect(orderAfter[usernameIdx]).toBe(wasBelow);
      expect(orderAfter[usernameIdx + 1]).toBe("Username");

      // Toggle a row — uncheck `Username`. Reka's `<ListboxItem>` flips its
      // `data-state` between `checked` and `unchecked`; that's the visible
      // marker (the `.as-orderable-list-check-icon` is shown via
      // `<ListboxItemIndicator>` only when checked).
      expect(await rowChecked(dialog, "Username")).toBe(true);
      await toggleConfigListRow(dialog, "Username");
      expect(await rowChecked(dialog, "Username")).toBe(false);
      await toggleConfigListRow(dialog, "Username");
      expect(await rowChecked(dialog, "Username")).toBe(true);
    });

    // Switch to Filters tab — same primitives. Search must filter the
    // (smaller) filterable subset and unrelated rows must NOT match.
    await configTabTrigger(dialog, "filters").click();
    await expectActiveTab(dialog, "filters");

    await expectNoPages(page, async () => {
      const search = configActivePanel(dialog).locator(".as-orderable-list-search");
      await search.fill("status");
      await expect(
        configActivePanel(dialog).locator(".as-orderable-list-item:has-text('Status')"),
      ).toHaveCount(1);
      await expect(
        configActivePanel(dialog).locator(".as-orderable-list-item:has-text('Username')"),
      ).toHaveCount(0);
      await search.fill("");

      // Standard preset pins Status + Role, so they're checked on first paint.
      expect(await rowChecked(dialog, "Status")).toBe(true);
      expect(await rowChecked(dialog, "Role")).toBe(true);
      // Toggle a previously-unchecked row — `Username`.
      expect(await rowChecked(dialog, "Username")).toBe(false);
      await toggleConfigListRow(dialog, "Username");
      expect(await rowChecked(dialog, "Username")).toBe(true);
      await toggleConfigListRow(dialog, "Username");
      expect(await rowChecked(dialog, "Username")).toBe(false);
    });

    // Switch to Sorters tab — same primitives, model is empty by default.
    await configTabTrigger(dialog, "sorters").click();
    await expectActiveTab(dialog, "sorters");

    await expectNoPages(page, async () => {
      const search = configActivePanel(dialog).locator(".as-orderable-list-search");
      await search.fill("username");
      await expect(
        configActivePanel(dialog).locator(".as-orderable-list-item:has-text('Username')"),
      ).toHaveCount(1);
      await search.fill("");

      // Toggle Username on, asc by default — `as-sorter-segment` only renders
      // for selected rows.
      await toggleConfigListRow(dialog, "Username");
      const usernameRow = configListRow(dialog, "Username");
      await expect(usernameRow.locator(".as-sorter-segment")).toHaveCount(1);
      // Toggle off again — segment hides.
      await toggleConfigListRow(dialog, "Username");
      await expect(usernameRow.locator(".as-sorter-segment")).toHaveCount(0);
    });

    await cancelConfig(dialog);
  });

  test("5.4: Cancel discards pending changes — no /pages, no committed state", async ({ page }) => {
    await gotoTable(page, "users");

    // Capture committed state via the rendered DOM (cheap proxy that survives
    // dialog teardown): header order, visible-column set, sort indicator.
    const table = page.locator("table.as-table").first();
    const headerLabels = async () =>
      (await table.locator("thead th .as-th-label").allTextContents())
        .map((s) => s.trim())
        .filter(Boolean);

    const beforeHeaders = await headerLabels();
    expect(beforeHeaders).toContain("Username");
    expect(beforeHeaders).toContain("Email");
    await expect(table.locator("thead th .as-th-sort")).toHaveCount(0);

    const dialog = await openConfigDialog(page, "columns");

    // Pending changes that affect each tab.
    await expectNoPages(page, async () => {
      // 1. Reorder Username → moves down one slot.
      await moveConfigListRowDown(dialog, "Username");
      // 2. Hide a column (uncheck Email).
      expect(await rowChecked(dialog, "Email")).toBe(true);
      await toggleConfigListRow(dialog, "Email");
      expect(await rowChecked(dialog, "Email")).toBe(false);

      // 3. Switch to Sorters tab and add `Username` asc.
      await configTabTrigger(dialog, "sorters").click();
      await toggleConfigListRow(dialog, "Username");
      expect(await rowChecked(dialog, "Username")).toBe(true);

      // Cancel — no /pages should fire.
      await cancelConfig(dialog);
    });

    // Committed state untouched.
    const afterHeaders = await headerLabels();
    expect(afterHeaders).toEqual(beforeHeaders);
    await expect(table.locator("thead th .as-th-sort")).toHaveCount(0);
  });

  test("5.5: Tab badges update live as the user mutates inside the dialog", async ({ page }) => {
    await gotoTable(page, "users");

    let dialog = await openConfigDialog(page, "filters");

    // Standard preset baseline: filterFields = ['status', 'roleId'], so the
    // Filters badge reads `2` on first open. Sorters reads `0`.
    expect(await countBadge(dialog, "filters")).toBe(2);
    expect(await countBadge(dialog, "sorters")).toBe(0);

    await expectNoPages(page, async () => {
      // Toggle `Username` ON → 3.
      await toggleConfigListRow(dialog, "Username");
      expect(await countBadge(dialog, "filters")).toBe(3);
      // Toggle `Status` OFF → 2.
      await toggleConfigListRow(dialog, "Status");
      expect(await countBadge(dialog, "filters")).toBe(2);
      // Toggle `Username` OFF → 1.
      await toggleConfigListRow(dialog, "Username");
      expect(await countBadge(dialog, "filters")).toBe(1);

      // Sorters tab — add one, count goes to 1.
      await configTabTrigger(dialog, "sorters").click();
      await toggleConfigListRow(dialog, "Username");
      expect(await countBadge(dialog, "sorters")).toBe(1);

      await cancelConfig(dialog);
    });

    // Re-open: badges reflect committed state, not the discarded preview.
    dialog = await openConfigDialog(page, "filters");
    expect(await countBadge(dialog, "filters")).toBe(2);
    expect(await countBadge(dialog, "sorters")).toBe(0);
    await cancelConfig(dialog);
  });
});
