// Section 5 — Value-help bindings without a foreign key (0.1.148).
//
// Demo wiring (`packages/vue-demo/src/server/schemas`):
//   - `attribute-values.as` — dictionary with a composite key (attribute, value),
//     `@ui.dict.label label`, `active`; served at `/db/tables/attribute-values`.
//   - `products.color` / `.size` — `@ui.valueHelp AttributeValuesTable, 'value', ...`
//     (a static `attribute = '…'` scope, `active = true` on size).
//   - `products.brand`, `customers.city` — `@ui.valueHelp.distinct` (130 / 5 distinct values).
//   - `tasks.status` — `@ui.literalLabel` ('in-progress' → "In progress").
//   - the invite workflow form's `team` — a binding inside a workflow form.
//
// The viewer role may read products + customers but has NO rule on attribute
// values, and its customers scope carries `$groupBy: false`.

import { type Locator, type Page, expect, test } from "../fixtures";

import { addFilterPill, authFileFor, captureWire, gotoTable } from "../helpers";

const DROPDOWN = ".as-filter-field-dropdown";
const DIALOG = ".as-filter-dialog-content";

async function openDialogViaF4(page: Page, pill: Locator): Promise<Locator> {
  await pill.locator(".as-filter-field-search").focus();
  await pill.locator(".as-filter-field-f4").click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Visible value cells of the dialog's inner table. */
async function dialogValues(dialog: Locator): Promise<string[]> {
  const cells = dialog.locator("table.as-table tbody tr:has(td)");
  await expect(cells.first()).toBeVisible();
  return (await cells.allTextContents()).map((s) => s.replace(/\s+/g, " ").trim());
}

test.describe("Section 5.1 — @ui.valueHelp on a composite-key dictionary (products.color)", () => {
  test("dialog lists only colour values, hides the pinned attribute column, filters the table", async ({
    page,
  }) => {
    await gotoTable(page, "products");
    const pill = await addFilterPill(page, "Color");

    const wire = captureWire(page, { urlSubstring: "/api/db/tables/attribute-values/" });
    try {
      const dialog = await openDialogViaF4(page, pill);
      const rows = await dialogValues(dialog);

      // Only the colour dictionary rows (value + label columns), none of size / material / team.
      expect(rows.length).toBe(4);
      expect(rows.join("|")).toMatch(/red/i);
      expect(rows.join("|")).toMatch(/blue/i);
      expect(rows.join("|")).not.toMatch(/small|large|cotton|support|sales/i);

      // The attribute column is pinned by `attribute = 'color'` — constant, so not shown.
      const headers = await dialog.locator("table.as-table thead th").allTextContents();
      expect(headers.join("|")).not.toMatch(/attribute/i);

      // The static scope rode every dictionary request.
      const dictRequests = wire.records.filter((r) => /\/(pages|query)\?/.test(r.url));
      expect(dictRequests.length).toBeGreaterThan(0);
      for (const r of dictRequests) expect(decodeURIComponent(r.url)).toContain("attribute=color");

      // Pick Blue (rows are keyed by the committed field `value`, not the PK head).
      await dialog.locator("table.as-table tbody tr:has(td)", { hasText: /blue/i }).click();
      await expect(dialog.locator(".as-filter-dialog-chips-count")).toHaveText("1");
      const pages = page.waitForRequest(
        (r) =>
          /\/api\/db\/tables\/products\/pages\?/.test(r.url()) &&
          /color=blue/.test(decodeURIComponent(r.url())),
      );
      await dialog.locator(".as-filter-btn-apply").click();
      await pages;
    } finally {
      wire.dispose();
    }

    // The filter is on the committed value (`blue`), and the table result follows it.
    const table = page.locator("table[data-as-main-table]");
    const colorIdx = await table
      .locator('thead th[data-column-path="color"]')
      .evaluate((el) => (el as HTMLTableCellElement).cellIndex);
    await expect
      .poll(async () => {
        const cells = await table
          .locator(`tbody tr td:nth-child(${colorIdx + 1})`)
          .allTextContents();
        return cells.length > 0 && cells.every((c) => c.trim() === "blue");
      })
      .toBe(true);
  });

  test("size binding adds `active = true` to the static scope (the inactive XL is not offered)", async ({
    page,
  }) => {
    await gotoTable(page, "products");
    const pill = await addFilterPill(page, "Size");
    const dialog = await openDialogViaF4(page, pill);
    const rows = (await dialogValues(dialog)).join("|");
    expect(rows).toMatch(/small/i);
    expect(rows).toMatch(/large/i);
    expect(rows).not.toMatch(/extra large/i);
  });

  test("inline filter-field search narrows within the colour scope only", async ({ page }) => {
    await gotoTable(page, "products");
    const pill = await addFilterPill(page, "Color");
    const dropdown = page.locator(DROPDOWN);
    const input = pill.locator(".as-filter-field-search");

    await input.click();
    await expect(dropdown).toBeVisible();
    await expect(dropdown.locator("tbody tr td", { hasText: /^Red$/ })).toHaveCount(1);

    // `^s` matches size / support rows of OTHER attributes in the dictionary; the
    // scope keeps them out.
    const scoped = page.waitForRequest(
      (r) =>
        /\/api\/db\/tables\/attribute-values\/query\?/.test(r.url()) &&
        decodeURIComponent(r.url()).includes("^s"),
    );
    await input.fill("s");
    const req = await scoped;
    expect(decodeURIComponent(req.url())).toContain("attribute=color");
    await expect(dropdown.getByText("No matching values")).toBeVisible();
    await expect(dropdown.locator("tbody tr", { hasText: /Small|Support|Sales/ })).toHaveCount(0);

    // `bl` finds Blue + Black
    await input.fill("bl");
    await expect(dropdown.locator("tbody tr td", { hasText: /^Blue$/ })).toHaveCount(1);
    await expect(dropdown.locator("tbody tr td", { hasText: /^Black$/ })).toHaveCount(1);
    await expect(dropdown.locator("tbody tr td", { hasText: /^Green$/ })).toHaveCount(0);

    // Committing a pick stores the value (`blue`), not the label.
    await dropdown
      .locator("tbody tr td", { hasText: /^Blue$/ })
      .first()
      .click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/color=blue/);
  });
});

test.describe("Section 5.2 — form picker commits the value (products edit form)", () => {
  test("Color picker offers the colour values and stores `value`, not label or attribute", async ({
    page,
  }) => {
    // the picker searches the dictionary as soon as the field mounts
    const scoped = page.waitForRequest(
      (r) =>
        /\/api\/db\/tables\/attribute-values\/query\?/.test(r.url()) &&
        decodeURIComponent(r.url()).includes("attribute=color"),
    );
    await page.goto("/products/SKU-00001/edit");
    const color = page.locator(".as-default-field", {
      has: page.locator("label", { hasText: /^Color$/ }),
    });
    await expect(color).toBeVisible();
    await scoped;
    await color.locator(".as-ref-input").click();

    const items = page.locator(".as-ref-item");
    await expect(items).toHaveCount(4);
    await expect(items.filter({ hasText: /Small|Support/ })).toHaveCount(0);

    const patch = page.waitForRequest(
      (r) => r.method() === "PATCH" && /\/api\/db\/tables\/products(\/|\?|$)/.test(r.url()),
    );
    await items.filter({ hasText: "Green" }).click();
    await page
      .getByRole("button", { name: /save|submit|update/i })
      .first()
      .click();
    const body = (await patch).postDataJSON() as Record<string, unknown>;
    expect(body.color).toBe("green");
  });
});

test.describe("Section 5.3 — distinct-values picker (@ui.valueHelp.distinct)", () => {
  test("customers.city: sorted, de-duplicated, no null, searchable; the pick filters the table", async ({
    page,
  }) => {
    await gotoTable(page, "customers");
    const pill = await addFilterPill(page, "City");
    const dropdown = page.locator(DROPDOWN);
    const input = pill.locator(".as-filter-field-search");

    const grouped = page.waitForRequest(
      (r) =>
        /\/api\/db\/tables\/customers\/query\?/.test(r.url()) &&
        decodeURIComponent(r.url()).includes("$groupBy=city"),
    );
    await input.click();
    const req = decodeURIComponent((await grouped).url());
    expect(req).toContain("$select=city");
    expect(req).toContain("$sort=city");

    await expect(dropdown).toBeVisible();
    const values = dropdown.locator("tbody tr");
    await expect(values).toHaveCount(5);
    expect((await values.allInnerTexts()).map((s) => s.trim())).toEqual([
      "Austin",
      "Berlin",
      "Bonn",
      "Boston",
      "Chicago",
    ]);

    // server search: case-insensitive prefix
    await input.fill("bo");
    await expect(values).toHaveCount(2);
    expect((await values.allInnerTexts()).map((s) => s.trim())).toEqual(["Bonn", "Boston"]);

    await dropdown.locator("tbody tr td", { hasText: /^Bonn$/ }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/city=Bonn/);
    const table = page.locator("table[data-as-main-table]");
    await expect(table.locator("tbody tr:has(td)")).toHaveCount(2);
  });

  test("products.brand dialog: first block, then more values load on scroll", async ({ page }) => {
    await gotoTable(page, "products");
    const pill = await addFilterPill(page, "Brand");
    const dialog = await openDialogViaF4(page, pill);

    const first = await dialogValues(dialog);
    expect(first[0]).toBe("Brand 001");

    // the window table pages by wheel: scroll to the end until the next page is asked for
    const next = page.waitForRequest(
      (r) =>
        /\/api\/db\/tables\/products\/query\?/.test(r.url()) &&
        decodeURIComponent(r.url()).includes("$skip=100"),
    );
    // (synthesised wheel events, batched in one frame — as in section 10 window mode)
    await dialog.locator(".as-window-row-pool").evaluate((el) => {
      for (let i = 0; i < 80; i++) {
        el.dispatchEvent(new WheelEvent("wheel", { deltaY: 50, bubbles: true, cancelable: true }));
      }
    });
    await next;

    // the loaded values keep their order and continue past the first page
    await expect(dialog.locator(".as-filter-value-help-count")).toContainText(/\d+ records/);
    await expect
      .poll(async () => {
        await dialog.locator(".as-window-row-pool").evaluate((el) => {
          for (let i = 0; i < 40; i++) {
            el.dispatchEvent(
              new WheelEvent("wheel", { deltaY: 50, bubbles: true, cancelable: true }),
            );
          }
        });
        const rows = await dialogValues(dialog);
        return rows.some((r) => r > "Brand 100");
      })
      .toBe(true);
  });
});

test.describe("Section 5.4 — @ui.literalLabel (tasks.status)", () => {
  test("labels show in cells, the filter options and the chip; the wire carries the literal", async ({
    page,
  }) => {
    await gotoTable(page, "tasks");
    const table = page.locator("table[data-as-main-table]");
    await expect(table.locator("tbody tr td", { hasText: /^In progress$/ }).first()).toBeVisible();
    await expect(table.locator("tbody tr td", { hasText: /^in-progress$/ })).toHaveCount(0);

    const pill = await addFilterPill(page, "Status");
    const dropdown = page.locator(DROPDOWN);
    await pill.locator(".as-filter-field-search").click();
    await expect(dropdown).toBeVisible();
    const options = (await dropdown.locator("tbody tr").allInnerTexts()).map((s) => s.trim());
    expect(options).toEqual(["Open", "In progress", "Done", "Archived"]);

    const pages = page.waitForRequest(
      (r) =>
        /\/api\/db\/tables\/tasks\/pages\?/.test(r.url()) &&
        decodeURIComponent(r.url()).includes("status='in-progress'"),
    );
    await dropdown.locator("tbody tr td", { hasText: /^In progress$/ }).click();
    await pages;
    await page.keyboard.press("Escape");
    await expect(pill.locator(".as-filter-field-chip")).toHaveText(/In progress/);
  });
});

test.describe("Section 5.5 — ARBAC: no help when the server declines", () => {
  test("a role without read on the dictionary gets a free-text colour filter", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFileFor("viewer") });
    try {
      const page = await ctx.newPage();
      await gotoTable(page, "products");
      const pill = await addFilterPill(page, "Color");
      const input = pill.locator(".as-filter-field-search");

      const denied = page.waitForResponse(
        (r) => /\/api\/db\/tables\/attribute-values\/meta/.test(r.url()) && r.status() === 403,
      );
      await input.click();
      await denied;
      // the picker is gone: typing + Enter applies a plain predicate chip
      await expect(page.locator(DROPDOWN)).toHaveCount(0);
      await input.fill("blue");
      await input.press("Enter");
      await expect(pill.locator(".as-filter-field-chip")).toHaveCount(1);
      await expect(page).toHaveURL(/color/);
    } finally {
      await ctx.close();
    }
  });

  // What the demo's ARBAC does with `$groupBy: false` depends on the aooth release it runs:
  // older ones answer the grouped read with a 403 (the picker shows the error), newer ones strip
  // `groupable` from the meta so no picker is offered at all. Either way the viewer never gets
  // a list of city values, and never a silent empty one.
  test("a role with `$groupBy: false` gets no city values: no picker, or an error that asks again", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFileFor("viewer") });
    try {
      const page = await ctx.newPage();
      await gotoTable(page, "customers");
      const pill = await addFilterPill(page, "City");
      const input = pill.locator(".as-filter-field-search");

      const denied = () =>
        page
          .waitForResponse(
            (r) => /\/api\/db\/tables\/customers\/query\?/.test(r.url()) && r.status() === 403,
            { timeout: 4000 },
          )
          .then(
            () => true,
            () => false,
          );
      const first = denied();
      await input.click();

      if (await first) {
        // a picker that asks: it stays, shows the failure, and nothing remembers it
        await expect(page.locator(`${DROPDOWN} .as-table-error`)).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator(DROPDOWN)).toHaveCount(0);
        const second = denied();
        await input.click();
        expect(await second).toBe(true);
        await expect(page.locator(`${DROPDOWN} .as-table-error`)).toBeVisible();
      } else {
        // no picker offered: the column takes free text
        await expect(page.locator(DROPDOWN)).toHaveCount(0);
        await input.fill("Berlin");
        await input.press("Enter");
        await expect(pill.locator(".as-filter-field-chip")).toHaveCount(1);
      }
    } finally {
      await ctx.close();
    }
  });
});

test.describe("Section 5.6 — binding inside a workflow form", () => {
  test("the invite form's Team field opens a picker scoped to the team values", async ({
    page,
  }) => {
    await page.goto("/users/invite");
    await expect(page.getByRole("heading", { name: "Invite user", level: 1 })).toBeVisible();

    const team = page.locator(".as-default-field", {
      has: page.locator("label", { hasText: /^Team$/ }),
    });
    // `team` is optional: enabling it mounts the picker, which searches the team scope
    const scoped = page.waitForRequest(
      (r) =>
        /\/api\/db\/tables\/attribute-values\/query\?/.test(r.url()) &&
        decodeURIComponent(r.url()).includes("attribute=team"),
    );
    await team.locator(".as-no-data").click();
    await scoped;
    await team.locator(".as-ref-input").click();

    const items = page.locator(".as-ref-item");
    await expect(items).toHaveCount(2);
    await expect(items.filter({ hasText: /Support/ })).toHaveCount(1);
    await expect(items.filter({ hasText: /Red|Small/ })).toHaveCount(0);
  });
});
