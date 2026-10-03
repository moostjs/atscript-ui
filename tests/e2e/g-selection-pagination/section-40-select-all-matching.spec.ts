// Section 40 — "Select all N matching" (query selection) + query-targeted
// actions (0.1.147).
//
// Demo surfaces (`packages/vue-demo/src/client/domain/tables.ts`):
//   - `/tasks` — `<AsTable select="multi">` over the 60 seeded tasks, 10 per
//     page, `:select-all-matching="true"`.
//   - `/tasks-window` — `<AsWindowTable>` over the same tasks, `blockSize: 15`
//     (so the 60 rows never load in one block; the header select-all then
//     acts on the cached rows).
//
// Server (`packages/vue-demo/src/server/controllers/tasks.controller.ts`):
//   - `archive`      rows, streamed `@DbActionTarget`, `queryTarget { maxRows: 500 }`,
//                    archived rows skipped ("Already archived").
//   - `set-priority` rows, `@InputForm(SetPriorityInput)`, `queryTarget { maxRows: 1000 }`.
//   - `reopen`       rows, `queryTarget { maxRows: 25 }` → "At most 25 rows" over 60.
//   - `notify`       rows, NO `queryTarget` → disabled in query mode.
//
// Seed (`seedTasks`): 60 tasks — 15 open, 15 in-progress, 20 done, 10
// archived. Mutating file: `resetSeed()` in `beforeAll`, serial.

import { type Locator, type Page, expect, test } from "../fixtures";

import {
  countRows,
  captureWire,
  clickPaginationPage,
  findToast,
  gotoTable,
  pickPillEnumValue,
  pillByLabel,
  resetSeed,
} from "../helpers";

// ---------------------------------------------------------------------
// File-local helpers.

const MAIN_TABLE = "table[data-as-main-table]";
const ROWS = "tbody tr:has(td)";
const SELECTED_COUNT = ".as-page-selection-count";
const BANNER = ".as-selection-banner";
const TASKS_API = "/api/db/tables/tasks";

function mainTable(page: Page): Locator {
  return page.locator(MAIN_TABLE);
}

function headerCheckbox(page: Page): Locator {
  return mainTable(page).locator("thead th.as-th-select [role='checkbox']");
}

function rowCheckbox(page: Page, index: number): Locator {
  return mainTable(page).locator(ROWS).nth(index).locator(".as-td-select .as-table-checkbox");
}

async function expectSelectedCount(page: Page, n: number): Promise<void> {
  if (n === 0) await expect(page.locator(SELECTED_COUNT)).toHaveCount(0);
  else await expect(page.locator(SELECTED_COUNT)).toHaveText(`${n} selected`);
}

/** Open the toolbar `…` menu and return its items. */
async function openToolbarMenu(page: Page): Promise<Locator> {
  await page.locator(".as-table-actions-more").click();
  const menu = page.locator(".as-table-actions-menu");
  await expect(menu).toBeVisible();
  return menu.locator(".as-table-actions-menu-item");
}

/** Navigate to `/tasks?<query>` and wait for the first `/pages` round trip. */
async function gotoTasksWith(page: Page, query: string): Promise<void> {
  const pages = page.waitForResponse(`**${TASKS_API}/pages**`);
  await page.goto(`/tasks?${query}`);
  await pages;
  await expect(mainTable(page).locator(ROWS).first()).toBeVisible();
}

/** Header select-all → banner offer → "Select all N matching". */
async function selectAllMatching(page: Page, total: number): Promise<void> {
  await headerCheckbox(page).click();
  const offer = page.locator(BANNER).locator("[data-select-all-matching]");
  await expect(offer).toHaveText(`Select all ${total} matching`);
  await offer.click();
  await expect(page.locator(BANNER)).toContainText(`All ${total} matching rows are selected.`);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetSeed();
});

// ---------------------------------------------------------------------

test.describe("Section 40.1 — Banner and query mode on <AsTable>", () => {
  test("header select-all offers every matching row; query mode; excluding a row", async ({
    page,
  }) => {
    await gotoTable(page, "tasks");
    const banner = page.locator(BANNER);
    // The live region is mounted (sr-only) but no banner shows yet.
    await expect(banner).toHaveCount(0);
    await expect(page.locator("[role='status'][aria-live='polite']").first()).toBeAttached();

    await headerCheckbox(page).click();
    await expect(banner).toHaveAttribute("data-kind", "offer");
    await expect(banner).toContainText("All 10 rows on this page are selected.");
    await expect(banner.locator("[data-select-all-matching]")).toHaveText("Select all 60 matching");
    await expectSelectedCount(page, 10);

    await banner.locator("[data-select-all-matching]").click();
    await expect(banner).toHaveAttribute("data-kind", "query");
    await expect(banner).toContainText("All 60 matching rows are selected.");
    await expect(banner.locator("[data-clear-selection]")).toHaveText("Clear selection");
    await expectSelectedCount(page, 60);
    await expect(headerCheckbox(page)).toHaveAttribute("aria-checked", "true");

    // Excluding a loaded row: 59, header mixed, the other loaded rows stay checked.
    await rowCheckbox(page, 0).click();
    await expectSelectedCount(page, 59);
    await expect(banner).toContainText("All 59 matching rows are selected.");
    await expect(headerCheckbox(page)).toHaveAttribute("aria-checked", "mixed");
    await expect(mainTable(page).locator(ROWS).nth(0)).toHaveAttribute("aria-selected", "false");
    await expect(mainTable(page).locator(ROWS).nth(1)).toHaveAttribute("aria-selected", "true");

    // Clear selection drops the query selection entirely.
    await banner.locator("[data-clear-selection]").click();
    await expect(banner).toHaveCount(0);
    await expectSelectedCount(page, 0);
  });

  test("toolbar in query mode: queryTarget actions enabled, others disabled with a reason", async ({
    page,
  }) => {
    await gotoTable(page, "tasks");
    await selectAllMatching(page, 60);

    const items = await openToolbarMenu(page);
    const archive = items.filter({ hasText: "Archive" });
    const setPriority = items.filter({ hasText: "Set priority" });
    const reopen = items.filter({ hasText: "Reopen" });
    const notify = items.filter({ hasText: "Notify assignees" });

    await expect(archive).not.toHaveAttribute("aria-disabled", "true");
    await expect(setPriority).not.toHaveAttribute("aria-disabled", "true");
    // `queryTarget: { maxRows: 25 }` < 60 matching rows.
    await expect(reopen).toHaveAttribute("aria-disabled", "true");
    await expect(reopen).toHaveAttribute("aria-label", "Reopen, At most 25 rows");
    await expect(reopen.locator(".as-table-actions-menu-item-reason")).toHaveText(
      "At most 25 rows",
    );
    // No `queryTarget` at all.
    await expect(notify).toHaveAttribute("aria-disabled", "true");
    await expect(notify).toHaveAttribute(
      "aria-label",
      "Notify assignees, Not available for all matching rows — select rows individually",
    );

    // Activating a disabled item runs nothing and keeps the menu open.
    const wire = captureWire(page, { urlSubstring: "/actions/", method: "POST" });
    try {
      await notify.click({ force: true });
      await expect(page.locator(".as-table-actions-menu")).toBeVisible();
      await expect(page.locator(".as-confirm-dialog-content")).toHaveCount(0);
      expect(wire.records).toHaveLength(0);
    } finally {
      wire.dispose();
    }
    await page.keyboard.press("Escape");
  });

  test("keyboard: Tab reaches the banner button, Enter switches modes and keeps focus", async ({
    page,
  }) => {
    await gotoTable(page, "tasks");
    await headerCheckbox(page).click();
    // The banner sits above the table; the control before it in tab order is
    // the demo's selection strip ("Custom selection controls").
    await page.locator(".demo-custom-select").focus();
    await page.keyboard.press("Tab");
    const offer = page.locator("[data-select-all-matching]");
    await expect(offer).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.locator(BANNER)).toContainText("All 60 matching rows are selected.");
    const clear = page.locator("[data-clear-selection]");
    await expect(clear).toBeFocused();

    // "Clear selection" hands focus to the header select-all checkbox.
    await page.keyboard.press("Enter");
    await expect(page.locator(BANNER)).toHaveCount(0);
    await expectSelectedCount(page, 0);
    await expect(headerCheckbox(page)).toBeFocused();
  });
});

test.describe("Section 40.2 — Which query changes keep the selection", () => {
  test("sort and page changes keep the query selection; a search change drops it", async ({
    page,
  }) => {
    await gotoTable(page, "tasks");
    await selectAllMatching(page, 60);

    // Sort (column menu → Ascending): same rows, same selection.
    await page.locator(`${MAIN_TABLE} thead th[data-column-path="title"] .as-th-btn`).click();
    await page
      .locator(".as-column-menu-content .as-column-menu-item", { hasText: "Ascending" })
      .click();
    await expect(page).toHaveURL(/\$sort=title/u);
    await expect(page.locator(BANNER)).toContainText("All 60 matching rows are selected.");
    await expectSelectedCount(page, 60);

    // Page 2: its loaded rows render checked.
    await clickPaginationPage(page, 2);
    await expect(page.locator(BANNER)).toContainText("All 60 matching rows are selected.");
    await expect(mainTable(page).locator(`${ROWS}[aria-selected='false']`)).toHaveCount(0);

    // Search narrows the query → the selection is dropped.
    await page.locator(".as-page-search-input").fill("billing");
    await expect(page.locator(BANNER)).toHaveCount(0);
    await expectSelectedCount(page, 0);
  });

  test("a filter change drops the query selection", async ({ page }) => {
    await gotoTasksWith(page, "status=open");
    await selectAllMatching(page, 15);

    // Widen the Status pill to open + done: new query, no selection.
    await pickPillEnumValue(page, pillByLabel(page, "Status"), "done");
    await expect(page.locator(BANNER)).toHaveCount(0);
    await expectSelectedCount(page, 0);
  });
});

test.describe("Section 40.3 — Running a query-targeted action", () => {
  test("Archive on every open task: dry-run count → confirm → run with expectCount → refetch", async ({
    page,
  }) => {
    const open = await countRows(page, "tasks", "status=open");
    expect(open).toBe(15);
    await gotoTasksWith(page, "status=open");
    await selectAllMatching(page, open);

    const wire = captureWire(page, {
      urlSubstring: `${TASKS_API}/actions/archive`,
      method: "POST",
    });
    try {
      const items = await openToolbarMenu(page);
      await items.filter({ hasText: "Archive" }).click();

      const confirm = page.locator(".as-confirm-dialog-content");
      await expect(confirm).toContainText(`Run “Archive” on ${open} rows?`);
      expect(wire.records.map((r) => r.body)).toEqual([
        { query: { q: "status=open", dryRun: true } },
      ]);

      const refetch = page.waitForResponse(`**${TASKS_API}/pages**`);
      await confirm.locator(".as-confirm-dialog-confirm").click();
      await refetch;
      expect(wire.records[1]?.body).toEqual({ query: { q: "status=open", expectCount: open } });
    } finally {
      wire.dispose();
    }

    await findToast(page, `Archive: Archived ${open} tasks`);
    // Selection cleared; the refetched (still `status=open`) page is empty.
    await expect(page.locator(BANNER)).toHaveCount(0);
    await expectSelectedCount(page, 0);
    await expect(mainTable(page).locator(ROWS)).toHaveCount(0);
    expect(await countRows(page, "tasks", "status=open")).toBe(0);
  });

  test("skipped rows are reported in the toast (already archived)", async ({ page }) => {
    const high = await countRows(page, "tasks", "priority=high");
    const archivedHigh = await countRows(page, "tasks", "priority=high&status=archived");
    expect(archivedHigh).toBeGreaterThan(0);
    await gotoTasksWith(page, "priority=high");
    await selectAllMatching(page, high);

    const items = await openToolbarMenu(page);
    await items.filter({ hasText: "Archive" }).click();
    const confirm = page.locator(".as-confirm-dialog-content");
    await expect(confirm).toContainText(`Run “Archive” on ${high} rows?`);
    await confirm.locator(".as-confirm-dialog-confirm").click();

    const processed = high - archivedHigh;
    await findToast(
      page,
      `Archive: Archived ${processed} task${processed === 1 ? "" : "s"}, ${archivedHigh} skipped`,
    );
    expect(await countRows(page, "tasks", "priority=high&status=archived")).toBe(high);
  });

  test("Set priority (input form): the form title carries the count, input + query go out together", async ({
    page,
  }) => {
    const normal = await countRows(page, "tasks", "priority=normal");
    expect(normal).toBeGreaterThan(10); // more than one page → the banner offers
    await gotoTasksWith(page, "priority=normal");
    await selectAllMatching(page, normal);

    const wire = captureWire(page, {
      urlSubstring: `${TASKS_API}/actions/set-priority`,
      method: "POST",
    });
    try {
      const items = await openToolbarMenu(page);
      await items.filter({ hasText: "Set priority" }).click();
      const form = page.locator(".as-action-form-content");
      await expect(form).toBeVisible();
      await expect(form.locator(".as-action-form-title")).toHaveText(
        `Set priority · ${normal} rows`,
      );
      await form.locator("select[name='priority']").selectOption("low");
      await form.locator(".as-action-form-submit").click();
      await expect(form).toHaveCount(0);
      await findToast(page, `Set priority: Set ${normal} tasks to low`);
      expect(wire.records.map((r) => r.body)).toEqual([
        { query: { q: "priority=normal", dryRun: true } },
        { query: { q: "priority=normal", expectCount: normal }, input: { priority: "low" } },
      ]);
    } finally {
      wire.dispose();
    }
    expect(await countRows(page, "tasks", "priority=normal")).toBe(0);
  });

  test("TARGET_CHANGED: the set changes while the confirm is open → re-confirm with the new count", async ({
    page,
  }) => {
    const done = await countRows(page, "tasks", "status=done");
    await gotoTasksWith(page, "status=done");
    await selectAllMatching(page, done);

    const items = await openToolbarMenu(page);
    await items.filter({ hasText: "Archive" }).click();
    const confirm = page.locator(".as-confirm-dialog-content");
    await expect(confirm).toContainText(`Run “Archive” on ${done} rows?`);

    // Meanwhile someone archives one of the done tasks.
    const one = (await (
      await page.request.get(`${TASKS_API}/query?status=done&$limit=1&$select=id`)
    ).json()) as Array<{ id: number }>;
    const res = await page.request.post(`${TASKS_API}/actions/archive`, {
      data: { ids: [{ id: one[0]!.id }] },
    });
    expect(res.ok()).toBe(true);

    await confirm.locator(".as-confirm-dialog-confirm").click();
    const reprompt = page.locator(".as-confirm-dialog-content");
    await expect(reprompt).toContainText(
      `The rows matching the query changed. Run “Archive” on ${done - 1} rows?`,
    );
    await reprompt.locator(".as-confirm-dialog-confirm").click();
    await findToast(page, `Archive: Archived ${done - 1} tasks`);
    expect(await countRows(page, "tasks", "status=done")).toBe(0);
  });
});

test.describe("Section 40.4 — <AsWindowTable>", () => {
  // `/tasks-window` loads 15-row blocks, so the 60 tasks are only partly
  // cached. The header select-all acts on the CACHED rows; once they are all
  // picked, the banner offers every matching row.
  test("header select-all over the cached rows → banner → query mode → exclude", async ({
    page,
  }) => {
    await resetSeed();
    await gotoTable(page, "tasks-window", { apiPath: "tasks" });
    await expect(mainTable(page).locator(ROWS).first()).toBeVisible();

    await headerCheckbox(page).click();
    const banner = page.locator(BANNER);
    await expect(banner).toHaveAttribute("data-kind", "offer");
    await expect(banner).toContainText(/All \d+ rows loaded are selected\./u);
    await banner.locator("[data-select-all-matching]").click();
    await expect(banner).toContainText("All 60 matching rows are selected.");
    await expectSelectedCount(page, 60);
    await expect(headerCheckbox(page)).toHaveAttribute("aria-checked", "true");

    await rowCheckbox(page, 0).click();
    await expectSelectedCount(page, 59);
    await expect(banner).toContainText("All 59 matching rows are selected.");
    await expect(headerCheckbox(page)).toHaveAttribute("aria-checked", "mixed");
    await expect(mainTable(page).locator(ROWS).nth(1)).toHaveAttribute("aria-selected", "true");

    // Same toolbar gating as <AsTable>.
    const items = await openToolbarMenu(page);
    await expect(items.filter({ hasText: "Reopen" })).toHaveAttribute(
      "aria-label",
      "Reopen, At most 25 rows",
    );
    await expect(items.filter({ hasText: "Notify assignees" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.keyboard.press("Escape");

    await banner.locator("[data-clear-selection]").click();
    await expect(banner).toHaveCount(0);
    await expectSelectedCount(page, 0);
  });

  test("Archive on all matching from the window table", async ({ page }) => {
    const inProgress = await countRows(page, "tasks", "status='in-progress'");
    expect(inProgress).toBeGreaterThan(0);
    const pages = page.waitForResponse(`**${TASKS_API}/pages**`);
    await page.goto("/tasks-window?status='in-progress'");
    await pages;
    await expect(mainTable(page).locator(ROWS).first()).toBeVisible();

    // 15 in-progress rows fit one 15-row block → everything is cached, so
    // there is nothing more to offer: header select-all, no banner.
    await headerCheckbox(page).click();
    await expectSelectedCount(page, inProgress);
    await expect(page.locator(BANNER)).toHaveCount(0);

    // Plain id selection still runs the action (ids, not a query).
    const wire = captureWire(page, {
      urlSubstring: `${TASKS_API}/actions/archive`,
      method: "POST",
    });
    try {
      const items = await openToolbarMenu(page);
      await items.filter({ hasText: "Archive" }).click();
      await findToast(page, `Archived ${inProgress} tasks`);
      expect(wire.records).toHaveLength(1);
      expect((wire.records[0]!.body as { ids: unknown[] }).ids).toHaveLength(inProgress);
    } finally {
      wire.dispose();
    }
    expect(await countRows(page, "tasks", "status='in-progress'")).toBe(0);
  });
});
