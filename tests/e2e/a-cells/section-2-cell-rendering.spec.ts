// Section 2 — Cell rendering by type.
//
// Read-only batch. No seed mutations, no `resetSeed()`. Each test navigates
// to a demo table via `gotoTable(...)` and asserts on rendered cell content.
//
// Strategy notes:
//   - Cells have NO `data-cell-path` attribute today, so we resolve a column's
//     visible position via the matching `<th data-column-path="...">.cellIndex`
//     and index into `<td>` siblings on the row. The leading select column
//     only exists in `select="multi"` mode (default is `none`); none of these
//     tests flip the renderer, so cell index = column index.
//   - Row identity is asserted by reading the Username/Currency/etc. cell
//     text rather than chasing the synthesised `id="tbl-N-row-K"`.
//   - Reka portals to `body`, so popover content is `page.locator(...)`-able
//     directly without nesting under the trigger.
//   - The natural latency interceptor is OFF (DEMO_NO_LATENCY=1) — none of
//     these specs depend on a visible loading state. Per-route delays are not
//     used here.

import { type Locator, type Page, expect, test } from "../fixtures";

import { columnCellIndex, expectSinglePages, gotoTable, rowByCellText } from "../helpers";

async function cellTextByPath(
  _page: Page,
  table: Locator,
  rowLocator: Locator,
  columnPath: string,
): Promise<string> {
  const idx = await columnCellIndex(table, columnPath);
  return ((await rowLocator.locator("td").nth(idx).textContent()) ?? "").trim();
}

async function cellLocatorByPath(
  table: Locator,
  rowLocator: Locator,
  columnPath: string,
): Promise<Locator> {
  const idx = await columnCellIndex(table, columnPath);
  return rowLocator.locator("td").nth(idx);
}

test.describe("Section 2 — Cell rendering by type", () => {
  test("2.1: Users table — every cell type renders correctly", async ({ page }) => {
    await gotoTable(page, "users");

    const table = page.locator("table.as-table").first();

    // Header order — declared columns from the schema, with `Profile` parent
    // suppressed (its leaves `First Name` / `Last Name` surface instead).
    const expectedHeaders = [
      "Id",
      "Username",
      "Email",
      "Role",
      "Status",
      "MFA Enabled",
      "First Name",
      "Last Name",
      "Last Login",
      "Birthday",
      "Password",
      "Salt",
      "Created",
    ];
    const headerLabels = await table.locator("thead th .as-th-label").allTextContents();
    // `__actions` is a fixed pseudo-column with empty label — strip empties.
    const dataHeaders = headerLabels.map((l) => l.trim()).filter(Boolean);
    expect(dataHeaders).toEqual(expectedHeaders);
    expect(dataHeaders).not.toContain("Profile");

    const usernameIdx = await columnCellIndex(table, "username");
    const adminRow = rowByCellText(table, usernameIdx, "admin").first();
    await expect(adminRow).toHaveCount(1);

    // Id cell — numeric, right-aligned via `as-cell-decimal` shortcut. We
    // assert the diagnostic class (decimal formatting opt-in) plus a numeric
    // text body — this is a behavioural marker for the AsCellNumber path.
    const idCell = await cellLocatorByPath(table, adminRow, "id");
    await expect(idCell).toHaveClass(/as-cell-decimal/);
    expect((await idCell.textContent())?.trim() ?? "").toMatch(/^\d+$/);

    // Status — custom `@ui.table.type 'status'` renderer (AsCellStatusBadge).
    // Exposes a span.as-status-badge with a scope-* class that maps to the
    // semantic state. `active` → `scope-good` per the demo's component.
    const statusCell = await cellLocatorByPath(table, adminRow, "status");
    const statusBadge = statusCell.locator(".as-status-badge");
    await expect(statusBadge).toHaveText("active");
    await expect(statusBadge).toHaveClass(/scope-good/);

    // MFA — boolean glyph; admin seeded `mfaEnabled: false`.
    const mfaCell = await cellLocatorByPath(table, adminRow, "mfaEnabled");
    expect(await mfaCell.textContent()).toContain("✗");

    // First Name / Last Name — separate text cells, NOT a JSON popup. The
    // absence of `.as-cell-json-trigger` is the load-bearing assertion.
    const firstNameCell = await cellLocatorByPath(table, adminRow, "profile.firstName");
    expect((await firstNameCell.textContent())?.trim()).toBe("Admin");
    await expect(firstNameCell.locator(".as-cell-json-trigger")).toHaveCount(0);
    const lastNameCell = await cellLocatorByPath(table, adminRow, "profile.lastName");
    expect((await lastNameCell.textContent())?.trim()).toBe("Root");

    // Last Login — relative time; AsCellDate renders `<td title="...ISO...">`.
    const lastLoginCell = await cellLocatorByPath(table, adminRow, "lastLoginAt");
    const lastLoginText = (await lastLoginCell.textContent())?.trim() ?? "";
    expect(lastLoginText.length).toBeGreaterThan(0);
    // Relative-time output from `formatTimeAgoIntl` — admin seeded 5 minutes
    // ago. Tolerant match: any "minutes/hours/seconds ago" body satisfies.
    expect(lastLoginText).toMatch(/ago$/i);
    const lastLoginTitle = await lastLoginCell.getAttribute("title");
    expect(lastLoginTitle).toMatch(/^\d{4}-\d{2}-\d{2}T/u);

    // Birthday — `@ui.table.type 'date'` overrides `number.timestamp →
    // datetime`. Date-only formatting includes year/month/day but NOT a
    // `hh:mm` clock segment. Admin's birthday is 1985-03-14.
    const birthdayCell = await cellLocatorByPath(table, adminRow, "birthday");
    const birthdayText = (await birthdayCell.textContent())?.trim() ?? "";
    expect(birthdayText).toContain("1985");
    expect(birthdayText).not.toMatch(/\b\d{1,2}:\d{2}\b/u);

    // Created — datetime; default inference from `@db.default.now`. Format
    // includes a `hh:mm` time segment.
    const createdCell = await cellLocatorByPath(table, adminRow, "createdAt");
    const createdText = (await createdCell.textContent())?.trim() ?? "";
    expect(createdText).toMatch(/\b\d{1,2}:\d{2}\b/u);

    // bob row — null timestamp branches.
    const bobRow = rowByCellText(table, usernameIdx, "bob").first();
    await expect(bobRow).toHaveCount(1);
    const bobLastLogin = await cellLocatorByPath(table, bobRow, "lastLoginAt");
    expect((await bobLastLogin.textContent())?.trim() ?? "").toBe("");
    const bobBirthday = await cellLocatorByPath(table, bobRow, "birthday");
    expect((await bobBirthday.textContent())?.trim() ?? "").toBe("");
  });

  test("2.2: Products — currency literal + unit + precision", async ({ page }) => {
    await gotoTable(page, "products");
    const table = page.locator("table.as-table").first();
    // First seeded data row works — every product has price + weight + tags.
    const firstRow = table.locator("tbody tr").first();

    const priceCell = await cellLocatorByPath(table, firstRow, "price");
    const priceText = (await priceCell.textContent())?.trim() ?? "";
    // `@db.amount.currency 'USD'` + `@db.column.precision 10, 2` →
    // `Intl.NumberFormat` currency style → `$X.XX` style. Symbol family
    // varies by OS locale data ("US$"/"$") so we just require dollar glyph.
    expect(priceText).toMatch(/\$\d/u);
    expect(priceText).toMatch(/\.\d{2}\b/u);

    const weightCell = await cellLocatorByPath(table, firstRow, "weight");
    const weightText = (await weightCell.textContent())?.trim() ?? "";
    // `@db.unit 'kg'` suffix + `@db.column.precision 6, 2`. Cell formats as
    // "<number with 2 frac digits> kg".
    expect(weightText).toMatch(/\d+\.\d{2}\s+kg$/u);

    const tagsCell = await cellLocatorByPath(table, firstRow, "tags");
    // Tags arrive as a primitive string array → AsCellArray's chip strip
    // branch (NOT the JSON popover branch).
    const chipStrip = tagsCell.locator(".as-cell-chips");
    await expect(chipStrip).toHaveCount(1);
    const chipCount = await tagsCell.locator(".as-cell-chip").count();
    expect(chipCount).toBeGreaterThan(0);
  });

  test("2.3: Tags chips — horizontal overflow, hidden scrollbar", async ({ page }) => {
    await gotoTable(page, "products");
    const table = page.locator("table.as-table").first();
    const tagsHead = table.locator(`thead th[data-column-path="tags"]`).first();
    const tagsIdx = await columnCellIndex(table, "tags");

    // Force a narrow column so chips DEFINITELY overflow horizontally; the
    // seed only stores 1–2 tags per row, which fits a default-width column.
    // The behavioural contract is "chips don't wrap and the scrollbar is
    // hidden when overflowing", not "the seed always overflows". Forcing
    // a small width pins the assertion to the cell shortcut behaviour.
    await tagsHead.evaluate((el) => {
      (el as HTMLElement).style.width = "60px";
    });

    const firstChipsCell = table
      .locator("tbody tr")
      .first()
      .locator("td")
      .nth(tagsIdx)
      .locator(".as-cell-chips");
    await expect(firstChipsCell).toHaveCount(1);

    // No wrap: flex-nowrap keeps everything on one line. We verify by
    // measuring the strip's scrollWidth vs clientWidth — a single line
    // overflowing horizontally has scrollWidth > clientWidth.
    const overflow = await firstChipsCell.evaluate((el) => {
      const node = el as HTMLElement;
      return { scrollW: node.scrollWidth, clientW: node.clientWidth, height: node.clientHeight };
    });
    expect(overflow.scrollW).toBeGreaterThan(overflow.clientW);
    // One row of chips ~ ~24-28px. Anything close to 2× would mean wrap.
    expect(overflow.height).toBeLessThan(48);

    // Hidden scrollbar — `scrollbar-width: none` on Firefox, ::-webkit-
    // scrollbar { height: 0 } on WebKit. Computed style of the host carries
    // the Firefox declaration; that's the behavioural marker we can read in
    // CDP / Chromium too.
    const scrollbarWidth = await firstChipsCell.evaluate(
      (el) => getComputedStyle(el as HTMLElement).scrollbarWidth,
    );
    expect(scrollbarWidth).toBe("none");
  });

  test("2.4: Orders — per-row currency via @db.amount.currency.ref + Lines popover + Status badge", async ({
    page,
  }) => {
    await gotoTable(page, "orders");
    const table = page.locator("table.as-table").first();

    const currencyIdx = await columnCellIndex(table, "currency");
    // Seed: `currencies = ['USD','EUR','GBP']`, rotated by `i % 3`. Every
    // currency reachable in the first 15 seeded rows.
    const usdRow = rowByCellText(table, currencyIdx, "USD").first();
    const eurRow = rowByCellText(table, currencyIdx, "EUR").first();
    const gbpRow = rowByCellText(table, currencyIdx, "GBP").first();
    await expect(usdRow).toHaveCount(1);
    await expect(eurRow).toHaveCount(1);
    await expect(gbpRow).toHaveCount(1);

    // Per-row currency — symbol family (e.g. `US$` vs `$`, `EUR` vs `€`)
    // depends on the host's CLDR; the assertion is "the currency code
    // surfaces in the formatted cell text", which is true across locales.
    const usdTotal = await cellTextByPath(page, table, usdRow, "total");
    const eurTotal = await cellTextByPath(page, table, eurRow, "total");
    const gbpTotal = await cellTextByPath(page, table, gbpRow, "total");
    expect(usdTotal).toMatch(/(?:US\$|\$)/u);
    expect(eurTotal).toMatch(/(?:€|EUR)/u);
    expect(gbpTotal).toMatch(/(?:£|GBP)/u);
    for (const t of [usdTotal, eurTotal, gbpTotal]) expect(t).toMatch(/\d+[.,]\d{2}/u);

    // Lines column — array-of-objects branch. AsCellArray detects non-
    // primitive items and renders the JSON-popover trigger.
    const linesCell = await cellLocatorByPath(table, usdRow, "lines");
    const trigger = linesCell.locator(".as-cell-json-trigger");
    await expect(trigger).toHaveCount(1);
    await expect(trigger.locator(".as-cell-json-trigger-glyph")).toHaveText("{}");
    // Seed always emits 2 line items per order.
    await expect(trigger.locator(".as-cell-json-trigger-count")).toHaveText("[2]");
    await expect(trigger).toHaveAttribute("aria-label", /^View 2 items$/);

    await trigger.click();
    // Reka portals to <body>, so the popup is page-scoped.
    const popup = page.locator(".as-cell-json-popup");
    await expect(popup).toBeVisible();
    const json = (await popup.locator(".as-cell-json-pre").textContent()) ?? "";
    expect(json.trim().startsWith("[")).toBe(true);
    expect(json).toContain("productId");
    expect(json).toContain("priceAtTime");
    // Dismiss to keep the next assertion's DOM clean.
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);

    // Status — `@ui.table.component 'status-badge'` route (named-component
    // override, distinct from the cell-type 'status' route used by users).
    // Find any visible row's status cell and assert it carries the badge
    // span with a known scope class.
    const statusCell = await cellLocatorByPath(table, table.locator("tbody tr").first(), "status");
    const statusBadge = statusCell.locator(".as-status-badge");
    await expect(statusBadge).toHaveCount(1);
    const badgeClass = (await statusBadge.getAttribute("class")) ?? "";
    expect(badgeClass).toMatch(/\bscope-(?:good|warn|error|neutral)\b/u);
  });

  test("2.5: Customers — @db.json opaque objects render via JSON popover", async ({ page }) => {
    await gotoTable(page, "customers");
    const table = page.locator("table.as-table").first();
    const firstRow = table.locator("tbody tr").first();

    // `Address` is a `@db.json` plain object → AsCellJson route (single
    // glyph button, no count badge).
    const addressCell = await cellLocatorByPath(table, firstRow, "address");
    const addressTrigger = addressCell.locator(".as-cell-json-trigger");
    await expect(addressTrigger).toHaveCount(1);
    await expect(addressTrigger.locator(".as-cell-json-trigger-glyph")).toHaveText("{}");
    await addressTrigger.click();

    const popup = page.locator(".as-cell-json-popup");
    await expect(popup).toBeVisible();
    const addressJson = (await popup.locator(".as-cell-json-pre").textContent()) ?? "";
    // Seed shape: { street, city, state, zip, country }.
    expect(addressJson).toContain("street");
    expect(addressJson).toContain("city");
    expect(addressJson).toContain("country");

    // Opaque-popover regression — `as-cell-json-popup` shortcut applies
    // `popup-card` (visible bg, rounded corners, shadow). We verify the
    // computed background is non-transparent.
    const bg = await popup.evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");

    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);

    // Preferences — same glyph button, different sub-document shape.
    const prefsCell = await cellLocatorByPath(table, firstRow, "preferences");
    const prefsTrigger = prefsCell.locator(".as-cell-json-trigger");
    await expect(prefsTrigger).toHaveCount(1);
    await prefsTrigger.click();
    await expect(popup).toBeVisible();
    const prefsJson = (await popup.locator(".as-cell-json-pre").textContent()) ?? "";
    expect(prefsJson).toContain("newsletter");
    expect(prefsJson).toContain("channel");
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
  });

  test("2.6: Audit Log — window-mode rendering + follow-up fetch", async ({ page }) => {
    await gotoTable(page, "audit_log");

    // <AsWindowTable> renders a synthesised scrollbar (`as-window-scrollbar`)
    // and a row pool (`as-window-row-pool`) in place of the virtual scroll
    // container. The window scrollbar only renders when `maxIndex > 0` —
    // i.e. the dataset exceeds the viewport row count. Seed populates 5000
    // synthetic audit rows so this is always reachable.
    await expect(page.locator(".as-window-row-pool")).toHaveCount(1);
    await expect(page.locator(".as-window-scrollbar")).toBeVisible();

    // Window mode disables the paged UI surface — `<TablePagination>` is
    // not rendered. The "Rows per page" label is the canonical marker.
    await expect(page.getByText("Rows per page")).toHaveCount(0);

    // Follow-up fetch: pushing topIndex past the loaded block triggers a
    // single `/pages` fetch for the next block. The initial load covers
    // page 0 (rows 0–99 at `DEFAULT_BLOCK_SIZE: 100`). We want topIndex
    // to land within the cached region's tail so `planFetch` picks the
    // STEADY branch (single block at the gap edge) rather than JUMP
    // (centred fetch that spans two adjacent uncached blocks → 2 reqs).
    //
    // Range that yields 1 fetch: top ∈ [1, 100] with viewport ≤ blockSize
    // — start (or start-1) stays cached, so STEADY fires for block 100
    // and the trailing prefetch buffer is satisfied. Above ~120, JUMP
    // fires and emits 2 requests.
    //
    // We dispatch the wheel events INSIDE `page.evaluate` so all 80 fire
    // synchronously in one tick — `wheelRowsPerTick = 1` increments
    // `pendingTopIndex` per event, then the rAF batch commits once. Done
    // outside the browser (`page.mouse.wheel` × 80) the per-event awaits
    // can land on different rAF cycles and the watcher overshoots.
    const pool = page.locator(".as-window-row-pool");
    await pool.hover();
    await expectSinglePages(
      page,
      async () => {
        await page.evaluate(() => {
          const el = document.querySelector(".as-window-row-pool");
          if (!el) throw new Error("row pool not in DOM");
          for (let i = 0; i < 80; i++) {
            el.dispatchEvent(
              new WheelEvent("wheel", { deltaY: 50, bubbles: true, cancelable: true }),
            );
          }
        });
      },
      { table: "audit_log" },
    );
  });
});
