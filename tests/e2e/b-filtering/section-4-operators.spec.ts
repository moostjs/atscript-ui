// Section 4 — Filtering: operator coverage (4.3) + null/notNull (4.4).
//
// Each operator gets its own `test()` block — a per-op failure should
// surface clearly rather than collapse into a single composite check
// (TABLE_SCENARIOS.md is the source of truth for which operator each block
// asserts). Every mutation goes through `expectSinglePages(...)` so the
// "1 query per state mutation" Conventions baseline is asserted at the
// network edge for the same shape that catches the URL-bridge echo bug
// (Scenario 6.4).
//
// Wire-shape note (spec-vs-impl drift): `TABLE_SCENARIOS.md` shows quoted
// string values like `status='active'` in URL fragments, but @uniqu/url's
// `serializeValue` only quotes strings that contain reserved characters or
// look like literals (`null`/`true`/`false`/leading-digit). Plain alphabetic
// values like `active` round-trip unquoted (`status=active`). Likewise
// `null`/`notNull` operators emit `$!exists=field` / `$exists=field`, NOT
// `field='null'` / `field!='null'`. The assertions here track the impl —
// I flag the doc drift in the batch hand-off.

import { type Locator, type Page, expect, test } from "../fixtures";

import { addFilterPill, expectSinglePages, gotoTable } from "../helpers";

/** Open the per-column filter dialog by F4-key on the named pill's input. */
async function openPerColumnDialog(page: Page, pill: Locator): Promise<Locator> {
  await pill.locator(".as-filter-field-search").focus();
  await pill.locator(".as-filter-field-f4").click();
  const dialog = page.locator(".as-filter-dialog-content");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Body data rows of the main table (excludes the virtualizer's trailing spacer `<tr/>`). */
function dataRows(page: Page): Locator {
  return page.locator("table.as-table").first().locator("tbody tr:has(td)");
}

/**
 * Read the username cell text of every visible body row in `table`. Used
 * across Section 4.4 null/notNull tests to identify which seeded users
 * survived the predicate. Inlined per the helper-RFC rule.
 */
async function readUsernames(table: Locator): Promise<Set<string>> {
  const usernameTh = table.locator(`thead th[data-column-path="username"]`);
  const usernameIdx = await usernameTh.evaluate((el) => (el as HTMLTableCellElement).cellIndex);
  const cells = await table
    .locator("tbody tr:has(td)")
    .evaluateAll(
      (trs, idx) =>
        trs.map((tr) => (tr as HTMLTableRowElement).cells[idx]?.textContent?.trim() ?? ""),
      usernameIdx,
    );
  return new Set(cells);
}

test.describe("Section 4.3 — Operator coverage on /users", () => {
  test("eq — Status pill picks `active`", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");

    const captured = await expectSinglePages(
      page,
      async () => {
        await pill.locator(".as-filter-field-search").click();
        const dropdown = page.locator(".as-filter-field-dropdown");
        await expect(dropdown).toBeVisible();
        // Pick the `active` row from the inline value-help dropdown.
        await dropdown
          .locator("tbody tr td", { hasText: /^active$/ })
          .first()
          .click();
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("status=active");
    // Tabular result: `admin`, `manager`, `viewer`, `alice` are seeded
    // `status: active` (4 rows). bob is `pending` so excluded.
    await expect(dataRows(page)).toHaveCount(4);
  });

  test("ne — Status pill, Conditions tab, `is not 'active'`", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Status");
    const dialog = await openPerColumnDialog(page, pill);

    // Switch to Conditions tab (header).
    await dialog.locator(".as-config-tab-trigger:has-text('Conditions')").click();
    await dialog
      .locator(".as-filter-condition-row select.as-filter-condition-select")
      .selectOption("ne");
    await dialog.locator(".as-filter-input").first().fill("active");

    const captured = await expectSinglePages(
      page,
      async () => {
        await dialog.locator(".as-filter-btn-apply").click();
        await expect(dialog).toHaveCount(0);
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("status!=active");
    // `bob` (status: pending) + `eve` (status: invited) survive.
    await expect(dataRows(page)).toHaveCount(2);
  });

  test("contains — First Name `bob` (default operator on text)", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "First Name");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("bob");
        await input.press("Enter");
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("profile.firstName~='/bob/i'");
    await expect(dataRows(page)).toHaveCount(1);
  });

  test("starts — Username `ad*`", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Username");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("ad*");
        await input.press("Enter");
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("username~='/^ad/i'");
    // `admin` matches; alice/manager/viewer/bob/eve don't.
    await expect(dataRows(page)).toHaveCount(1);
  });

  test("ends — Email `*@demo.test`", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Email");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("*@demo.test");
        await input.press("Enter");
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    // `*text` → `ends` operator → regex `/@demo\.test$/i`. uniqu 0.1.6
    // escapes `\` as `\\` inside quoted strings (wire format), so the regex
    // source's single backslash appears as `\\` after percent-decoding.
    // atscript-db 0.1.66's `regexToLike` translates `\.` to a literal `.`
    // via the `ESCAPE '\'` clause, so the LIKE predicate matches.
    expect(decoded).toContain("email~='/@demo\\\\.test$/i'");
    // All 6 seeded users (admin/manager/viewer/alice/bob/eve) have @demo.test emails.
    await expect(dataRows(page)).toHaveCount(6);
  });

  test("regex — Username `/^a/`", async ({ page }) => {
    // Demo's sqlite adapter translates `$regex` to LIKE via `regexToLike`
    // in `@atscript/db-sql-tools` — supports `^`, `$`, `.`, `.*` only (no
    // character classes / alternation). `/^a/` exercises the supported
    // anchor branch; `/^[abm]/` would emit a literal `[abm]%` LIKE pattern
    // and silently match zero rows. Scenario 4.3's `/^[abm]/` example is
    // doc drift versus the demo adapter — flagged in the batch hand-off.
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Username");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("/^a/");
        await input.press("Enter");
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    // Pattern `^a` has no reserved chars but starts with `^` which IS in
    // the special-char set, so serializeValue wraps in single quotes. The
    // raw regex condition stores pattern WITHOUT slashes — different from
    // the contains/starts/ends ops which carry the `/.../i` form.
    expect(decoded).toContain("username~='^a'");
    // admin + alice start with `a`. The LIKE form is case-insensitive only
    // when `flags` includes `i` — raw regex from the input parser produces
    // empty flags, so this is case-sensitive (sqlite `LIKE 'a%'` is also
    // case-insensitive ASCII by default — both seeded usernames match).
    await expect(dataRows(page)).toHaveCount(2);
  });

  test("regex — empty-result branch (`/zzzzz/`) renders empty-state body", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Username");
    await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("/zzzzz/");
        await input.press("Enter");
      },
      { table: "users" },
    );
    // Zero data rows — the table renders without throwing. /users is the
    // virtual-scroll branch, so there's no `as-no-data` element to assert
    // against (window-mode-only).
    await expect(dataRows(page)).toHaveCount(0);
  });
});

test.describe("Section 4.3 — Operator coverage on /orders", () => {
  test("gt — Total `>50` (number filter type)", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Total");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill(">50");
        await input.press("Enter");
      },
      { table: "orders" },
    );
    const decoded = decodeURIComponent(captured.url);
    // Numbers are emitted unquoted by `serializeValue` (number branch).
    expect(decoded).toContain("total>50");
  });

  test("bw — Total between `50...100`", async ({ page }) => {
    await gotoTable(page, "orders");
    const pill = await addFilterPill(page, "Total");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("50...100");
        await input.press("Enter");
      },
      { table: "orders" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("total>=50");
    expect(decoded).toContain("total<=100");
  });
});

test.describe("Section 4.3 — null/notNull on /users", () => {
  test("null — Last Login `<empty>`", async ({ page }) => {
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
    const decoded = decodeURIComponent(captured.url);
    // `null` operator → `$!exists=lastLoginAt` per @uniqu/url's
    // `serializeComparison` — NOT `lastLoginAt='null'` (the scenario doc
    // drift).
    expect(decoded).toContain("$!exists=lastLoginAt");
    // bob and eve both have null lastLoginAt.
    await expect(dataRows(page)).toHaveCount(2);
  });

  test("notNull — Birthday `!<empty>`", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Birthday");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("!<empty>");
        await input.press("Enter");
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("$exists=birthday");
    // admin/manager/alice have birthdays; viewer/bob/eve don't.
    await expect(dataRows(page)).toHaveCount(3);
  });
});

test.describe("Section 4.4 — null/notNull on real nullable columns", () => {
  test("Birthday is null → viewer + bob + eve", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Birthday");
    const captured = await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("<empty>");
        await input.press("Enter");
      },
      { table: "users" },
    );
    const decoded = decodeURIComponent(captured.url);
    expect(decoded).toContain("$!exists=birthday");
    await expect(dataRows(page)).toHaveCount(3);
    expect(await readUsernames(page.locator("table.as-table").first())).toEqual(
      new Set(["viewer", "bob", "eve"]),
    );
  });

  test("Birthday is not null → admin + manager + alice", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Birthday");
    await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("!<empty>");
        await input.press("Enter");
      },
      { table: "users" },
    );
    await expect(dataRows(page)).toHaveCount(3);
    expect(await readUsernames(page.locator("table.as-table").first())).toEqual(
      new Set(["admin", "manager", "alice"]),
    );
  });

  test("Last Login is null → bob + eve", async ({ page }) => {
    await gotoTable(page, "users");
    const pill = await addFilterPill(page, "Last Login");
    await expectSinglePages(
      page,
      async () => {
        const input = pill.locator(".as-filter-field-search");
        await input.fill("<empty>");
        await input.press("Enter");
      },
      { table: "users" },
    );
    await expect(dataRows(page)).toHaveCount(2);
    expect(await readUsernames(page.locator("table.as-table").first())).toEqual(
      new Set(["bob", "eve"]),
    );
  });
});
