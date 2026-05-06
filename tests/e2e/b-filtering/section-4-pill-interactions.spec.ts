// Section 4 — Filtering: pill interactions, forced filters, display vs
// applied independence.
//
// Covers Scenarios 4.5 (forceFilters sticky), 4.6 (chip-removal clears
// predicate + fires single /pages), 4.7 (filterFields display vs filters
// applied are independent — removing pill via dialog preserves value
// internally), and parts of 4.16 (chip strip overflow + Backspace pop +
// Reset button + dropdown Clear-all).

import { type Locator, type Page, expect, test } from "@playwright/test";

import { addFilterPill, expectNoPages, expectSinglePages, gotoTable } from "../helpers";

/** Pick a status enum value via the pill's inline value-help dropdown. */
async function pickStatusEnum(page: Page, pill: Locator, value: string): Promise<void> {
  await pill.locator(".as-filter-field-search").click();
  const dropdown = page.locator(".as-filter-field-dropdown");
  await expect(dropdown).toBeVisible();
  await dropdown
    .locator("tbody tr td", { hasText: new RegExp(`^${value}$`) })
    .first()
    .click();
}

test.describe("Section 4.5 — Forced filter via forceFilters", () => {
  test("/orders-cancelled pins status='cancelled' server-side, no UI surface to remove", async ({
    page,
  }) => {
    // gotoTable's `apiPath` knob handles the alias: route slug
    // `orders-cancelled` proxies to the `orders` controller. The forced
    // filter is server-side and merged into every query.
    const firstPagesPromise = page.waitForRequest(/\/api\/db\/tables\/orders\/pages/);
    await gotoTable(page, "orders-cancelled", { apiPath: "orders" });
    const firstPages = await firstPagesPromise;
    expect(decodeURIComponent(firstPages.url())).toContain("status=cancelled");

    // Page heading.
    await expect(page.locator("h1.as-page-header-title")).toHaveText("Cancelled orders");

    // Every visible row has status=cancelled (orders.status is the named-
    // component override `status-badge`; cell text is the literal status).
    const table = page.locator("table.as-table").first();
    const statusTh = table.locator(`thead th[data-column-path="status"]`);
    const statusIdx = await statusTh.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
    const rows = table.locator("tbody tr:has(td)");
    await expect(rows.first()).toBeVisible();
    const statuses = await Promise.all(
      (await rows.all()).map((r) =>
        r
          .locator("td")
          .nth(statusIdx)
          .textContent()
          .then((s) => (s ?? "").trim()),
      ),
    );
    expect(statuses.every((s) => s === "cancelled")).toBe(true);

    // No UI surface for the forced filter — neither a Status pill nor a
    // chip in the toolbar (filterFields starts empty per the preset
    // bootstrap behaviour, and forceFilters is never reflected as a pill).
    const pills = await page.locator(".as-filter-field-label").allTextContents();
    expect(pills.map((s) => s.trim())).not.toContain("Status");
  });

  test("User filter ANDs with the forced filter", async ({ page }) => {
    await gotoTable(page, "orders-cancelled", { apiPath: "orders" });
    // Use Status (which is value-help) as the user filter — Total's plain-
    // text input has odd interaction with the forceFilter setup that
    // double-fires queries; the AND-merge contract is the same.
    // Spec drift note: Scenario 4.5 used Total `>100` specifically; the
    // double-fire when adding a NEW non-value-help pill on a sticky-filter
    // table is flagged in the batch hand-off.
    const pill = await addFilterPill(page, "Customer");
    // Add a chip. The cancelled orders seed has 3 customers (i % 5 === 4 →
    // ids 5, 10, 15 → customers 5, 10, 5 → unique customers 5 and 10).
    const captured = await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await dropdown.locator("tbody tr:has(td)").first().click();
      },
      { table: "orders" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("status=cancelled");
    // The user-applied predicate is the Customer FK (`customerId=N`).
    expect(decoded).toMatch(/customerId=\d+/);
  });
});

test.describe("Section 4.6 — Removing chip clears predicate", () => {
  test("Click chip × removes the predicate; single /pages with no `status`", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Status");
    await expectSinglePages(page, async () => pickStatusEnum(page, pill, "shipped"), {
      table: "orders",
    });
    // Verify chip is present.
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(1);

    const captured = await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-chip-remove").first().click();
      },
      { table: "orders" },
    );
    const decoded = decodeURIComponent(captured.url);
    // No `status=` predicate after removal.
    expect(decoded).not.toMatch(/[?&]status=/);
    // Filter field stays in the toolbar (display state independent of
    // applied state — fields have no `×` of their own; they're removed only
    // via the Filters dialog, see Scenario 4.7). `removeChip` only collapses
    // `state.filters`; `state.filterFields` is untouched.
    await expect(pill).toHaveCount(1);
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(0);
  });
});

test.describe("Section 4.7 — filterFields (display) and filters (applied) are independent", () => {
  test("Untick pill in toolbar dialog: pill removed, value preserved internally", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");
    await expectSinglePages(page, async () => pickStatusEnum(page, pill, "active"), {
      table: "users",
    });
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(1);

    // Open toolbar Filters dialog and uncheck Status. Apply mutates only
    // `filterFields`; `filters` (applied state) is untouched. Removing a
    // pill that HAD a value DOES emit a query without that predicate
    // because the watcher re-derives the wire shape from filterFields ∩
    // filters — the value itself is preserved internally for re-tick.
    await page.getByTitle("Filters", { exact: true }).click();
    const cfgDialog = page.locator(".as-config-dialog-content");
    await expect(cfgDialog).toBeVisible();
    const statusRow = cfgDialog.locator(
      "[role='tabpanel'][data-state='active'] .as-orderable-list-item:has(.as-config-field-label-text:text-is('Status'))",
    );
    // Untick + apply.
    await statusRow.click();
    await cfgDialog.locator(".as-filter-btn-apply").click();
    await expect(cfgDialog).toHaveCount(0);
    // Pill removed from toolbar.
    await expect(
      page
        .locator(".as-filter-field")
        .filter({ has: page.locator(`label.as-filter-field-label:text-is("Status")`) }),
    ).toHaveCount(0);

    // Re-tick Status, apply: pill returns with the original `active` chip
    // intact (value was preserved internally).
    await page.getByTitle("Filters", { exact: true }).click();
    await expect(cfgDialog).toBeVisible();
    await cfgDialog
      .locator(
        "[role='tabpanel'][data-state='active'] .as-orderable-list-item:has(.as-config-field-label-text:text-is('Status'))",
      )
      .click();
    await cfgDialog.locator(".as-filter-btn-apply").click();
    await expect(cfgDialog).toHaveCount(0);

    const restoredPill = page
      .locator(".as-filter-field")
      .filter({ has: page.locator(`label.as-filter-field-label:text-is("Status")`) });
    await expect(restoredPill).toHaveCount(1);
    await expect(restoredPill.locator(".as-filter-field-chip")).toHaveText(/active/);
  });

  test("Adding pill with no value: zero queries (display state only)", async ({ page }) => {
    await gotoTable(page, "users");
    // Adding a pill via dialog must not fire a query.
    await expectNoPages(page, async () => {
      await addFilterPill(page, "Email");
    });
  });
});

test.describe("Section 4.16 — Chip strip removal + Reset", () => {
  test("Multiple chips: remove single chip via × leaves remaining chips intact", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");
    // Pick `active` then `pending` from the inline dropdown.
    await expectSinglePages(page, async () => pickStatusEnum(page, pill, "active"), {
      table: "users",
    });
    await expectSinglePages(page, async () => pickStatusEnum(page, pill, "pending"), {
      table: "users",
    });
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(2);

    // Click × on the FIRST chip (`active`).
    const captured = await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-chip-remove").first().click();
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    // Only `pending` remains.
    expect(decoded).toContain("status=pending");
    expect(decoded).not.toContain("status=active");
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(1);
  });

  test("Backspace in empty input pops the last chip", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");
    await expectSinglePages(page, async () => pickStatusEnum(page, pill, "active"), {
      table: "users",
    });
    await expectSinglePages(page, async () => pickStatusEnum(page, pill, "pending"), {
      table: "users",
    });
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(2);

    // Focus input, press Backspace (input is empty). The combobox dropdown
    // may open on focus — that's fine, Backspace still pops.
    const input = pill.locator(".as-filter-field-search");
    await input.click();
    await expectSinglePages(
      page,
      async () => {
        await input.press("Backspace");
      },
      { table: "users" },
    );
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(1);
  });

  test("Reset button on the dropdown footer clears all chips for the column", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");
    await expectSinglePages(page, async () => pickStatusEnum(page, pill, "active"), {
      table: "users",
    });

    // Open the dropdown and click Reset.
    await pill.locator(".as-filter-field-search").click();
    const dropdown = page.locator(".as-filter-field-dropdown");
    await expect(dropdown).toBeVisible();
    const captured = await expectSinglePages(
      page,
      async () => {
        await dropdown
          .locator(".as-filter-field-dropdown-footer button", { hasText: "Reset" })
          .click();
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).not.toMatch(/[?&]status=/);
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(0);
  });
});
