// Section 6 — URL bridge: deep-link load + full state recovery via copy-paste.
//
// Covers:
//   - 6.1 Direct deep-link load — single composed `/pages` fetch (URL hydration
//     onto the initial query, NOT separate fetch + overlay refetch).
//   - 6.7 Full state recovery — build state on the linker tab, paste URL into
//     a fresh context, every aspect (filter pills, header sort indicator,
//     selected page) restores in a single composed fetch.
//
// Deviations from the scenario doc (annotated inline):
//   - 6.1 — the bridge emits `customerId=2` (bare-key, default `eq` op) for a
//     deep link of `?customerId=2`, NOT `customer~='2'`. The doc's wire
//     fragment is wrong; we assert against what the bridge actually emits.
//   - 6.7 — /orders has no `@db.index.fulltext` so the toolbar search input
//     does not render — the search aspect of 6.7 is dropped. See
//     PROMPT-batch-d-url-bridge.md "Caveat 2".

import { type BrowserContext, expect, test } from "@playwright/test";

import { authFileFor, expectSinglePages, expectUrlQuery } from "../helpers";

test.describe("Section 6.1 — Direct deep-link load — single fetch", () => {
  test("Navigating to /orders?customerId=2 fires ONE composed /pages with the customer filter", async ({
    page,
  }) => {
    // Pre-arm the observer so the navigation's /pages request is counted.
    // The bridge composes URL hydration onto the initial query — we expect
    // exactly one /pages, not two (initial + overlay).
    const captured = await expectSinglePages(
      page,
      async () => {
        await page.goto("/orders?customerId=2");
        // Wait for the loading overlay to clear so subsequent assertions
        // race-free.
        await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
      },
      { table: "orders" },
    );

    const decoded = decodeURIComponent(captured.url);
    // Wire fragment: bare-key default-op equality. The deep-link `customerId=2`
    // parses to a `customerId == 2` filter — `@uniqu/url`'s `serializeValue` for
    // a numeric value emits the digits raw (no quoting).
    expect(decoded).toMatch(/customerId=2(?:&|$)/u);

    // The Standard preset auto-renders Customer + Status pills on /orders;
    // the deep-link customer value lands as a Customer chip on first paint.
    const customerPill = page
      .locator(".as-filter-field")
      .filter({ has: page.locator(`label.as-filter-field-label:text-is("Customer")`) });
    await expect(customerPill).toHaveCount(1);
    await expect(customerPill.locator(".as-filter-field-chip")).toHaveCount(1);

    // Result rows reflect the filter — every row's `customerId` cell text is
    // the customer's preferred id, but the Customer column renders with the
    // ref-resolved label (customer name). The simpler assertion is that the
    // composed query carries the predicate; row-level FK rendering is batch A.
    const rows = page.locator("table.as-table tbody tr:has(td)");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // Browser URL stayed at the deep-link form (no encode/decode drift).
    expectUrlQuery(page, ["customerId=2"]);
  });
});

test.describe("Section 6.7 — Copy URL + paste in new tab — full state recovery", () => {
  let recipientCtx: BrowserContext | undefined;

  test.afterEach(async () => {
    await recipientCtx?.close();
    recipientCtx = undefined;
  });

  test("Linker /orders state with filters + sort restores byte-exact in fresh context", async ({
    page,
    browser,
  }) => {
    // Build state on the linker tab. /orders auto-renders Status + Customer
    // pills via the Standard preset; we just commit values.
    await page.goto("/orders");
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);

    const statusPill = page
      .locator(".as-filter-field")
      .filter({ has: page.locator(`label.as-filter-field-label:text-is("Status")`) });
    const customerPill = page
      .locator(".as-filter-field")
      .filter({ has: page.locator(`label.as-filter-field-label:text-is("Customer")`) });
    await expect(statusPill).toHaveCount(1);
    await expect(customerPill).toHaveCount(1);

    // Commit Status = shipped via inline value-help dropdown.
    await expectSinglePages(
      page,
      async () => {
        await statusPill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await dropdown
          .locator("tbody tr td", { hasText: /^shipped$/ })
          .first()
          .click();
      },
      { table: "orders" },
    );

    // Commit Customer = 2 via the inline FK value-help dropdown — pick the
    // row whose preferredId / id is `2`. The customers table has
    // `@meta.id` on `id` (numeric PK), so the second row of the seed maps to
    // id=2 by default sort. We pick by exact text match on the customer
    // name's first column (the preferredId column). The deterministic shape
    // is via a known customer email, but the simplest matcher is to pull the
    // second row (skip header) — fragile. Using the seed: customer ids 1..N
    // are sequentially seeded; row 2 in the customers value-help (sorted by
    // id asc by default) is `id=2`.
    await expectSinglePages(
      page,
      async () => {
        await customerPill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        await expect(dropdown.locator("table tbody tr:has(td)").first()).toBeVisible();
        // nth(1) is the second row (id=2 by default ordering on the
        // customers value-help). The dropdown closes on selection.
        await dropdown.locator("table tbody tr:has(td)").nth(1).click();
      },
      { table: "orders" },
    );

    // Apply a desc sort on `Total` (`@db.index.plain 'orders_total_idx'` → sortable).
    const totalHeader = page.locator(`thead th[data-column-path="total"]`).first();
    await expectSinglePages(
      page,
      async () => {
        await totalHeader.locator(".as-th-btn").click();
        await page
          .locator(".as-column-menu-content .as-column-menu-item", { hasText: "Descending" })
          .click();
      },
      { table: "orders" },
    );

    // Header sort indicator visible.
    await expect(totalHeader.locator(".as-th-sort.i-as-arrow-down")).toHaveCount(1);

    // Linker URL now carries the allowlisted aspects: status + customer
    // (filters allowlist), $sort (sorters not gated). No $page/$size
    // (pagination off), no $search (orders is not searchable — input
    // doesn't render).
    expectUrlQuery(page, ["status=shipped", "customerId=2", "$sort=-total"]);
    expectUrlQuery(page, ["$skip", "$limit", "$page", "$size", "$search"], { not: true });

    const linkerUrl = page.url();
    const linkerSearch = new URL(linkerUrl).search;
    expect(linkerSearch.length).toBeGreaterThan(1);

    // --- Fresh context: paste linker URL, single composed /pages restores. ---
    recipientCtx = await browser.newContext({ storageState: authFileFor("admin") });
    const recipient = await recipientCtx.newPage();

    const recipientCaptured = await expectSinglePages(
      recipient,
      async () => {
        await recipient.goto(linkerUrl);
        await expect(recipient.getByText("Loading…", { exact: true })).toHaveCount(0);
      },
      { table: "orders" },
    );
    const decoded = decodeURIComponent(recipientCaptured.url);
    expect(decoded).toMatch(/status=shipped\b/u);
    expect(decoded).toMatch(/customerId=2\b/u);
    expect(decoded).toContain("$sort=-total");

    // Recipient pills reflect the linker state.
    const recipientStatusPill = recipient
      .locator(".as-filter-field")
      .filter({ has: recipient.locator(`label.as-filter-field-label:text-is("Status")`) });
    const recipientCustomerPill = recipient
      .locator(".as-filter-field")
      .filter({ has: recipient.locator(`label.as-filter-field-label:text-is("Customer")`) });
    await expect(recipientStatusPill.locator(".as-filter-field-chip")).toHaveCount(1);
    await expect(recipientStatusPill.locator(".as-filter-field-chip")).toHaveText(/shipped/);
    await expect(recipientCustomerPill.locator(".as-filter-field-chip")).toHaveCount(1);

    // Header sort indicator preserved.
    const recipientTotalHeader = recipient.locator(`thead th[data-column-path="total"]`).first();
    await expect(recipientTotalHeader.locator(".as-th-sort.i-as-arrow-down")).toHaveCount(1);

    // Recipient URL exactly mirrors linker URL — round-trip is byte-exact via
    // vue-router's percent-encoding (operator chars survive encode/decode).
    expect(recipient.url()).toBe(linkerUrl);
  });
});
