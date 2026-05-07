// Section 11 — Presets (batch H, scenarios 11.1–11.9).
//
// **Single-file batch.** Playwright's default worker count parallelises
// across spec files, and our `_presets` table writes share a single
// SQLite connection — concurrent `resetSeed()` calls hit the demo's
// transaction reset endpoint and race ("cannot start a transaction
// within a transaction"). Splitting Section 11 across 5 files (the
// suggested layout) caused that race in routine `pnpm run test:e2e`
// runs on multi-core dev machines (default workers = N/2 cores).
//
// Forcing serialization across files would require either (a) a
// playwright.config.ts edit to pin `workers: 1` (locked file) or (b)
// `--workers=1` at the run command (not the canonical invocation).
// Collapsing to ONE file pins the entire batch to ONE worker → one
// resetSeed call → no race. This mirrors batch F's solution to its
// own cross-file mutation race.
//
// resetSeed is called once in the file-scope `beforeAll` and ALL tests
// run in `serial` mode so the preset rows accumulated by earlier tests
// survive into later assertions (e.g. setup → list assertions).
//
// Mutation chain across the suite (admin `page` only — fresh contexts
// in 11.4 / 11.8 / 11.9.B / 11.9.C are isolated):
//   11.2  +Open shipments         → +1 my preset on /orders
//   11.3.3 toggle public on it    → still 1 my preset
//   11.3.4 delete it              → 0 my presets
//   11.5   +Active filter, +Active full, +Compact view on /users → 3
//   11.7   +My A, +My B, +My C on /orders                        → 3
//   11.7.5+9  rename My B → My B v2, public My C, delete My A    → 2
//   11.7.10  cancel discards pending edits                       → 2
//   11.9.A  popover Make-public visible (admin)                  → 2
//
// Wire-shape findings:
//   - Preset CRUD endpoint: `/api/db/_presets/`
//     - List   GET   /api/db/_presets/query?filter=...
//     - Insert POST  /api/db/_presets/        body: { type:"preset",
//                                                    app, tableKey,
//                                                    public, data:{label, content} }
//     - Update PATCH /api/db/_presets/        body: { id, ...partial }
//     - Delete DELETE /api/db/_presets/<id>
//     - Caps   GET   /api/db/_presets/capabilities?app=vuedemo&tableKey=<slug>
//   - `data.content` snapshot is in WIRE form (entries-arrays, not dicts):
//       columnWidths → [{field, width}], filterOps → [{field, conditions}].
//   - userConf upsert wire body: { id?, type:"userConf", app, tableKey,
//                                  data:{ defaultPresetId? | favPresetIds? } }.
//   - Manage-dialog Save batch fires per-mutation HTTPs in order:
//       setFavorites → setDefault → renames → publicToggles → deletes
//   - Apply-preset is purely client-side state — no /api/db/_presets PATCH
//     fires when clicking a picker row. The /pages refetch comes from the
//     state-watcher reacting to the snapshot mutation.
//
// Wire-shape note (11.8): `forceFilters` AND user-side preset filters are
// merged in `buildTableQuery` (`mergeFilters`). Same-field collisions go
// out as `?status=cancelled&!(!(status=shipped))` — the `$not($not(...))`
// wrap defeats `@uniqu/url`'s `mergeConjunction` collapse so both clauses
// reach the server.

import { type Locator, type Page, expect, test } from "../fixtures";

import {
  addFilterPill,
  applyPickerItem,
  authFileFor,
  capturePresetWire,
  clickColumnHeader,
  dialogRow,
  expectSinglePages,
  gotoTable,
  newRequestContext,
  openManageDialog,
  openPresetPicker,
  openSaveAsPopover,
  pickSort,
  pillByLabel,
  resetSeed,
  sortIndicator,
  texts,
} from "../helpers";

// ---------------------------------------------------------------------
// Inline helpers — chat-RFC required to promote.

const PICKER_TRIGGER = ".as-preset-picker-trigger";
const PICKER_TRIGGER_LABEL = ".as-preset-picker-trigger-label";
const PICKER_ITEM = ".as-preset-picker-item";
const POPOVER_NAME_INPUT = ".as-preset-picker-popover-input";
const POPOVER_SAVE_BTN = ".as-preset-picker-popover-save";
const POPOVER_ASPECT = ".as-preset-picker-popover-aspect";

const DIALOG_FOOTER_SAVE = ".as-preset-dialog-footer-save";
const DIALOG_FOOTER_CLOSE = ".as-preset-dialog-footer-close";
const DIALOG_SEARCH_INPUT = ".as-preset-dialog-search-input";
const DIALOG_COUNTER = ".as-preset-dialog-counter";
const DIALOG_SECTION_HEADER = ".as-preset-dialog-section-header";
const DIALOG_FOOTER_UNSAVED = ".as-preset-dialog-footer-unsaved";

async function fillAndSaveAs(popover: Locator, page: Page, label: string): Promise<void> {
  await popover.locator(POPOVER_NAME_INPUT).fill(label);
  const post = page.waitForRequest(
    (r) => r.url().includes("/api/db/_presets") && r.method() === "POST",
  );
  await popover.locator(POPOVER_SAVE_BTN).click();
  await post;
  await expect(popover).toHaveCount(0);
}

async function applyStatusPill(page: Page, value: string, table: string): Promise<void> {
  const pill = pillByLabel(page, "Status");
  await expect(pill).toHaveCount(1);
  await pill.locator(".as-filter-field-search").click();
  const dropdown = page.locator(".as-filter-field-dropdown");
  await expect(dropdown).toBeVisible();
  await dropdown
    .locator("tbody tr td", { hasText: new RegExp(`^${value}$`) })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await expect(dropdown).toHaveCount(0);
  await page.waitForResponse(
    (r) =>
      r.url().includes(`/api/db/tables/${table}/pages`) &&
      r.request().method() === "GET" &&
      r.status() === 200,
  );
}

async function setAspectMask(popover: Locator, mask: Record<string, boolean>): Promise<void> {
  for (const [aspect, want] of Object.entries(mask)) {
    const row = popover.locator(POPOVER_ASPECT).filter({ hasText: aspect });
    await expect(row).toHaveCount(1);
    const cb = row.locator("input[type='checkbox']");
    const isChecked = await cb.isChecked();
    if (isChecked !== want) await cb.click();
  }
}

async function waitForPagesGet(page: Page, table: string): Promise<void> {
  await page.waitForResponse(
    (r) =>
      r.url().includes(`/api/db/tables/${table}/pages`) &&
      r.request().method() === "GET" &&
      r.status() === 200,
  );
}

// Sorted top-level keys of a captured POST/PATCH body's `data.content` blob.
function contentKeys(body: unknown): string[] {
  const c = (body as { data?: { content?: Record<string, unknown> } } | undefined)?.data?.content;
  return Object.keys(c ?? {}).toSorted();
}

// Counts of `[data-on=""]` markers on a manager-dialog row's default + public
// toggles. Used by 11.7.10 to baseline-then-revert-then-assert the Cancel
// button discarding pending edits.
async function snapshotRowToggles(row: Locator): Promise<{ default: number; public: number }> {
  return {
    default: await row.locator(".as-preset-dialog-row-default[data-on='']").count(),
    public: await row.locator(".as-preset-dialog-row-public-toggle[data-on='']").count(),
  };
}

// ---------------------------------------------------------------------
// All tests run in a single serial describe so they share a single
// worker (one resetSeed, no parallel races on the _presets table).

test.describe.configure({ mode: "serial" });

test.describe("Section 11 — Presets (single-file batch)", () => {
  test.beforeAll(async () => {
    await resetSeed();
  });

  // Persist one page across tests so admin's preset rows survive across
  // the full sub-section walk (within each subsection group) and we
  // don't pay the cost of N independent page contexts.
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ storageState: authFileFor("admin") });
  });

  test.afterAll(async () => {
    await page?.close();
  });

  // -------------------------------------------------------------------
  // 11.1 — Standard preset on first load

  test("11.1 — Standard preset is active on first load; trigger reads `Standard`", async () => {
    await gotoTable(page, "orders");

    const trigger = page.locator(PICKER_TRIGGER);
    await expect(trigger).toBeVisible();
    await expect(trigger.locator(PICKER_TRIGGER_LABEL)).toHaveText("Standard");
    await expect(trigger.locator(".as-preset-picker-trigger-dirty")).toHaveCount(0);

    const menu = await openPresetPicker(page);
    const items = menu.locator(PICKER_ITEM);
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveAttribute("data-active", "");
    await expect(items.first().locator(".as-preset-picker-item-label")).toHaveText("Standard");

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });

  // -------------------------------------------------------------------
  // 11.2 — Save as `Open shipments` (basic)

  test("11.2 — Save as `Open shipments` from /orders with filter+sort POSTs to /api/db/_presets/", async () => {
    const statusPill = pillByLabel(page, "Status");
    await expect(statusPill).toHaveCount(1);

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

    await expectSinglePages(
      page,
      async () => {
        await clickColumnHeader(page, "total");
        await pickSort(page, "desc");
      },
      { table: "orders" },
    );

    await expect(page.locator(".as-preset-picker-trigger-dirty")).toBeVisible();

    const menu = await openPresetPicker(page);
    const wire = capturePresetWire(page);
    const popover = await openSaveAsPopover(page, menu);

    // Default aspect checkboxes — for a fresh non-standard save, ALL
    // available aspects should be ticked (system presets claim every
    // aspect, so the mask defaults to all-on).
    const aspectChecks = popover.locator(`${POPOVER_ASPECT} input[type="checkbox"]`);
    const aspectCount = await aspectChecks.count();
    expect(aspectCount).toBeGreaterThan(0);
    for (let i = 0; i < aspectCount; i++) {
      await expect(aspectChecks.nth(i)).toBeChecked();
    }
    await expect(
      popover.locator(".as-preset-picker-popover-public input[type='checkbox']"),
    ).not.toBeChecked();

    await fillAndSaveAs(popover, page, "Open shipments");

    const insert = wire.records.find((r) => r.method === "POST")!;
    const body = insert.body as {
      type?: string;
      app?: string;
      tableKey?: string;
      public?: boolean;
      data?: { label?: string; content?: Record<string, unknown> };
    };
    expect(body.type).toBe("preset");
    expect(body.app).toBe("vuedemo");
    expect(body.tableKey).toBe("orders");
    expect(body.public).toBe(false);
    expect(body.data?.label).toBe("Open shipments");
    const keys = contentKeys(body);
    expect(keys).toContain("columns");
    expect(keys).toContain("filters");
    expect(keys).toContain("filterOps");
    expect(keys).toContain("sorters");

    const filterOps = body.data?.content?.filterOps as
      | Array<{ field?: string; conditions?: Array<{ type?: string; value?: unknown[] }> }>
      | undefined;
    expect(Array.isArray(filterOps)).toBe(true);
    const statusOp = filterOps?.find((e) => e.field === "status");
    expect(statusOp?.conditions?.[0]?.type).toBe("eq");
    expect(statusOp?.conditions?.[0]?.value).toEqual(["shipped"]);

    expect(body.data?.content?.sorters).toEqual([{ field: "total", direction: "desc" }]);

    const menu2 = await openPresetPicker(page);
    const items = menu2.locator(PICKER_ITEM);
    await expect(items).toHaveCount(2);
    const labels = await texts(items.locator(".as-preset-picker-item-label"));
    expect(labels).toContain("Standard");
    expect(labels).toContain("Open shipments");
    await expect(items.filter({ hasText: "Open shipments" })).toHaveAttribute("data-active", "");
    await page.keyboard.press("Escape");
    await expect(page.locator(PICKER_TRIGGER_LABEL)).toHaveText("Open shipments");
    await expect(page.locator(".as-preset-picker-trigger-dirty")).toHaveCount(0);
  });

  // -------------------------------------------------------------------
  // 11.3.1 — Apply: Standard → Open shipments restores filter+sort.

  test("11.3.1 — switching Standard → Open shipments restores filter+sort with one /pages refetch; no /api/db/_presets PATCH", async () => {
    await applyPickerItem(page, "Standard", { table: "orders" });
    await expect(page.locator(PICKER_TRIGGER_LABEL)).toHaveText("Standard");

    // Capture wire to confirm NO preset-controller mutation fires (apply
    // is purely client-side state).
    const wire = capturePresetWire(page);
    await applyPickerItem(page, "Open shipments", { table: "orders" });
    await expect(page.locator(PICKER_TRIGGER_LABEL)).toHaveText("Open shipments");

    await expect(pillByLabel(page, "Status").locator(".as-filter-field-chip")).toHaveCount(1);
    await expect(sortIndicator(page, "total", "desc")).toHaveCount(1);

    expect(wire.records.filter((r) => r.method !== "GET")).toEqual([]);
  });

  // -------------------------------------------------------------------
  // 11.3.3 — Manage dialog public-toggle.

  test("11.3.3 — Manage dialog toggle-public on owned row PATCHes {id, public:true}", async () => {
    const menu = await openPresetPicker(page);
    const dialog = await openManageDialog(page, menu);

    const row = dialogRow(dialog, "Open shipments");
    await expect(row).toHaveCount(1);
    const publicBtn = row.locator(".as-preset-dialog-row-public-toggle");
    await expect(publicBtn).toBeVisible();
    await expect(publicBtn).not.toHaveAttribute("data-on", "");
    await publicBtn.click();
    await expect(publicBtn).toHaveAttribute("data-on", "");

    const wire = capturePresetWire(page);
    const patchReq = page.waitForRequest(
      (r) => r.url().includes("/api/db/_presets") && r.method() === "PATCH",
    );
    await dialog.locator(DIALOG_FOOTER_SAVE).click();
    await patchReq;
    await expect(dialog).toHaveCount(0);

    const patchBody = wire.records.find((r) => r.method === "PATCH")!.body as {
      id?: string;
      public?: boolean;
    };
    expect(typeof patchBody.id).toBe("string");
    expect(patchBody.public).toBe(true);

    const menu2 = await openPresetPicker(page);
    const dialog2 = await openManageDialog(page, menu2);
    await expect(
      dialogRow(dialog2, "Open shipments").locator(".as-preset-dialog-row-public-toggle"),
    ).toHaveAttribute("data-on", "");
    await dialog2.locator(DIALOG_FOOTER_CLOSE).click();
    await expect(dialog2).toHaveCount(0);
  });

  // -------------------------------------------------------------------
  // 11.3.4 — Manage dialog mark-for-delete + Save.

  test("11.3.4 — Manage dialog mark-for-delete + Save fires DELETE; preset removed from picker", async () => {
    const menu = await openPresetPicker(page);
    const dialog = await openManageDialog(page, menu);

    const row = dialogRow(dialog, "Open shipments");
    await row.locator(".as-preset-dialog-row-delete").click();
    await expect(row).toHaveAttribute("data-deleted", "");

    const wire = capturePresetWire(page);
    const deleteReq = page.waitForRequest(
      (r) => r.url().includes("/api/db/_presets") && r.method() === "DELETE",
    );
    await dialog.locator(DIALOG_FOOTER_SAVE).click();
    await deleteReq;
    await expect(dialog).toHaveCount(0);

    expect(wire.records.find((r) => r.method === "DELETE")!.url).toMatch(
      /\/api\/db\/_presets\/[\w-]+/u,
    );

    await expect(page.locator(PICKER_TRIGGER_LABEL)).toHaveText("Standard");
    const menu2 = await openPresetPicker(page);
    await expect(menu2.locator(PICKER_ITEM)).toHaveCount(1);
    await page.keyboard.press("Escape");
  });

  // -------------------------------------------------------------------
  // 11.4 — Deep-link with default-pinned preset.
  // Uses fresh contexts to avoid polluting the shared `page` state.

  test("11.4 — saved preset baseline + URL deep-link load (single composed fetch, URL wins on field conflict)", async ({
    browser,
  }) => {
    // Setup: in a temp context, save a preset and pin it as default.
    const setupCtx = await browser.newContext({ storageState: authFileFor("admin") });
    try {
      const setupPage = await setupCtx.newPage();
      await gotoTable(setupPage, "orders");
      await applyStatusPill(setupPage, "pending", "orders");

      const menu = await openPresetPicker(setupPage);
      const popover = await openSaveAsPopover(setupPage, menu);
      await fillAndSaveAs(popover, setupPage, "Pending only");

      const menu2 = await openPresetPicker(setupPage);
      const dialog = await openManageDialog(setupPage, menu2);
      await dialogRow(dialog, "Pending only").locator(".as-preset-dialog-row-default").click();
      const upsert = setupPage.waitForRequest(
        (r) =>
          r.url().includes("/api/db/_presets") && (r.method() === "POST" || r.method() === "PATCH"),
      );
      await dialog.locator(DIALOG_FOOTER_SAVE).click();
      await upsert;
      await expect(dialog).toHaveCount(0);

      await setupPage.close();
    } finally {
      await setupCtx.close();
    }

    // Fresh context: deep-link to /orders?status='shipped' and observe.
    const fresh = await browser.newContext({ storageState: authFileFor("admin") });
    try {
      const dlPage = await fresh.newPage();
      // Use `expectSinglePages` so 11.4 and 11.8 share the same
      // assertion shape post-Phase-1 alignment — a deep-link arrival
      // and a preset-apply gesture both fire SINGLE composed `/pages`,
      // and a future double-fire regression (e.g. URL bridge echo or
      // preset-baseline gate flapping) would surface in either spec
      // identically. The wrapped gesture is the navigation + initial
      // paint settle; the 700 ms quiet-window past the LAST matching
      // request replaces the previous fixed `waitForTimeout(700)`.
      const captured = await expectSinglePages(
        dlPage,
        async () => {
          await dlPage.goto("/orders?status='shipped'");
          await expect(dlPage.getByText("Loading…", { exact: true })).toHaveCount(0);
        },
        { table: "orders" },
      );

      // Single composed `/pages` fetch on first paint; URL's `status=shipped`
      // wins over preset's `status=pending` at the field level. Preset stays
      // "active" (label, dirty glyph) — only the colliding field is overlaid.
      const decoded = decodeURIComponent(captured.url);
      expect(decoded).toContain("status=shipped");
      expect(decoded).not.toContain("status=pending");
      await expect(dlPage.locator(PICKER_TRIGGER_LABEL)).toHaveText("Pending only");
    } finally {
      await fresh.close();
    }

    // Cleanup: delete `Pending only` so subsequent tests aren't polluted by it
    // (manage-dialog assertions count rows). setDefault→null is implicit in
    // the row-delete batch via the dangling-id sanitiser on the server, so we
    // don't need to unpin explicitly.
    //
    // Hardened (Phase-2 batch H follow-up): the cleanup MUST find the
    // `Pending only` row — the setup block above asserts the POST fired
    // (via `fillAndSaveAs`'s `waitForRequest`) and the default-pin Save
    // upserted the userConf. If the row is missing, the deep-link assertions
    // earlier in the test fired against an empty preset list, which means
    // either (a) the setup itself silently failed, or (b) a prior test
    // leaked a `Pending only` deletion onto the shared admin-presets table.
    // Either way we want to fail-loud here, not silently leave a stray
    // default-pinned row for downstream tests.
    await page.bringToFront();
    await gotoTable(page, "orders");
    const menuC = await openPresetPicker(page);
    const dialogC = await openManageDialog(page, menuC);
    const rowC = dialogRow(dialogC, "Pending only");
    await expect(
      rowC,
      "11.4 cleanup: `Pending only` preset must exist after the deep-link setup ran — " +
        "if this fails, the setup phase silently regressed and prior assertions are meaningless",
    ).toHaveCount(1);
    await rowC.locator(".as-preset-dialog-row-delete").click();
    const deleteR = page.waitForRequest(
      (r) => r.url().includes("/api/db/_presets") && r.method() === "DELETE",
    );
    await dialogC.locator(DIALOG_FOOTER_SAVE).click();
    await deleteR;
    await expect(dialogC).toHaveCount(0);

    // Post-cleanup verification: re-open the manage dialog and confirm the
    // row is actually gone (not just "the DELETE fired" — the picker could
    // still echo a stale row from a server cache).
    const menuV = await openPresetPicker(page);
    const dialogV = await openManageDialog(page, menuV);
    await expect(dialogRow(dialogV, "Pending only")).toHaveCount(0);
    await dialogV.locator(DIALOG_FOOTER_CLOSE).click();
    await expect(dialogV).toHaveCount(0);
  });

  // -------------------------------------------------------------------
  // 11.5 — Save 3x with different aspect masks (on /users).

  test("11.5 — save 3x with different masks (filter-only / all / columns-only) — wire keys match ticked aspects", async () => {
    await gotoTable(page, "users");

    await applyStatusPill(page, "active", "users");
    await clickColumnHeader(page, "username");
    await pickSort(page, "asc");
    await waitForPagesGet(page, "users");

    // Save #1: filter-only.
    {
      const menu = await openPresetPicker(page);
      const popover = await openSaveAsPopover(page, menu);
      const wire = capturePresetWire(page);
      await setAspectMask(popover, {
        "Displayed Filters": true,
        "Filter conditions": true,
        Sorters: false,
        "Displayed Columns": false,
      });
      await fillAndSaveAs(popover, page, "Active filter");

      const inserts = wire.records.filter((r) => r.method === "POST");
      expect(inserts.length).toBe(1);
      expect(contentKeys(inserts[0]!.body)).toEqual(["filterOps", "filters"]);
    }

    // Save #2: all aspects.
    {
      const menu = await openPresetPicker(page);
      const popover = await openSaveAsPopover(page, menu);
      const wire = capturePresetWire(page);
      await setAspectMask(popover, {
        "Displayed Filters": true,
        "Filter conditions": true,
        Sorters: true,
        "Displayed Columns": true,
      });
      await fillAndSaveAs(popover, page, "Active full");

      const inserts = wire.records.filter((r) => r.method === "POST");
      expect(inserts.length).toBe(1);
      const keys = contentKeys(inserts[0]!.body);
      expect(keys).toContain("filters");
      expect(keys).toContain("filterOps");
      expect(keys).toContain("sorters");
      expect(keys).toContain("columns");
    }

    // Save #3: columns-only.
    {
      const menu = await openPresetPicker(page);
      const popover = await openSaveAsPopover(page, menu);
      const wire = capturePresetWire(page);
      await setAspectMask(popover, {
        "Displayed Filters": false,
        "Filter conditions": false,
        Sorters: false,
        "Displayed Columns": true,
      });
      await fillAndSaveAs(popover, page, "Compact view");

      const inserts = wire.records.filter((r) => r.method === "POST");
      expect(inserts.length).toBe(1);
      const body = inserts[0]!.body as { data?: { content?: Record<string, unknown> } };
      expect(contentKeys(body)).toEqual(["columns"]);
      const cols = body.data?.content?.columns as { columnNames?: string[] } | undefined;
      expect(Array.isArray(cols?.columnNames)).toBe(true);
    }

    const menu = await openPresetPicker(page);
    const labels = await texts(menu.locator(`${PICKER_ITEM} .as-preset-picker-item-label`));
    expect(labels).toContain("Active filter");
    expect(labels).toContain("Active full");
    expect(labels).toContain("Compact view");
    await page.keyboard.press("Escape");
  });

  // -------------------------------------------------------------------
  // 11.6 — Apply per-aspect presets only mutates that aspect.

  test("11.6 — applying a per-aspect preset only mutates that aspect's state", async () => {
    // Reset to baseline: Standard wipes everything, then set known state.
    await applyPickerItem(page, "Standard", { table: "users" });

    await applyStatusPill(page, "pending", "users");
    await clickColumnHeader(page, "email");
    await pickSort(page, "desc");
    await waitForPagesGet(page, "users");
    await expect(sortIndicator(page, "email", "desc")).toHaveCount(1);

    // Apply `Active filter` → only filter changes; sorter unchanged.
    await applyPickerItem(page, "Active filter", { table: "users" });
    await expect(sortIndicator(page, "email", "desc")).toHaveCount(1);

    // Apply `Compact view` → no /pages refetch (column set unchanged from
    // baseline); only trigger label updates.
    await applyPickerItem(page, "Compact view");
    await page.waitForTimeout(300);
    await expect(page.locator(PICKER_TRIGGER_LABEL)).toHaveText("Compact view");
    await expect(sortIndicator(page, "email", "desc")).toHaveCount(1);

    // Apply `Active full` → all aspects swap; email-desc indicator clears,
    // username-asc indicator appears.
    await applyPickerItem(page, "Active full", { table: "users" });
    await expect(sortIndicator(page, "email", "desc")).toHaveCount(0);
    await expect(sortIndicator(page, "username", "asc")).toHaveCount(1);
  });

  // -------------------------------------------------------------------
  // 11.7 — Manage dialog (sub-tests).

  test("11.7 setup — save 3 presets (`My A`, `My B`, `My C`) on /orders", async () => {
    await gotoTable(page, "orders");
    {
      const menu = await openPresetPicker(page);
      const popover = await openSaveAsPopover(page, menu);
      await fillAndSaveAs(popover, page, "My A");
    }
    await applyStatusPill(page, "shipped", "orders");
    {
      const menu = await openPresetPicker(page);
      const popover = await openSaveAsPopover(page, menu);
      await fillAndSaveAs(popover, page, "My B");
    }
    await applyStatusPill(page, "pending", "orders");
    {
      const menu = await openPresetPicker(page);
      const popover = await openSaveAsPopover(page, menu);
      await fillAndSaveAs(popover, page, "My C");
    }
  });

  test("11.7.2 — Manage dialog renders System + My sections, counter chip, per-row icons", async () => {
    const menu = await openPresetPicker(page);
    const dialog = await openManageDialog(page, menu);

    const counter = dialog.locator(DIALOG_COUNTER);
    await expect(counter).toBeVisible();
    await expect(counter).toContainText(/\d+\s*\/\s*10/u);

    const headers = await texts(dialog.locator(DIALOG_SECTION_HEADER));
    expect(headers).toContain("System");
    expect(headers).toContain("My presets");
    expect(headers).not.toContain("Shared by others");

    const myA = dialogRow(dialog, "My A");
    await expect(myA).toHaveCount(1);
    await expect(myA.locator(".as-preset-dialog-row-active")).toHaveCount(1);
    await expect(myA.locator(".as-preset-dialog-row-default")).toHaveCount(1);
    await expect(myA.locator(".as-preset-dialog-row-public-toggle")).toHaveCount(1);
    await expect(myA.locator(".as-preset-dialog-row-delete")).toHaveCount(1);

    const standardRow = dialogRow(dialog, "Standard");
    await expect(standardRow).toHaveCount(1);
    await expect(standardRow.locator(".as-preset-dialog-row-public-toggle")).toHaveCount(0);
    await expect(standardRow.locator(".as-preset-dialog-row-delete")).toHaveCount(0);

    await dialog.locator(DIALOG_FOOTER_CLOSE).click();
    await expect(dialog).toHaveCount(0);
  });

  test("11.7.3 — Search filters by name (and by owner case-insensitive)", async () => {
    const menu = await openPresetPicker(page);
    const dialog = await openManageDialog(page, menu);
    const search = dialog.locator(DIALOG_SEARCH_INPUT);
    const visibleLabels = () => texts(dialog.locator(".as-preset-dialog-row-label-text"));

    await search.fill("My");
    expect((await visibleLabels()).toSorted()).toEqual(["My A", "My B", "My C"]);

    await search.fill("you");
    expect((await visibleLabels()).toSorted()).toEqual(["My A", "My B", "My C"]);

    await search.fill("zzznomatch");
    await expect(dialog.locator(".as-preset-dialog-empty")).toBeVisible();

    await search.fill("");
    await dialog.locator(DIALOG_FOOTER_CLOSE).click();
    await expect(dialog).toHaveCount(0);
  });

  test("11.7.4 — Pin `My A` as default + Save fires single userConf upsert", async () => {
    const menu = await openPresetPicker(page);
    const dialog = await openManageDialog(page, menu);

    const myA = dialogRow(dialog, "My A");
    await myA.locator(".as-preset-dialog-row-default").click();
    await expect(myA.locator(".as-preset-dialog-row-default")).toHaveAttribute("data-on", "");
    await expect(dialog.locator(DIALOG_FOOTER_UNSAVED)).toBeVisible();

    const wire = capturePresetWire(page);
    const upsert = page.waitForRequest(
      (r) =>
        r.url().includes("/api/db/_presets") && (r.method() === "POST" || r.method() === "PATCH"),
    );
    await dialog.locator(DIALOG_FOOTER_SAVE).click();
    await upsert;
    await expect(dialog).toHaveCount(0);

    const writes = wire.records.filter((r) => r.method !== "GET");
    expect(writes.length).toBeGreaterThanOrEqual(1);
    const userConfWrite = writes.find((r) => {
      const b = r.body as { data?: { defaultPresetId?: unknown } } | undefined;
      return b?.data && "defaultPresetId" in b.data;
    });
    expect(userConfWrite).toBeTruthy();
  });

  test("11.7.5+9 — batched Save: rename + public-toggle + delete — sequence verified", async () => {
    const menu = await openPresetPicker(page);
    const dialog = await openManageDialog(page, menu);

    const myA = dialogRow(dialog, "My A");
    await myA.locator(".as-preset-dialog-row-delete").click();
    await expect(myA).toHaveAttribute("data-deleted", "");

    const myC = dialogRow(dialog, "My C");
    await myC.locator(".as-preset-dialog-row-public-toggle").click();
    await expect(myC.locator(".as-preset-dialog-row-public-toggle")).toHaveAttribute("data-on", "");

    const myB = dialogRow(dialog, "My B");
    await myB.locator(".as-preset-dialog-row-active").click();

    // Rename `My B` → `My B v2`. Click label, type, press Enter — the inline
    // rename is committed on @blur OR Enter; both write through to the
    // pending-edits dict immediately on @input so Save activates without blur.
    await myB.locator(".as-preset-dialog-row-label-text").click();
    const renameInput = dialog.locator(".as-preset-dialog-row-rename");
    await expect(renameInput).toBeVisible();
    await renameInput.fill("My B v2");
    await renameInput.press("Enter");
    await expect(renameInput).toHaveCount(0);

    await expect(dialog.locator(DIALOG_FOOTER_UNSAVED)).toBeVisible();

    const wire = capturePresetWire(page);
    const lastDelete = page.waitForRequest(
      (r) => r.url().includes("/api/db/_presets") && r.method() === "DELETE",
    );
    await dialog.locator(DIALOG_FOOTER_SAVE).click();
    await lastDelete;
    await expect(dialog).toHaveCount(0);

    const writes = wire.records.filter((r) => r.method !== "GET").toSorted((a, b) => a.ts - b.ts);
    expect(writes.length).toBeGreaterThanOrEqual(3);

    const renamePatch = writes.find(
      (r) =>
        r.method === "PATCH" &&
        r.body !== undefined &&
        (r.body as { data?: { label?: string } }).data?.label === "My B v2",
    );
    const publicPatch = writes.find(
      (r) =>
        r.method === "PATCH" &&
        r.body !== undefined &&
        (r.body as { public?: boolean }).public === true,
    );
    const deleteReq = writes.find((r) => r.method === "DELETE");

    expect(renamePatch).toBeTruthy();
    expect(publicPatch).toBeTruthy();
    expect(deleteReq).toBeTruthy();

    // Documented contract: renames → publicToggles → deletes.
    expect(renamePatch!.ts).toBeLessThanOrEqual(publicPatch!.ts);
    expect(publicPatch!.ts).toBeLessThanOrEqual(deleteReq!.ts);

    const menu2 = await openPresetPicker(page);
    const dialog2 = await openManageDialog(page, menu2);
    await expect(dialogRow(dialog2, "My A")).toHaveCount(0);
    await expect(dialogRow(dialog2, "My B v2")).toHaveCount(1);
    await expect(
      dialogRow(dialog2, "My C").locator(".as-preset-dialog-row-public-toggle"),
    ).toHaveAttribute("data-on", "");
    await dialog2.locator(DIALOG_FOOTER_CLOSE).click();
    await expect(dialog2).toHaveCount(0);
  });

  test("11.7.10 — Cancel button discards pending edits without firing HTTP", async () => {
    const menu = await openPresetPicker(page);
    const dialog = await openManageDialog(page, menu);

    // Snapshot data-on counts on default + public toggles BEFORE any
    // pending edits land. Re-asserting these counts after Cancel + re-open
    // is baseline-tolerant — passes regardless of state earlier tests left.
    const rowMyB = dialogRow(dialog, "My B v2");
    const rowMyC = dialogRow(dialog, "My C");
    const baseMyB = await snapshotRowToggles(rowMyB);
    const baseMyC = await snapshotRowToggles(rowMyC);

    // Stage four kinds of pending edits to exercise every branch of
    // `syncPendingFromServer()` reset on dialog re-open:
    //   1. Toggle default-pin on `My C`
    //   2. Toggle public on `My B v2`
    //   3. Rename `My B v2` → `My B v2 PENDING` (committed via Enter so
    //      the input unmounts and the span re-renders with the
    //      [data-pending=""] indicator — pendingLabels.size > 0).
    //   4. Mark the (now-renamed) row for delete.
    //
    // Sequence note: rename is gated off when the row is mark-for-delete
    // (`v-else-if="!pendingDeleteIds.has(row.id)"` in the template) — and
    // the row label SPAN unmounts during edit (so a `:text-is("My B v2")`
    // filter can't resolve the row). Hence we commit-rename FIRST. Once
    // committed, `liveLabel = pending ?? original` shows the pending
    // value, so the row locator must follow the rename to "My B v2 PENDING".
    await rowMyC.locator(".as-preset-dialog-row-default").click();
    await rowMyB.locator(".as-preset-dialog-row-public-toggle").click();
    await rowMyB.locator(".as-preset-dialog-row-label-text").click();
    const renameInput = dialog.locator(".as-preset-dialog-row-rename");
    await expect(renameInput).toBeVisible();
    await renameInput.fill("My B v2 PENDING");
    await renameInput.press("Enter");
    await expect(renameInput).toHaveCount(0);
    // Re-acquire the row locator under the pending label.
    const rowMyBPending = dialogRow(dialog, "My B v2 PENDING");
    await expect(
      rowMyBPending.locator(".as-preset-dialog-row-label-text[data-pending='']"),
    ).toHaveCount(1);
    await rowMyBPending.locator(".as-preset-dialog-row-delete").click();
    await expect(rowMyBPending).toHaveAttribute("data-deleted", "");
    await expect(dialog.locator(DIALOG_FOOTER_UNSAVED)).toBeVisible();

    // Cancel — dialog closes, no HTTP fires.
    const wire = capturePresetWire(page);
    await dialog.locator(DIALOG_FOOTER_CLOSE).click();
    await expect(dialog).toHaveCount(0);
    await page.waitForTimeout(300);

    expect(wire.records.filter((r) => r.method !== "GET")).toEqual([]);

    // Re-open the dialog and verify each pendingX dict was discarded by
    // `syncPendingFromServer()` running in the open-watch. If a future
    // regression makes Cancel suppress HTTP but keep pendingX populated,
    // a subsequent Save would flush stale edits — these assertions catch
    // that pattern.
    const menu2 = await openPresetPicker(page);
    const dialog2 = await openManageDialog(page, menu2);

    // 1+2. Default-pin and public toggles reverted to baseline on both rows.
    const myB2 = dialogRow(dialog2, "My B v2");
    const myC2 = dialogRow(dialog2, "My C");
    expect(await snapshotRowToggles(myB2)).toEqual(baseMyB);
    expect(await snapshotRowToggles(myC2)).toEqual(baseMyC);

    // 3. Mark-for-delete reverted: `My B v2` no longer carries data-deleted.
    await expect(myB2).not.toHaveAttribute("data-deleted", "");

    // 4. Pending-label reverted: `My B v2` label is the server label, the
    //    [data-pending=""] indicator is gone, and the pendingLabels-driven
    //    "PENDING" suffix is not visible.
    await expect(myB2.locator(".as-preset-dialog-row-label-text")).toHaveText("My B v2");
    await expect(myB2.locator(".as-preset-dialog-row-label-text[data-pending='']")).toHaveCount(0);

    // Footer's "unsaved changes" indicator is gone because pending dicts
    // are clean.
    await expect(dialog2.locator(DIALOG_FOOTER_UNSAVED)).toHaveCount(0);

    await dialog2.locator(DIALOG_FOOTER_CLOSE).click();
    await expect(dialog2).toHaveCount(0);
  });

  // -------------------------------------------------------------------
  // 11.8 — forceFilters overlay survives preset apply.

  test("11.8 — preset with status='shipped' applied on /orders-cancelled AND-merges with forceFilters (empty result)", async ({
    browser,
  }) => {
    // Setup: in a fresh context, save `Shipped overlay` on /orders-cancelled.
    const setupCtx = await browser.newContext({ storageState: authFileFor("admin") });
    try {
      const setupPage = await setupCtx.newPage();
      await gotoTable(setupPage, "orders-cancelled", { apiPath: "orders" });
      await addFilterPill(setupPage, "Status");
      await applyStatusPill(setupPage, "shipped", "orders");

      const menu = await openPresetPicker(setupPage);
      const popover = await openSaveAsPopover(setupPage, menu);
      await fillAndSaveAs(popover, setupPage, "Shipped overlay");
      await setupPage.close();
    } finally {
      await setupCtx.close();
    }

    const fresh = await browser.newContext({ storageState: authFileFor("admin") });
    try {
      const dlPage = await fresh.newPage();
      await gotoTable(dlPage, "orders-cancelled", { apiPath: "orders" });

      const captured = await expectSinglePages(
        dlPage,
        async () => {
          const menu = await openPresetPicker(dlPage);
          await menu.locator(PICKER_ITEM).filter({ hasText: "Shipped overlay" }).click();
          await expect(menu).toHaveCount(0);
        },
        { table: "orders" },
      );
      // Wire shape: `?status=cancelled&!(!(status=shipped))` — both clauses
      // reach the server, AND-evaluated, no row is both → empty result.
      const decoded = decodeURIComponent(captured.url);
      expect(decoded).toMatch(/status=['"]?cancelled['"]?/u);
      expect(decoded).toMatch(/!\(!\(status=['"]?shipped['"]?\)\)/u);
      const rows = dlPage.locator("table[data-as-main-table] tbody tr:has(td)");
      await expect(rows).toHaveCount(0);
    } finally {
      await fresh.close();
    }
  });

  // -------------------------------------------------------------------
  // 11.9 — Capabilities gate publish action.

  test("11.9.A — admin: GET /capabilities returns canPublish:true; Save-as popover shows Make-public", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const resp = await ctx.get("/api/db/_presets/capabilities?app=vuedemo&tableKey=orders");
      expect(resp.status()).toBe(200);
      const json = (await resp.json()) as {
        canPublish?: boolean;
        presetLimit?: number;
        userId?: string;
      };
      expect(json.canPublish).toBe(true);
      expect(typeof json.presetLimit).toBe("number");
      expect(typeof json.userId).toBe("string");
    } finally {
      await ctx.dispose();
    }

    await page.bringToFront();
    await gotoTable(page, "orders");
    const menu = await openPresetPicker(page);
    const popover = await openSaveAsPopover(page, menu);
    await expect(popover.locator(".as-preset-picker-popover-public")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
  });

  test("11.9.B — viewer: GET /capabilities returns canPublish:false; Save-as popover hides Make-public", async ({
    browser,
  }) => {
    const ctx = await newRequestContext("viewer");
    try {
      const resp = await ctx.get("/api/db/_presets/capabilities?app=vuedemo&tableKey=orders");
      expect(resp.status()).toBe(200);
      const json = (await resp.json()) as { canPublish?: boolean };
      expect(json.canPublish).toBe(false);
    } finally {
      await ctx.dispose();
    }

    const viewerCtx = await browser.newContext({ storageState: authFileFor("viewer") });
    try {
      const vPage = await viewerCtx.newPage();
      await gotoTable(vPage, "orders");
      const menu = await openPresetPicker(vPage);
      const popover = await openSaveAsPopover(vPage, menu);
      await expect(popover.locator(".as-preset-picker-popover-public")).toHaveCount(0);
    } finally {
      await viewerCtx.close();
    }
  });

  test("11.9.C — viewer Manage dialog: own private row exposes no public-toggle (canToggleRowPublic gated)", async ({
    browser,
  }) => {
    const viewerCtx = await browser.newContext({ storageState: authFileFor("viewer") });
    try {
      const vPage = await viewerCtx.newPage();
      await gotoTable(vPage, "orders");
      const menu = await openPresetPicker(vPage);
      const popover = await openSaveAsPopover(vPage, menu);
      await fillAndSaveAs(popover, vPage, "Viewer preset");

      const menu2 = await openPresetPicker(vPage);
      const dialog = await openManageDialog(vPage, menu2);
      const row = dialogRow(dialog, "Viewer preset");
      await expect(row).toHaveCount(1);
      await expect(row.locator(".as-preset-dialog-row-public-toggle")).toHaveCount(0);
      await expect(row.locator(".as-preset-dialog-row-public-spacer")).toHaveCount(1);
    } finally {
      await viewerCtx.close();
    }
  });
});
