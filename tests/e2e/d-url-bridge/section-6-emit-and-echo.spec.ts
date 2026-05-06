// Section 6 — URL bridge: outbound emit + echo guard + operator change.
//
// Covers:
//   - 6.2 Outbound URL emit on filter change — every applied filter writes
//     the URL via `router.replace` (mode default), so `history.length` stays
//     stable across the mutation.
//   - 6.4 URL bridge echo — the encoded round-trip (`URLSearchParams` re-
//     encodes operator chars that `buildUrl` emits raw) does NOT spoof the
//     echo guard; each filter touch fires EXACTLY one /pages, no immediate
//     pre-debounce request from `applyUrlQuery`'s `nextTick` scheduleQuery.
//   - 6.6 Filter operator change updates URL — switching operator on an
//     existing pill via the per-column dialog re-emits the URL with the new
//     wire shape and fires a single /pages.

import { type Locator, type Page, expect, test } from "@playwright/test";

import { addFilterPill, expectSinglePages, expectUrlQuery, gotoTable } from "../helpers";

/** Open the per-column filter dialog by pressing F4 on the focused pill input. */
async function openPillDialog(page: Page, pill: Locator): Promise<Locator> {
  await pill.locator(".as-filter-field-search").focus();
  await pill.locator(".as-filter-field-f4").click();
  const dialog = page.locator(".as-filter-dialog-content");
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Section 6.2 — Outbound URL emit on filter change", () => {
  test("Adding Status=shipped on /orders writes URL via replace; history.length stable", async ({
    page,
  }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Status");

    const before = await page.evaluate(() => history.length);

    await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await dropdown
          .locator("tbody tr td", { hasText: /^shipped$/ })
          .first()
          .click();
      },
      { table: "orders" },
    );

    // URL gained the predicate.
    expectUrlQuery(page, ["status=shipped"]);

    // Default `mode: "replace"` → no new history entry.
    const after = await page.evaluate(() => history.length);
    expect(after).toBe(before);
  });
});

test.describe("Section 6.4 — URL bridge echo — no spurious refetch", () => {
  // The regression: `URLSearchParams` re-encodes operator chars (`~`, `'`,
  // `/`) that `buildUrl` emits raw. The echo guard's `urlsEquivalent`
  // compares on decoded form so a state-change → URL-write → URL-read does
  // not double-fire `/pages`. Each step here must produce EXACTLY one
  // /pages — observed via the `quietWindowMs` 700 ms window past the LAST
  // request. A leading + trailing fire both get counted.

  test("First Name `contains bob` on /users — single /pages, no echo fire", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "First Name");

    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("*bob*");
        await input.press("Enter");
      },
      { table: "users" },
    );
    expect(decodeURIComponent(captured.url)).toContain("profile.firstName~='/bob/i'");
    // URL bar carries the same predicate (decoded-equivalence — vue-router
    // percent-encodes `~`/`'`/`/` in `location.href`).
    expectUrlQuery(page, ["profile.firstName~='/bob/i'"]);
  });

  test("Email `contains @demo.test` on /users — escaped regex round-trips, single /pages", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Email");

    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("*@demo.test*");
        await input.press("Enter");
      },
      { table: "users" },
    );
    // Wire predicate: `email~='/@demo\\.test/i'` — uniqu 0.1.6 escapes `\` as
    // `\\` inside the quoted string. `decodeURIComponent` doesn't touch
    // backslashes; the decoded URL carries the literal two-backslash form.
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("email~=");
    expect(decoded).toContain("email~='/@demo\\\\.test/i'");
    // Browser URL also reflects it (bridge echo did not double-fire).
    expectUrlQuery(page, ["email~="]);
  });
});

test.describe("Section 6.6 — Filter operator change updates URL", () => {
  test("Status `=shipped` → `!=shipped` → back, each step single /pages", async ({ page }) => {
    await gotoTable(page, "orders");

    // Step 1 — apply Status=shipped via inline pill dropdown.
    const pill = await addFilterPill(page, "Status");
    await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await dropdown
          .locator("tbody tr td", { hasText: /^shipped$/ })
          .first()
          .click();
      },
      { table: "orders" },
    );
    expectUrlQuery(page, ["status=shipped"]);

    // Step 2 — open dialog, drop the value-help chip, switch to Conditions
    // tab, set operator `ne` + value `shipped`, Apply.
    {
      const dialog = await openPillDialog(page, pill);
      // Drop the existing valueHelpConditions chip via the dialog's chip
      // strip (only one chip — `status=shipped`).
      const chip = dialog.locator(".as-filter-dialog-chip").first();
      await expect(chip).toBeVisible();
      await chip.locator(".as-filter-dialog-chip-remove").click();
      await expect(dialog.locator(".as-filter-dialog-chip")).toHaveCount(0);

      // Switch to Conditions tab.
      await dialog.locator(".as-config-tab-trigger:has-text('Conditions')").click();

      // The placeholder condition row exists; set type + value.
      await dialog.locator(".as-filter-condition-select").first().selectOption("ne");
      await dialog.locator(".as-filter-input").first().fill("shipped");

      const captured = await expectSinglePages(
        page,
        async () => {
          await dialog.locator(".as-filter-btn-apply").click();
          await expect(dialog).toHaveCount(0);
        },
        { table: "orders" },
      );
      expect(decodeURIComponent(captured.url)).toContain("status!=shipped");
    }
    expectUrlQuery(page, ["status!=shipped"]);
    expectUrlQuery(page, ["status=shipped"], { not: true });

    // Step 3 — back to `=shipped`. Open dialog, drop the conditions row,
    // switch to Values tab, click `shipped`, Apply.
    {
      const dialog = await openPillDialog(page, pill);
      // Drop the free-condition chip (`status != shipped`).
      const chip = dialog.locator(".as-filter-dialog-chip").first();
      await expect(chip).toBeVisible();
      await chip.locator(".as-filter-dialog-chip-remove").click();
      await expect(dialog.locator(".as-filter-dialog-chip")).toHaveCount(0);

      // Values tab — pick `shipped`.
      await dialog.locator(".as-config-tab-trigger:has-text('Values')").click();
      await dialog
        .locator("table.as-table tbody tr:has(td)", { hasText: /^shipped$/ })
        .first()
        .click();

      const captured = await expectSinglePages(
        page,
        async () => {
          await dialog.locator(".as-filter-btn-apply").click();
          await expect(dialog).toHaveCount(0);
        },
        { table: "orders" },
      );
      const decoded = decodeURIComponent(captured.url);
      expect(decoded).toContain("status=shipped");
      expect(decoded).not.toContain("status!=shipped");
    }
    expectUrlQuery(page, ["status=shipped"]);
    expectUrlQuery(page, ["status!=shipped"], { not: true });
  });
});
