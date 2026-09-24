// Section 6 — URL bridge: residual filter conditions (0.1.140).
//
// A link whose filter the per-field model cannot hold — a correlated
// cross-field OR — is carried as a "custom filter" condition instead of being
// dropped: the table shows exactly the rows the link describes, a chip says
// so, and the condition round-trips through reload, share, Back/Forward.
//
// Predicate (on /orders): (status = shipped AND customerId <= 5)
//                      OR (status = pending AND customerId > 5)
// Expected rows are derived from the table's own `status{shipped,pending}`
// view, filtered in the test — no seed ids are hard-coded.

import type { Response } from "@playwright/test";

import { type Page, expect, test } from "../fixtures";

import {
  applyPickerItem,
  clickColumnHeader,
  expectSinglePages,
  expectUrlQuery,
  gotoTable,
  pickSort,
} from "../helpers";

interface OrderRow {
  id: number;
  status: string;
  customerId: number;
}

// Written the way a person would type it: the `&` inside a group is raw.
const DEEP_LINK = "/orders?(status=shipped&customerId<=5)^(status=pending&customerId>5)";
const GROUP = "(status=shipped&customerId<=5)^(status=pending&customerId>5)";
const CHIP = ".as-residual-filter";

const matches = (r: OrderRow) =>
  (r.status === "shipped" && r.customerId <= 5) || (r.status === "pending" && r.customerId > 5);

function isOrdersPages(res: Response): boolean {
  return /\/api\/db\/tables\/orders\/pages(?:\?|$)/u.test(res.url());
}

/** Navigate and return the rows of the table's first `/pages` response. */
async function gotoAndReadRows(page: Page, url: string): Promise<OrderRow[]> {
  const pages = page.waitForResponse(isOrdersPages);
  await page.goto(url);
  const body = (await (await pages).json()) as { data: OrderRow[] };
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
  return body.data;
}

/** A change unrelated to filters, so the table writes its URL. */
async function sortTotalDesc(page: Page): Promise<void> {
  await expectSinglePages(
    page,
    async () => {
      await clickColumnHeader(page, "total");
      await pickSort(page, "desc");
    },
    { table: "orders" },
  );
}

const ids = (rows: OrderRow[]) => rows.map((r) => r.id).toSorted((a, b) => a - b);

async function expectedIds(page: Page): Promise<number[]> {
  const candidates = await gotoAndReadRows(page, "/orders?status{shipped,pending}");
  const expected = ids(candidates.filter(matches));
  // The predicate must be selective both ways, or the test proves nothing.
  expect(expected.length).toBeGreaterThan(0);
  expect(expected.length).toBeLessThan(candidates.length);
  return expected;
}

test.describe("Section 6.R — residual filter conditions", () => {
  test("R1 deep link with a correlated OR shows exactly its rows and a custom-filter chip", async ({
    page,
  }) => {
    const expected = await expectedIds(page);

    let rows: OrderRow[] = [];
    const captured = await expectSinglePages(
      page,
      async () => {
        rows = await gotoAndReadRows(page, DEEP_LINK);
      },
      { table: "orders" },
    );

    expect(decodeURIComponent(captured.url)).toContain("^");
    expect(ids(rows)).toEqual(expected);

    const chip = page.locator(CHIP);
    await expect(chip).toHaveCount(1);
    await expect(chip.locator(".as-residual-filter-label")).toHaveText("Custom filter");
    await expect(chip.locator(".as-residual-filter-text")).toContainText("equals shipped");

    // Hydrating does not rewrite the URL; the next change writes the table's
    // own spelling — marker included, the condition kept, and none of the
    // hand-written fragments left behind as "foreign" keys.
    expectUrlQuery(page, [GROUP]);
    await sortTotalDesc(page);
    await expect.poll(() => decodeURIComponent(page.url())).toContain("$snapshot");
    expect(decodeURIComponent(page.url()).split(GROUP)).toHaveLength(2);
    await expect(page.locator(CHIP)).toHaveCount(1);
  });

  test("R2 reload and a shared link reproduce the rows and the chip", async ({ page, browser }) => {
    const expected = await expectedIds(page);
    await gotoAndReadRows(page, DEEP_LINK);
    // Make the table write its own URL, then reload / share that one.
    await sortTotalDesc(page);
    await expect.poll(() => decodeURIComponent(page.url())).toContain("$snapshot");
    const shared = page.url();

    const reload = page.waitForResponse(isOrdersPages);
    await page.reload();
    const reloaded = (await (await reload).json()) as { data: OrderRow[] };
    expect(ids(reloaded.data)).toEqual(expected);
    await expect(page.locator(CHIP)).toHaveCount(1);

    const context = await browser.newContext({ storageState: await page.context().storageState() });
    try {
      const other = await context.newPage();
      const rows = await gotoAndReadRows(other, shared);
      expect(ids(rows)).toEqual(expected);
      await expect(other.locator(CHIP)).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test("R3 removing the chip drops the condition from the query and the URL", async ({ page }) => {
    await gotoAndReadRows(page, DEEP_LINK);
    await expect(page.locator(CHIP)).toHaveCount(1);

    const captured = await expectSinglePages(
      page,
      async () => {
        await page.locator(`${CHIP} .as-residual-filter-remove`).click();
      },
      { table: "orders" },
    );
    expect(decodeURIComponent(captured.url)).not.toContain("^");
    await expect(page.locator(CHIP)).toHaveCount(0);
    await expect.poll(() => decodeURIComponent(page.url())).not.toContain("^");
  });

  test("R4 Back / Forward restore and drop the condition", async ({ page }) => {
    await gotoTable(page, "orders");
    await expect(page.locator(CHIP)).toHaveCount(0);

    await gotoAndReadRows(page, DEEP_LINK);
    await expect(page.locator(CHIP)).toHaveCount(1);

    await page.goBack();
    await expect(page.locator(CHIP)).toHaveCount(0);
    expectUrlQuery(page, [GROUP], { not: true });

    await page.goForward();
    await expect(page.locator(CHIP)).toHaveCount(1);
  });

  test("R5 applying the Standard preset clears the condition", async ({ page }) => {
    await gotoAndReadRows(page, DEEP_LINK);
    await expect(page.locator(CHIP)).toHaveCount(1);

    await applyPickerItem(page, "Standard", { table: "orders" });
    await expect(page.locator(CHIP)).toHaveCount(0);
    await expect.poll(() => decodeURIComponent(page.url())).not.toContain("^");
  });
});
