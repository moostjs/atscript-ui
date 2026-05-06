// Section 4 — Filtering: pill-input fast paths.
//
// Covers Scenarios 4.12 (pill-input fast path — inline dropdown picks),
// 4.13 (special-prefix / wildcard syntax), 4.14 (filter pill hotkeys —
// F4 / Enter / Escape), 4.15 (pill input dropdown for FK + union — no
// wrapping dialog, static enums fire zero HTTP).

import { type Locator, type Page, expect, test } from "@playwright/test";

import { expectNoPages, expectSinglePages, gotoTable } from "../helpers";

async function addFilterPill(page: Page, label: string): Promise<Locator> {
  await page.getByTitle("Filters", { exact: true }).click();
  const dialog = page.locator(".as-config-dialog-content");
  await expect(dialog).toBeVisible();
  const row = dialog.locator(
    `[role='tabpanel'][data-state='active'] .as-orderable-list-item:has(.as-config-field-label-text:text-is("${label}"))`,
  );
  await row.click();
  await dialog.locator(".as-filter-btn-apply").click();
  await expect(dialog).toHaveCount(0);
  const pill = page
    .locator(".as-filter-field")
    .filter({ has: page.locator(`label.as-filter-field-label:text-is("${label}")`) });
  await expect(pill).toHaveCount(1);
  return pill;
}

test.describe("Section 4.12 — Pill-input fast path (no dialog)", () => {
  test("Status pill: pick `active` from inline dropdown, no dialog opens", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");

    const captured = await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await dropdown
          .locator("tbody tr td", { hasText: /^active$/ })
          .first()
          .click();
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("status=active");
    // Per-column filter dialog (`<AsFilterDialog>`) was NOT opened.
    await expect(page.locator(".as-filter-dialog-content")).toHaveCount(0);
  });

  test("Open filter dialog from pill, dialog Values tab pre-populated with prior selection", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");
    await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await dropdown
          .locator("tbody tr td", { hasText: /^active$/ })
          .first()
          .click();
      },
      { table: "users" },
    );

    // Open the per-column dialog via the F4 button.
    await pill.locator(".as-filter-field-search").focus();
    await pill.locator(".as-filter-field-f4").click();
    const dialog = page.locator(".as-filter-dialog-content");
    await expect(dialog).toBeVisible();
    // Values tab badge shows `1`.
    await expect(
      dialog.locator(".as-config-tab-trigger:has-text('Values') .as-config-tab-count"),
    ).toHaveText("1");
    // The `active` row inside the dialog's inner value-help is checked.
    const checkedRow = dialog.locator("table.as-table tbody tr:has(td)[aria-selected='true']");
    await expect(checkedRow).toHaveCount(1);
  });
});

test.describe("Section 4.13 — Pill-input special prefix / wildcard syntax", () => {
  // Each row exercises one prefix mapping. The wire-shape regex assertions
  // mirror @uniqu/url's serializeValue behaviour — quoted-regex form for
  // `/.../i` patterns, raw for primitives.
  type Row = {
    label: string;
    column: string;
    table: string;
    typed: string;
    fragment: string;
    /** Optional negative fragment (must NOT appear). */
    notFragment?: string;
  };

  const rows: Row[] = [
    {
      label: "*bob*",
      column: "First Name",
      table: "users",
      typed: "*bob*",
      fragment: "profile.firstName~='/bob/i'",
    },
    {
      label: "bob*",
      column: "First Name",
      table: "users",
      typed: "bob*",
      fragment: "profile.firstName~='/^bob/i'",
    },
    // Skipped: same regex-to-LIKE bug as the `ends` test in section-4-operators.
    // `*demo.test` → regex `\demo\.test$` (well, `demo\.test$`) → LIKE `%demo\_test`
    // → 0 rows. See ../atscript-db/REGEX_ISSUE.md.
    {
      label: "=Admin",
      column: "First Name",
      table: "users",
      typed: "=Admin",
      // serializeValue("Admin") doesn't quote (no special chars / leading
      // digit / null/true/false literal).
      fragment: "profile.firstName=Admin",
    },
    {
      label: ">100",
      column: "Total",
      table: "orders",
      typed: ">100",
      fragment: "total>100",
    },
    {
      label: "<=200",
      column: "Total",
      table: "orders",
      typed: "<=200",
      fragment: "total<=200",
    },
    {
      label: "10...50",
      column: "Total",
      table: "orders",
      typed: "10...50",
      fragment: "total>=10",
      notFragment: "total>=200",
    },
  ];

  for (const r of rows) {
    test(`\`${r.label}\` on ${r.column} (${r.table})`, async ({ page }) => {
      await gotoTable(page, r.table);
      const pill = await addFilterPill(page, r.column);
      const captured = await expectSinglePages(
        page,
        async () => {
          const input = pill.locator(".as-filter-field-search");
          await input.fill(r.typed);
          await input.press("Enter");
        },
        { table: r.table },
      );
      const decoded = decodeURIComponent(captured.url);
      expect(decoded).toContain(r.fragment);
      if (r.notFragment) expect(decoded).not.toContain(r.notFragment);
    });
  }

  test("Invalid combo (`>foo` on text) doesn't apply: no chip, no request", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "First Name");
    await expectNoPages(page, async () => {
      const input = pill.locator(".as-filter-field-search");
      await input.fill(">foo");
      await input.press("Enter");
    });
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(0);
  });

  test("`<empty>` on a nullable column commits null operator", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Last Login");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("<empty>");
        await input.press("Enter");
      },
      { table: "users" },
    );
    expect(decodeURIComponent(captured.url)).toContain("$!exists=lastLoginAt");
  });
});

test.describe("Section 4.14 — Filter pill hotkeys", () => {
  test("F4 inside the pill input opens the per-column filter dialog", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Customer");
    await pill.locator(".as-filter-field-search").focus();
    await pill.locator(".as-filter-field-search").press("F4");
    const dialog = page.locator(".as-filter-dialog-content");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".as-filter-dialog-title-value")).toHaveText("Customer");
  });

  test("Escape clears uncommitted typing without firing a request", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "First Name");
    await expectNoPages(page, async () => {
      const input = pill.locator(".as-filter-field-search");
      await input.fill("typo");
      // Reka's Combobox swallows Escape only when its dropdown is open;
      // non-value-help pills use a plain input, so Escape on empty-no-
      // dropdown does nothing on its own — we assert the no-fire path.
      await input.press("Escape");
    });
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(0);
  });

  test("Enter commits the current input and fires a single /pages", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Total");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill(">42");
        await input.press("Enter");
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(captured.url)).toContain("total>42");
  });
});

test.describe("Section 4.15 — Pill-input dropdown (FK + union)", () => {
  test("Customer pill: dropdown opens on focus; static enum: zero HTTP", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Customer");
    const dropdown = page.locator(".as-filter-field-dropdown");

    // First focus → inner customers table mounts and fires exactly one /pages.
    await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-search").click();
        await expect(dropdown).toBeVisible();
        await expect(dropdown.locator("table tbody tr").first()).toBeVisible();
      },
      { table: "customers" },
    );

    await page.keyboard.press("Escape");
    await expect(dropdown).toBeHidden();

    // Re-open: per-pill cache survives close/open, no new customers /pages.
    await expectNoPages(
      page,
      async () => {
        await pill.locator(".as-filter-field-search").click();
        await expect(dropdown).toBeVisible();
      },
      { table: "customers" },
    );

    await page.keyboard.press("Escape");
    await expect(dropdown).toBeHidden();

    // Static enum (Status) dropdown resolves options from the schema —
    // opening it must not fire ANY /pages.
    const statusPill = await addFilterPill(page, "Status");
    await expectNoPages(page, async () => {
      await statusPill.locator(".as-filter-field-search").click();
      await expect(dropdown).toBeVisible();
    });
  });
});
