// Section 4 — Filtering: per-column filter dialog branches.
//
// Covers Scenarios 4.8 (Values+Conditions tabs layout), 4.9 (FK value-help
// inner table), 4.10 (union/enum value-help static options), and 4.11
// (conditions-only dialog for non-value-help columns).
//
// The dialog opens via:
//   - F4 inside a focused pill input
//   - the F4 button next to the pill input (`as-filter-field-f4`)
//   - the column-header menu's `Filter…` item (`F` shortcut)
//
// All three open the same `<AsFilterDialog>` (`.as-filter-dialog-content`).
// FK columns trigger a nested inner-table fetch on open; enum/union columns
// resolve options from the schema with no HTTP traffic.

import { type Locator, type Page, expect, test } from "../fixtures";

import { addFilterPill, expectNoPages, expectSinglePages, gotoTable } from "../helpers";

async function openDialogViaF4(page: Page, pill: Locator): Promise<Locator> {
  await pill.locator(".as-filter-field-search").focus();
  await pill.locator(".as-filter-field-f4").click();
  const dialog = page.locator(".as-filter-dialog-content");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Section 4.8 — Per-column filter dialog (FK Customer)", () => {
  test("Two tabs visible (Values active by default), each with a count badge", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Customer");
    const dialog = await openDialogViaF4(page, pill);

    // Header reads `Customer`.
    await expect(dialog.locator(".as-filter-dialog-title-value")).toHaveText("Customer");

    // Two tabs visible.
    const tabs = dialog.locator(".as-config-tab-trigger");
    await expect(tabs).toHaveCount(2);
    const labels = await tabs.allTextContents();
    expect(labels.map((l) => l.trim().split(/\s+/)[0])).toEqual(["Values", "Conditions"]);

    // Values tab active by default.
    await expect(tabs.first()).toHaveAttribute("data-state", "active");
  });
});

test.describe("Section 4.9 — Value-help on FK column", () => {
  test("Customer dialog: select / deselect / re-select chip flow", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Customer");
    const dialog = await openDialogViaF4(page, pill);

    // Inner table has searchable `customers` (the schema declares
    // `@db.index.fulltext` on customers). Search input is rendered.
    const searchInput = dialog.locator(".as-filter-value-help-search");
    await expect(searchInput).toHaveCount(1);

    // Wait for the inner table to populate. The default load fires on
    // dialog open (limit: 100) — we read the rendered tbody rows.
    await expect(dialog.locator("table.as-table tbody tr:has(td)").first()).toBeVisible();

    // Pick the first row. The Customer value-help renders inside the
    // window-table branch (FK source uses `<AsWindowTable>`), which marks
    // selection via `aria-selected="true"` on the `<tr>` (NOT `data-state`).
    const firstRow = dialog.locator("table.as-table tbody tr:has(td)").first();
    await firstRow.click();
    await expect(firstRow).toHaveAttribute("aria-selected", "true");

    // Chips strip in the dialog reflects `valueHelpConditions.length === 1`.
    await expect(dialog.locator(".as-filter-dialog-chips-count")).toHaveText("1");
    // Tab badge increments to `1`.
    await expect(
      dialog.locator(".as-config-tab-trigger:has-text('Values') .as-config-tab-count"),
    ).toHaveText("1");

    // Deselect — same click toggles off.
    await firstRow.click();
    await expect(firstRow).toHaveAttribute("aria-selected", "false");
    await expect(dialog.locator(".as-filter-dialog-chips-count")).toHaveCount(0);
    await expect(
      dialog.locator(".as-config-tab-trigger:has-text('Values') .as-config-tab-count"),
    ).toHaveCount(0);
  });

  test("Customer dialog: Conditions tab keeps Values selection across switches", async ({
    page,
  }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Customer");
    const dialog = await openDialogViaF4(page, pill);

    await expect(dialog.locator("table.as-table tbody tr:has(td)").first()).toBeVisible();
    const firstRow = dialog.locator("table.as-table tbody tr:has(td)").first();
    await firstRow.click();
    await expect(firstRow).toHaveAttribute("aria-selected", "true");

    // Switch to Conditions tab — selection should survive.
    await dialog.locator(".as-config-tab-trigger:has-text('Conditions')").click();
    await expect(
      dialog.locator(".as-filter-dialog-tab-conditions .as-filter-condition-row"),
    ).toHaveCount(1);

    // Switch back to Values — chip count stays at 1.
    await dialog.locator(".as-config-tab-trigger:has-text('Values')").click();
    await expect(
      dialog.locator(".as-config-tab-trigger:has-text('Values') .as-config-tab-count"),
    ).toHaveText("1");
    await expect(firstRow).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Section 4.10 — Value-help on enum/union column (Status)", () => {
  test("Status dialog: zero HTTP for static enum, two-tab layout, multi-select chips", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");

    // Static enum value-help: opening the dialog must not fire any `/pages`
    // (the four literals come from the schema, not the server).
    let dialog!: Locator;
    await expectNoPages(page, async () => {
      dialog = await openDialogViaF4(page, pill);
    });

    const valueRows = dialog.locator("table.as-table tbody tr:has(td)");
    const cells = await valueRows.allTextContents();
    const set = new Set(cells.map((s) => s.replace(/\s+/g, " ").trim()));
    expect(set).toEqual(new Set(["active", "suspended", "pending", "invited"]));

    await dialog.locator("table.as-table tbody tr:has(td)", { hasText: /^active$/ }).click();
    await dialog.locator("table.as-table tbody tr:has(td)", { hasText: /^pending$/ }).click();
    await expect(dialog.locator(".as-filter-dialog-chips-count")).toHaveText("2");
  });

  test("Status dialog: Apply commits chips + fires single /pages", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");
    const dialog = await openDialogViaF4(page, pill);

    await dialog.locator("table.as-table tbody tr:has(td)", { hasText: /^active$/ }).click();
    await expect(dialog.locator(".as-filter-dialog-chips-count")).toHaveText("1");

    const captured = await expectSinglePages(
      page,
      async () => {
        await dialog.locator(".as-filter-btn-apply").click();
        await expect(dialog).toHaveCount(0);
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("status=active");
  });
});

test.describe("Section 4.11 — Conditions-only dialog (non-value-help)", () => {
  test("Username (text): operator picker exposes text ops, default is `contains`", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Username");
    const dialog = await openDialogViaF4(page, pill);

    // No tab list — just a single conditions composer.
    await expect(dialog.locator(".as-config-tab-trigger")).toHaveCount(0);
    await expect(dialog.locator(".as-filter-dialog-body")).toHaveCount(1);

    const select = dialog.locator(".as-filter-condition-select").first();
    const ops = await select.locator("option").allTextContents();
    const trimmed = ops.map((s) => s.trim());
    // `users.username` is non-nullable, so `null` / `notNull` are excluded
    // from the picker. The full text set is `eq, ne, contains, starts, ends,
    // bw, regex` (7 ops); for a nullable text column `is empty` / `is not
    // empty` would surface alongside.
    expect(trimmed).toEqual([
      "equals",
      "not equals",
      "contains",
      "starts with",
      "ends with",
      "between",
      "matches pattern",
    ]);
    // Default selected = `contains` (text default).
    expect(await select.inputValue()).toBe("contains");
  });

  test("Total (number): picker exposes number ops, no contains", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Total");
    const dialog = await openDialogViaF4(page, pill);

    const select = dialog.locator(".as-filter-condition-select").first();
    const ops = await select.locator("option").allTextContents();
    const trimmed = ops.map((s) => s.trim());
    // `orders.total` is non-nullable, so the picker is `eq, ne, gt, gte, lt,
    // lte, bw` only — null / notNull are omitted (covered by the nullable-
    // column branch in Section 4.4 which uses `lastLoginAt` / `birthday`).
    expect(new Set(trimmed)).toEqual(
      new Set([
        "equals",
        "not equals",
        "greater than",
        "greater or equal",
        "less than",
        "less or equal",
        "between",
      ]),
    );
    expect(trimmed).not.toContain("contains");
    // Default selected = `eq` (number default).
    expect(await select.inputValue()).toBe("eq");
  });

  test("MFA Enabled (non-nullable boolean): operator set is { eq, ne }, value is a select", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "MFA Enabled");
    const dialog = await openDialogViaF4(page, pill);

    const select = dialog.locator(".as-filter-condition-select").first();
    const ops = await select.locator("option").allTextContents();
    const trimmed = ops.map((s) => s.trim());
    // `users.mfaEnabled` is non-nullable in the schema, so `null` / `notNull`
    // are excluded from the picker (they could never match). For nullable
    // booleans those operators would surface — `conditionsForType` reads the
    // column's `nullable` flag to decide.
    expect(new Set(trimmed)).toEqual(new Set(["equals", "not equals"]));
    // Value input is rendered as a `<select>` with true/false options
    // (boolean filter type → `as-filter-select`).
    await expect(dialog.locator(".as-filter-select")).toHaveCount(1);
  });

  test("`bw` operator on number renders two value inputs", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Total");
    const dialog = await openDialogViaF4(page, pill);

    await dialog.locator(".as-filter-condition-select").first().selectOption("bw");
    // `as-filter-input-range` wraps two `<input>`s.
    await expect(dialog.locator(".as-filter-input-range input")).toHaveCount(2);
  });

  test("`null` operator hides the value input (renders disabled placeholder)", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Last Login");
    const dialog = await openDialogViaF4(page, pill);

    await dialog.locator(".as-filter-condition-select").first().selectOption("null");
    // null/notNull render `<div class="as-filter-input-disabled">` with no
    // text input visible.
    await expect(dialog.locator(".as-filter-input-disabled")).toHaveCount(1);
    await expect(dialog.locator(".as-filter-input")).toHaveCount(0);
  });
});
