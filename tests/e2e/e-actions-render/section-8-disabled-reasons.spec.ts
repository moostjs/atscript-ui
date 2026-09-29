// Section 8 — Actions: disabled WITH a reason (`$disabledReasons`).
//
// Read-only batch — the only actions invoked (`show-parent`) are reports, and
// the gated POSTs are rejected before the handler runs.
//
// Demo wiring (`categories.controller.ts`), against the seed:
//   Electronics (1) / Books (4)          — top-level
//   Laptops (2) / Phones (3) → Electronics, Fiction (5) → Books
//
//   show-parent   row, DEFAULT — disabled WITH a reason on top-level rows
//   export-branch row — disabled WITHOUT a reason (hidden) on subcategories
//   promote       rows — disabled WITH a reason on top-level rows
//
// Coverage:
//   8.D1 wire — `$actions` + `$disabledReasons` per row
//   8.D2 row menu — disabled item shown greyed with its reason, keyboard-
//        reachable, never invoked; reason-less disabled action hidden
//   8.D3 main action — double-click / Enter on a row whose default is
//        disabled does nothing; on an allowed row it runs
//   8.D4 toolbar — single-row CTA and bulk selection render the disabled
//        default with the reason as title; union keeps it enabled when any
//        selected row allows it
//   8.D5 409 — the gate's rejection carries `reason` / `reasons`

import { type Locator, type Page, expect, test } from "../fixtures";

import {
  captureWire,
  columnCellIndex,
  findToast,
  gotoTable,
  newRequestContext,
  openRowActionsMenu,
  rowByCellText,
  selectRowByIndex,
  toggleSelectMode,
} from "../helpers";

const TOP_LEVEL = "Top-level category has no parent";
const ALREADY_TOP = "Already a top-level category";

async function categoriesTable(page: Page): Promise<{ table: Locator; nameIdx: number }> {
  await gotoTable(page, "categories");
  const table = page.locator("table[data-as-main-table]");
  const nameIdx = await columnCellIndex(table, "name");
  return { table, nameIdx };
}

async function rowNamed(table: Locator, nameIdx: number, name: string): Promise<Locator> {
  const row = rowByCellText(table, nameIdx, name).first();
  await expect(row).toHaveCount(1);
  return row;
}

/** Let any request a gesture would have fired go out, then return what was captured. */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(600);
}

test.describe("Section 8.D — disabled actions with a reason", () => {
  test("8.D1 GET /pages?$actions=true carries $disabledReasons only for reasoned verdicts", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const resp = await ctx.get(
        "/api/db/tables/categories/pages?$select=id,name&$actions=true&$page=1&$size=10",
      );
      expect(resp.status()).toBe(200);
      const body = (await resp.json()) as {
        data: Array<{
          name: string;
          $actions?: string[];
          $disabledReasons?: Record<string, string>;
        }>;
      };
      const byName = new Map(body.data.map((r) => [r.name, r]));
      const electronics = byName.get("Electronics")!;
      expect(electronics.$actions).toEqual(["export-branch"]);
      expect(electronics.$disabledReasons).toEqual({
        "show-parent": TOP_LEVEL,
        promote: ALREADY_TOP,
      });
      const laptops = byName.get("Laptops")!;
      expect(laptops.$actions?.toSorted()).toEqual(["promote", "show-parent"]);
      // `export-branch` is disabled with `true` — hidden, no reason on the wire.
      expect(laptops.$disabledReasons).toBeUndefined();
    } finally {
      await ctx.dispose();
    }
  });

  test("8.D2 row menu — reasoned action shown disabled, reachable, inert; reason-less one hidden", async ({
    page,
  }) => {
    const { table, nameIdx } = await categoriesTable(page);
    const wire = captureWire(page, {
      urlSubstring: "/api/db/tables/categories/actions/",
      method: "POST",
    });
    try {
      const menu = await openRowActionsMenu(page, await rowNamed(table, nameIdx, "Electronics"));
      const items = menu.locator(".as-row-actions-menu-item");
      const showParent = items.filter({ hasText: "Show parent" });
      await expect(showParent).toHaveAttribute("aria-disabled", "true");
      await expect(showParent).toHaveAttribute("aria-label", `Show parent, ${TOP_LEVEL}`);
      await expect(showParent).toHaveAttribute("data-default", "true");
      await expect(showParent.locator(".as-row-actions-menu-item-reason")).toHaveText(TOP_LEVEL);
      await expect(showParent).toHaveCSS("cursor", "not-allowed");
      const promote = items.filter({ hasText: "Move to top level" });
      await expect(promote).toHaveAttribute("aria-disabled", "true");
      await expect(promote.locator(".as-row-actions-menu-item-reason")).toHaveText(ALREADY_TOP);
      const exportBranch = items.filter({ hasText: "Export branch" });
      await expect(exportBranch).not.toHaveAttribute("aria-disabled", /.*/u);
      await expect(exportBranch.locator(".as-row-actions-menu-item-reason")).toHaveCount(0);

      // Keyboard reaches the disabled item (reka's own `disabled` would skip
      // it), so its reason is announced; Enter on it does nothing.
      await page.keyboard.press("ArrowDown");
      await expect(showParent).toBeFocused();
      await page.keyboard.press("Enter");
      // Pointer activation is inert too — and the menu stays open. (`force`:
      // Playwright treats `aria-disabled` as not actionable; the point here is
      // that the gesture lands and does nothing.)
      await showParent.click({ force: true });
      await settle(page);
      await expect(menu).toBeVisible();
      expect(wire.records).toHaveLength(0);
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);

      // A subcategory: show-parent / promote enabled; export-branch is
      // disabled WITHOUT a reason → hidden.
      const childMenu = await openRowActionsMenu(page, await rowNamed(table, nameIdx, "Laptops"));
      const childItems = childMenu.locator(".as-row-actions-menu-item");
      await expect(childItems.filter({ hasText: "Export branch" })).toHaveCount(0);
      await expect(childItems.filter({ hasText: "Show parent" })).not.toHaveAttribute(
        "aria-disabled",
        /.*/u,
      );
      await expect(childItems.locator("[class*='-menu-item-reason']")).toHaveCount(0);
      await page.keyboard.press("Escape");
    } finally {
      wire.dispose();
    }
  });

  test("8.D3 main action — dblclick / Enter skip a row whose default is disabled", async ({
    page,
  }) => {
    const { table, nameIdx } = await categoriesTable(page);
    const wire = captureWire(page, {
      urlSubstring: "/api/db/tables/categories/actions/show-parent",
      method: "POST",
    });
    try {
      const electronics = await rowNamed(table, nameIdx, "Electronics");
      await electronics.locator("td").nth(nameIdx).dblclick();
      await settle(page);
      expect(wire.records).toHaveLength(0);

      // Keyboard: the (clicked) active row, Enter.
      const books = await rowNamed(table, nameIdx, "Books");
      await books.locator("td").nth(nameIdx).click();
      await expect(books).toHaveClass(/as-table-row-active/u);
      await page.keyboard.press("Enter");
      await settle(page);
      expect(wire.records).toHaveLength(0);

      // Allowed rows still run the default — dblclick and Enter.
      const laptops = await rowNamed(table, nameIdx, "Laptops");
      await laptops.locator("td").nth(nameIdx).dblclick();
      await findToast(page, "Laptops → parent: Electronics");
      const fiction = await rowNamed(table, nameIdx, "Fiction");
      await fiction.locator("td").nth(nameIdx).click();
      await page.keyboard.press("Enter");
      await findToast(page, "Fiction → parent: Books");
      expect(wire.records.map((r) => r.body)).toEqual([{ ids: { id: 2 } }, { ids: { id: 5 } }]);
    } finally {
      wire.dispose();
    }
  });

  test("8.D4 toolbar — disabled CTA carries the reason; bulk union enables it for a mixed selection", async ({
    page,
  }) => {
    const { table } = await categoriesTable(page);
    const wire = captureWire(page, {
      urlSubstring: "/api/db/tables/categories/actions/",
      method: "POST",
    });
    try {
      await toggleSelectMode(page);
      // Multi-select prepends the checkbox column — resolve the index now.
      const nameIdx = await columnCellIndex(table, "name");
      const rows = table.locator("tbody tr:has(td)");
      const names = (await rows.locator(`td:nth-child(${nameIdx + 1})`).allTextContents()).map(
        (t) => t.trim(),
      );
      const at = (name: string) => names.indexOf(name);

      // One top-level row selected → row level: the default CTA is disabled.
      await selectRowByIndex(table, at("Electronics"));
      const cta = page.locator(".as-table-actions-btn[data-default]");
      await expect(cta).toContainText("Show parent");
      await expect(cta).toHaveAttribute("aria-disabled", "true");
      await expect(cta).toHaveAttribute("title", `Show parent, ${TOP_LEVEL}`);
      await expect(cta).toHaveCSS("cursor", "not-allowed");
      await cta.click({ force: true });

      // Two top-level rows → bulk: `promote` alone collapses to the CTA,
      // disabled with the (single distinct) reason.
      await selectRowByIndex(table, at("Books"));
      await expect(cta).toContainText("Move to top level");
      await expect(cta).toHaveAttribute("aria-disabled", "true");
      await expect(cta).toHaveAttribute("title", `Move to top level, ${ALREADY_TOP}`);
      await cta.click({ force: true });
      await settle(page);
      expect(wire.records).toHaveLength(0);

      // Add a subcategory → at least one selected row allows it → enabled.
      await selectRowByIndex(table, at("Laptops"));
      await expect(cta).toContainText("Move to top level");
      await expect(cta).not.toHaveAttribute("aria-disabled", /.*/u);
    } finally {
      wire.dispose();
    }
  });

  test("8.D5 POST past the gate → 409 with reason / reasons", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const single = await ctx.post("/api/db/tables/categories/actions/show-parent", {
        data: { ids: { id: 1 } },
      });
      expect(single.status()).toBe(409);
      const sBody = (await single.json()) as { name?: string; message?: string; reason?: string };
      expect(sBody.name).toBe("ActionDisabledError");
      expect(sBody.reason).toBe(TOP_LEVEL);
      expect(sBody.message).toBe(TOP_LEVEL);

      // `'skip'` mode, zero survivors → rejected with every row's reason.
      const bulk = await ctx.post("/api/db/tables/categories/actions/promote", {
        data: { ids: [{ id: 1 }, { id: 4 }] },
      });
      expect(bulk.status()).toBe(409);
      const bBody = (await bulk.json()) as { reason?: string; reasons?: (string | null)[] };
      expect(bBody.reasons).toEqual([ALREADY_TOP, ALREADY_TOP]);
      expect(bBody.reason).toBe(ALREADY_TOP);
    } finally {
      await ctx.dispose();
    }
  });
});
