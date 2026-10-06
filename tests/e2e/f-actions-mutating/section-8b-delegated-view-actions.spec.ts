// Section 8b — Actions on a view, delegated with `@DbActionsFrom`
// (atscript-db 0.1.147).
//
// Demo surface: `/task-board` — `<AsTable select="multi">` over the
// `task_board` view (tasks ⋈ users), which exposes the task id as `taskId`.
// `TaskBoardController` (`packages/vue-demo/src/server/controllers/
// task-board.controller.ts`) declares `@DbActionsFrom(() => TasksController)`:
// `/meta.actions` lists the tasks actions with `owner: /api/db/tables/tasks`,
// `idMap: { id: "taskId" }`, `formUrl` (the source's form) and — for
// `queryTarget` actions — `queryTarget.url` on the VIEW
// (`/api/db/tables/task-board/delegated-actions/<name>`).
//
// The client runs id-based actions on the source route with the ids mapped
// through `idMap` (`{ taskId: 2 }` → `{ id: 2 }`), and "all matching" on the
// view's `queryTarget.url`.
//
// Seed (`seedTasks`): status cycle open, in-progress, done, open, done,
// in-progress, done, archived, open, done, in-progress, archived — task 1
// open, 2 in-progress, 3 done, 4 open, 8 archived. `estimate` = (i % 8) + 1,
// `spent` = (i * 3) % 7 — the board's computed `remaining` = estimate - spent.
// Mutating file: `resetSeed()` in `beforeAll`, serial.
//
// The actions stay `TasksController`'s, ARBAC-authorized there (`tasks`
// resource, `update`): admin (the default session) and manager run them, the
// viewer reads the board without any of them (8b.7).

import { type Locator, type Page, expect, test } from "../fixtures";

import {
  countRows,
  captureWire,
  clickColumnHeader,
  clickRowMenuItem,
  columnCellIndex,
  findToast,
  gotoTable,
  newRequestContext,
  openRowActionsMenu,
  pickSort,
  resetSeed,
  rowByCellText,
  sortIndicator,
} from "../helpers";

const MAIN_TABLE = "table[data-as-main-table]";
const BOARD_API = "/api/db/tables/task-board";
const TASKS_API = "/api/db/tables/tasks";

function mainTable(page: Page): Locator {
  return page.locator(MAIN_TABLE);
}

async function boardRow(page: Page, taskId: number): Promise<Locator> {
  const table = mainTable(page);
  const idx = await columnCellIndex(table, "taskId");
  const row = rowByCellText(table, idx, String(taskId)).first();
  await expect(row).toHaveCount(1);
  return row;
}

async function cellText(page: Page, row: Locator, path: string): Promise<string> {
  const idx = await columnCellIndex(mainTable(page), path);
  return ((await row.locator("td").nth(idx).textContent()) ?? "").trim();
}

async function task(page: Page, id: number): Promise<{ status: string; priority: string }> {
  const res = await page.request.get(`${TASKS_API}/one/${id}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as { status: string; priority: string };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await resetSeed();
});

test.describe("Section 8b — Delegated view actions on /task-board", () => {
  test("8b.1 /meta lists the source's actions with owner, idMap, formUrl and queryTarget.url", async ({
    page,
  }) => {
    const res = await page.request.get(`${BOARD_API}/meta`);
    expect(res.ok()).toBe(true);
    const meta = (await res.json()) as {
      actions: Array<{
        name: string;
        level: string;
        value: string;
        owner?: string;
        idMap?: Record<string, string>;
        formUrl?: string;
        queryTarget?: { maxRows: number; url?: string };
      }>;
    };
    const byName = Object.fromEntries(meta.actions.map((a) => [a.name, a]));
    expect(Object.keys(byName)).toEqual(["start", "archive", "set-priority", "reopen", "notify"]);
    for (const a of meta.actions) {
      expect(a.owner).toBe(TASKS_API);
      expect(a.idMap).toEqual({ id: "taskId" });
      expect(a.value).toBe(`${TASKS_API}/actions/${a.name}`);
    }
    expect(byName.archive!.queryTarget).toEqual({
      maxRows: 500,
      url: `${BOARD_API}/delegated-actions/archive`,
    });
    expect(byName.reopen!.queryTarget).toEqual({
      maxRows: 25,
      url: `${BOARD_API}/delegated-actions/reopen`,
    });
    expect(byName.notify!.queryTarget).toBeUndefined();
    expect(byName["set-priority"]!.formUrl).toBe(`${TASKS_API}/meta/form/SetPriorityInput`);
  });

  test("8b.2 row menu honours each row's delegated $actions", async ({ page }) => {
    await gotoTable(page, "task-board");

    // Badges show the `@ui.literalLabel` of tasks.status. Task 8 is archived: Archive / Start / Reopen disabled with the source's reasons.
    const archived = await boardRow(page, 8);
    await expect(archived.locator(".as-status-badge")).toHaveText("Archived");
    let menu = await openRowActionsMenu(page, archived);
    const item = (label: string) =>
      menu.locator(".as-row-actions-menu-item").filter({ hasText: label });
    await expect(item("Archive")).toHaveAttribute("aria-disabled", "true");
    await expect(item("Archive")).toHaveAttribute("aria-label", "Archive, Already archived");
    await expect(item("Start")).toHaveAttribute(
      "aria-label",
      "Start, Only open tasks can be started",
    );
    await expect(item("Reopen")).toHaveAttribute(
      "aria-label",
      "Reopen, Only done tasks can be reopened",
    );
    await expect(item("Set priority")).not.toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // Task 3 is done: Reopen enabled, Start disabled.
    menu = await openRowActionsMenu(page, await boardRow(page, 3));
    await expect(item("Reopen")).not.toHaveAttribute("aria-disabled", "true");
    await expect(item("Archive")).not.toHaveAttribute("aria-disabled", "true");
    await expect(item("Start")).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");
  });

  test("8b.3 a delegated row action runs on the source route with the id mapped", async ({
    page,
  }) => {
    await gotoTable(page, "task-board");
    const wire = captureWire(page, { urlSubstring: "/actions/", method: "POST" });
    try {
      const menu = await openRowActionsMenu(page, await boardRow(page, 1));
      const refetch = page.waitForResponse(`**${BOARD_API}/pages**`);
      await clickRowMenuItem(menu, "Start");
      await refetch;
      expect(wire.records).toHaveLength(1);
      expect(wire.records[0]!.url).toContain(`${TASKS_API}/actions/start`);
      expect(JSON.stringify(wire.records[0]!.body)).not.toContain("taskId");
      expect(JSON.stringify(wire.records[0]!.body)).toContain('"id":1');
    } finally {
      wire.dispose();
    }
    await findToast(page, "Task 1 started");
    expect((await task(page, 1)).status).toBe("in-progress");
    await expect((await boardRow(page, 1)).locator(".as-status-badge")).toHaveText("In progress");
  });

  test("8b.4 toolbar bulk run on two selected rows changes the source tasks", async ({ page }) => {
    await gotoTable(page, "task-board");
    for (const id of [2, 4]) {
      await (await boardRow(page, id)).locator(".as-td-select .as-table-checkbox").click();
    }
    await expect(page.locator(".as-page-selection-count")).toHaveText("2 selected");

    const wire = captureWire(page, { urlSubstring: "/actions/", method: "POST" });
    try {
      await page.locator(".as-table-actions-more").click();
      await page
        .locator(".as-table-actions-menu .as-table-actions-menu-item")
        .filter({ hasText: "Archive" })
        .click();
      await findToast(page, "Archived 2 tasks");
      expect(wire.records).toHaveLength(1);
      expect(wire.records[0]!.url).toContain(`${TASKS_API}/actions/archive`);
      expect(wire.records[0]!.body).toEqual({ ids: [{ id: 2 }, { id: 4 }] });
    } finally {
      wire.dispose();
    }
    expect((await task(page, 2)).status).toBe("archived");
    expect((await task(page, 4)).status).toBe("archived");
    await expect((await boardRow(page, 2)).locator(".as-status-badge")).toHaveText("Archived");
  });

  test("8b.5 Set priority opens the source's form (formUrl) and submits through the source", async ({
    page,
  }) => {
    await gotoTable(page, "task-board");
    const form = page.waitForResponse(`**${TASKS_API}/meta/form/SetPriorityInput`);
    const menu = await openRowActionsMenu(page, await boardRow(page, 3));
    await clickRowMenuItem(menu, "Set priority");
    expect((await form).ok()).toBe(true);

    const dialog = page.locator(".as-action-form-content");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("select[name='priority']")).toBeVisible();

    const wire = captureWire(page, { urlSubstring: "/actions/", method: "POST" });
    try {
      await dialog.locator("select[name='priority']").selectOption("high");
      await dialog.locator(".as-action-form-submit").click();
      await expect(dialog).toHaveCount(0);
      await findToast(page, "Set 1 task to high");
      expect(wire.records).toHaveLength(1);
      expect(wire.records[0]!.url).toContain(`${TASKS_API}/actions/set-priority`);
      expect(wire.records[0]!.body).toEqual({ ids: [{ id: 3 }], input: { priority: "high" } });
    } finally {
      wire.dispose();
    }
    expect((await task(page, 3)).priority).toBe("high");
    expect(await cellText(page, await boardRow(page, 3), "priority")).toBe("high");
  });

  test("8b.6 select all matching + Archive runs through the view's queryTarget.url", async ({
    page,
  }) => {
    const open = await countRows(page, "tasks", "status=open");
    expect(open).toBeGreaterThan(10); // more than one page → the banner offers
    const pages = page.waitForResponse(`**${BOARD_API}/pages**`);
    await page.goto("/task-board?status=open");
    await pages;
    await expect(mainTable(page).locator("tbody tr:has(td)").first()).toBeVisible();

    await mainTable(page).locator("thead th.as-th-select [role='checkbox']").click();
    await page.locator("[data-select-all-matching]").click();
    await expect(page.locator(".as-selection-banner")).toContainText(
      `All ${open} matching rows are selected.`,
    );

    const wire = captureWire(page, { urlSubstring: "/api/db/tables/", method: "POST" });
    try {
      await page.locator(".as-table-actions-more").click();
      await page
        .locator(".as-table-actions-menu .as-table-actions-menu-item")
        .filter({ hasText: "Archive" })
        .click();
      const confirm = page.locator(".as-confirm-dialog-content");
      await expect(confirm).toContainText(`Run “Archive” on ${open} rows?`);
      await confirm.locator(".as-confirm-dialog-confirm").click();
      await findToast(page, `Archive: Archived ${open} tasks`);

      expect(wire.records.map((r) => r.url.replace(/^https?:\/\/[^/]+/u, ""))).toEqual([
        `${BOARD_API}/delegated-actions/archive`,
        `${BOARD_API}/delegated-actions/archive`,
      ]);
      expect(wire.records.map((r) => r.body)).toEqual([
        { query: { q: "status=open", dryRun: true } },
        { query: { q: "status=open", expectCount: open } },
      ]);
    } finally {
      wire.dispose();
    }
    expect(await countRows(page, "tasks", "status=open")).toBe(0);
    await expect(mainTable(page).locator("tbody tr:has(td)")).toHaveCount(0);
  });

  test("8b.7 the source's ARBAC decides: manager may run the actions, viewer may not", async () => {
    const actionNames = async (role: "manager" | "viewer") => {
      const ctx = await newRequestContext(role);
      try {
        const res = await ctx.get(`${BOARD_API}/meta`);
        expect(res.ok()).toBe(true);
        return ((await res.json()) as { actions: { name: string }[] }).actions.map((a) => a.name);
      } finally {
        await ctx.dispose();
      }
    };
    expect(await actionNames("manager")).toEqual([
      "start",
      "archive",
      "set-priority",
      "reopen",
      "notify",
    ]);
    expect(await actionNames("viewer")).toEqual([]);

    // Calling them anyway is refused by the source — on its own route and
    // through the view's delegated query route alike; nothing changes.
    const viewer = await newRequestContext("viewer");
    try {
      const before = await viewer.get(`${TASKS_API}/one/9`);
      const status = ((await before.json()) as { status: string }).status;
      const direct = await viewer.post(`${TASKS_API}/actions/archive`, {
        data: { ids: [{ id: 9 }] },
      });
      expect(direct.status()).toBe(403);
      const delegated = await viewer.post(`${BOARD_API}/delegated-actions/archive`, {
        data: { query: { q: "taskId=9" } },
      });
      expect(delegated.status()).toBe(403);
      const after = await viewer.get(`${TASKS_API}/one/9`);
      expect(((await after.json()) as { status: string }).status).toBe(status);
    } finally {
      await viewer.dispose();
    }
  });

  test("8b.8 computed `remaining` is an ordinary read-only column: /meta, sort, filter", async ({
    page,
  }) => {
    const res = await page.request.get(`${BOARD_API}/meta`);
    const meta = (await res.json()) as {
      fields: Record<string, { sortable: boolean; filterable: boolean; computed?: boolean }>;
      crud: Record<string, unknown>;
    };
    expect(meta.fields.remaining).toMatchObject({
      sortable: true,
      filterable: true,
      computed: true,
    });
    expect(meta.fields.estimate!.computed).toBeUndefined();
    expect(Object.keys(meta.crud)).not.toContain("update");

    // A server-side filter on it (deep link) — over-budget tasks only.
    const over = await page.request.get(`${BOARD_API}/pages?remaining<0&$size=100`);
    const overRows = ((await over.json()) as { data: { remaining: number }[] }).data;
    expect(overRows.length).toBeGreaterThan(0);
    for (const r of overRows) expect(r.remaining).toBeLessThan(0);

    const pages = page.waitForResponse(`**${BOARD_API}/pages**`);
    await page.goto("/task-board?remaining<0");
    await pages;
    const table = mainTable(page);
    await expect(table.locator("tbody tr:has(td)")).toHaveCount(Math.min(overRows.length, 10));

    // Sorting by it goes to the server like any column.
    await gotoTable(page, "task-board");
    const sorted = page.waitForRequest(
      (r) =>
        r.url().includes(`${BOARD_API}/pages`) && decodeURIComponent(r.url()).includes("remaining"),
    );
    await clickColumnHeader(page, "remaining");
    await pickSort(page, "desc");
    expect(decodeURIComponent((await sorted).url())).toContain("$sort=-remaining");
    await expect(sortIndicator(page, "remaining", "desc")).toHaveCount(1);
    const idx = await columnCellIndex(table, "remaining");
    await expect(table.locator("tbody tr:has(td)").first()).toBeVisible();
    const values = (await table.locator(`tbody tr td:nth-child(${idx + 1})`).allTextContents()).map(
      (t) => Number(t.trim()),
    );
    expect(values).toEqual(values.toSorted((a, b) => b - a));
  });
});
