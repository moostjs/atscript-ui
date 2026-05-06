// Section 8 — Actions: backend gates / forms (batch F).
//
// **Single-file batch.** Playwright runs spec files in parallel across
// multiple workers (`fullyParallel: false` only governs within-file
// ordering — see [docs](https://playwright.dev/docs/test-parallel)),
// and the demo's mutating action paths (Suspend / Activate / Delete)
// hit a single shared sqlite db. A 6-file split (the original plan)
// raced when files mutated admin / bob / alice in parallel: read-only
// "open the form on admin" assertions saw admin already suspended by
// a sibling file's POST. Forcing serialization across files would
// require either (a) a Playwright project edit (locked file) or
// (b) `--workers=1` at the run command (not the canonical invocation).
// Collapsing the batch into ONE file pins everything to a single
// worker → sequential execution → coherent seed evolution.
//
// This batch intentionally does NOT call `resetSeed()` in `beforeAll`
// — the serial mutation chain below is self-consistent against the
// `globalSetup` seed, and skipping the reset shaves ~100 ms off the
// run. Future mutating batches that need a fresh seed can opt in.
//
// ---------------------------------------------------------------------
// Coverage map (each `test()` block at a glance):
//   8.10A  viewer GET /meta.actions[] — class-level survives, method-
//          level @ArbacAction("update") strips
//   8.10B  admin GET /meta.actions[] — full set
//   8.10C  viewer DOM toolbar — Invite user + Export CSV; no
//          Suspend / Activate / Resend invite; no select-mode toggle
//   8.10D  viewer click `Invite user` → /users/invite navigation
//   8.12   raw POST /actions/activate on already-active admin → 409
//          ActionDisabledError (NOT 400/403 as prompt guessed); admin
//          status unchanged
//   8.18.1 row-actions menu items carry `as-row-actions-intent-${scope}`
//          (pivots off eve `invited` so all six intents surface in one
//          menu walk)
//   8.18.2 confirm dialog Delete (negative) → confirm-error class;
//          cancel stays neutral
//   8.18.3 action-form Suspend (negative) submit → submit-error class
//   8.18.4 action-form Resend invite (primary) submit → submit-primary
//          class (eve `invited` is the only row passing the gate)
//   8.19.1 4-row Suspend chip strip — visible chips + +N more sums
//          to idTotal; measure clone present
//   8.19.2 1-row Suspend chip strip — single chip, no overflow,
//          measure clone absent (`needsMeasure = allIds.length > 1`)
//   8.7.1  GET /pages?$actions=true — admin (active) excludes
//          activate+resend-invite; bob (pending) includes activate
//   8.7.2  Row menu mirrors $actions per status
//   8.7.3  Toolbar bulk Activate (8.7 step 5) NOT reachable —
//          documented divergence; toolbar only surfaces rows-level
//          actions when 2+ rows are selected
//   8.5    Bulk Suspend manager+alice via toolbar form → both
//          suspended; wire body assertion + toast + auto-refetch
//   8.20   Suspend admin via row menu form — empty submit fires
//          `Reason is required`, short submit fires `@expect.minLength`
//          message, valid submit succeeds
//   8.6    Activate bob via row menu — direct POST (no confirm/form);
//          toast + auto-refetch
//   8.8    Bulk Suspend admin (suspended) + bob (active) + alice
//          (suspended) — `onDisabledRows: 'skip'` server-filters; only
//          bob processed
//   8.9    Synthetic `__remove` — Delete a freshly-inserted user
//          (every seeded user is FK-referenced; documented seed gap)
//          via row menu → confirm prompt → DELETE composite-route
//          (preferredId in query string, NOT PK route — overrides
//          scenario doc) → toast → row removed
//
// Mutation chain (in declaration order):
//   start  → admin/manager/viewer/alice ACTIVE, bob PENDING, eve INVITED
//   8.5    → manager + alice → suspended
//   8.20   → admin → suspended
//   8.6    → bob → active
//   8.8    → bob → suspended (admin/alice skipped, already suspended)
//   8.9    → bob deleted
//   end    → admin/manager/alice SUSPENDED, viewer ACTIVE, eve INVITED,
//           bob deleted
// (admin's storageState session cookie still valid throughout — the
//  session lookup doesn't enforce status.)
//
// Wire-shape findings:
//   - `ActionDisabledError`: HTTP **409** (Conflict), body
//     `{ name: "ActionDisabledError", message, statusCode: 409,
//        action, id?, ids?, error: "Conflict" }`.
//   - `Suspend` action with `@InputForm(SuspendUsersInput)` opens the
//     form dialog, NOT a confirm-then-form sequence. `triggerAction()`
//     short-circuits through the form path when `inputForm` is set —
//     the action's `promptText` is unreachable for form-bearing
//     actions.
//   - Suspend wire body: `{ ids: [{username}, ...], input }`. Single-
//     row Suspend invoked via the row menu still emits a 1-tuple `ids`
//     array because Suspend is `@DbActionRows` (level: 'rows').
//   - Activate wire body: `{ ids: { username } }` (object form).
//     Activate is `@DbActionRow` (level: 'row').
//   - `__remove` (Delete) wire: `DELETE /api/db/tables/users?username=<value>`
//     (composite-delete route, NOT `/users/:id` PK route). The
//     scenario-doc step "DELETE /api/db/tables/users/<id> (PK form)"
//     is wrong — db-client `remove()` calls `extractIdentifier(row,
//     preferredId)` which renders `{ username }` for /users, then
//     dispatches via the composite-delete route as a query string.
//   - Toast container: `.fixed.bottom-4.right-4 > div`. Each toast
//     carries `scope-good` (positive) or `scope-error` (negative)
//     class.

import { type Locator, type Page, expect, test } from "@playwright/test";

import {
  authFileFor,
  awaitActionFormReady,
  captureLastPost,
  clearSelection,
  clickRowMenuItem,
  clickToolbarAction,
  columnCellIndex,
  dismissActionForm,
  dismissConfirm,
  expectSinglePages,
  findToast,
  gotoTable,
  newRequestContext,
  openRowActionsMenu,
  toggleSelectMode,
  userRowByName,
} from "../helpers";

// ---------------------------------------------------------------------
// File-local helpers (single-call-site or domain-specific to /users).

/** Trim of the `status` column for `name`'s row. */
async function userStatus(table: Locator, name: string): Promise<string> {
  const row = await userRowByName(table, name);
  const idx = await columnCellIndex(table, "status");
  return ((await row.locator("td").nth(idx).textContent()) ?? "").trim();
}

/** Read trimmed labels of the items in an open `.as-*-menu`. */
async function menuItemLabels(menu: Locator, itemSelector: string): Promise<string[]> {
  return menu
    .locator(itemSelector)
    .evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
}

/** Press Escape and assert `menu` is gone — closes any open Reka popover. */
async function closeMenuViaEscape(page: Page, menu: Locator): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
}

/** Tick the selection checkbox on the row whose `username` matches `name`. */
async function selectUserCheckbox(table: Locator, name: string): Promise<void> {
  const row = await userRowByName(table, name);
  await row.locator(".as-table-checkbox").first().click();
}

async function fillReason(page: Page, value: string): Promise<void> {
  await page.locator('.as-action-form-content input[name="reason"]').fill(value);
}

async function clickActionFormSubmit(page: Page): Promise<void> {
  await page.locator(".as-action-form-submit").click();
}

// ---------------------------------------------------------------------
// Tests — wrapped in a single `serial` describe to keep the mutation
// chain coherent. Sub-describes scope assertions per scenario.

test.describe.configure({ mode: "serial" });

test.describe("Section 8 batch F — actions: backend gates / forms", () => {
  // -------------------------------------------------------------------
  // 8.10 — ARBAC wire-strip + Invite user carve-out (read-only)

  test("8.10A — viewer /meta.actions[] strips update-gated entries", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      const resp = await ctx.get("/api/db/tables/users/meta");
      expect(resp.status()).toBe(200);
      const json = (await resp.json()) as { actions?: Array<{ name: string }> };
      const names = (json.actions ?? []).map((a) => a.name).toSorted();
      // Class-level navigate-only `invite-user` + custom-only
      // `export-csv` survive (option-(a) sub-decision: gated at
      // destination, not in /meta). Method-level `@ArbacAction("update")`
      // strips `activate` / `suspend` / `resend-invite`.
      expect(names).toEqual(["copy-invite-link", "edit", "export-csv", "invite-user"]);
    } finally {
      await ctx.dispose();
    }
  });

  test("8.10B — admin /meta.actions[] exposes the full method set", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const resp = await ctx.get("/api/db/tables/users/meta");
      expect(resp.status()).toBe(200);
      const json = (await resp.json()) as { actions?: Array<{ name: string }> };
      const names = (json.actions ?? []).map((a) => a.name).toSorted();
      expect(names).toEqual([
        "activate",
        "copy-invite-link",
        "edit",
        "export-csv",
        "invite-user",
        "resend-invite",
        "suspend",
      ]);
    } finally {
      await ctx.dispose();
    }
  });

  test("8.10C — viewer toolbar shows Invite user + Export CSV; no Suspend / Activate / Resend invite", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFileFor("viewer") });
    try {
      const page = await ctx.newPage();
      await gotoTable(page, "users");

      // Default-action button — `Invite user` (class-level default).
      const defaultBtn = page.locator(".as-table-actions-btn");
      await expect(defaultBtn).toHaveCount(1);
      await expect(defaultBtn).toHaveText(/Invite user/);
      await expect(defaultBtn).toHaveAttribute("aria-label", "Invite user");

      // More menu — only `Export CSV`. No update-gated entries.
      const more = page.locator(".as-table-actions-more");
      await expect(more).toHaveCount(1);
      await more.click();
      const menu = page.locator(".as-table-actions-menu");
      await expect(menu).toBeVisible();
      const trimmed = await menuItemLabels(menu, ".as-table-actions-menu-item");
      expect(trimmed).toEqual(["Export CSV"]);

      // Multi-select toggle hidden for read-only (`canWrite === false`).
      await page.keyboard.press("Escape");
      await expect(page.locator(".as-page-title-toggle")).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test("8.10D — viewer click `Invite user` navigates to /users/invite; invite form renders", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFileFor("viewer") });
    try {
      const page = await ctx.newPage();
      await gotoTable(page, "users");

      const inviteBtn = page.locator(".as-table-actions-btn").filter({ hasText: "Invite user" });
      await Promise.all([page.waitForURL(/\/users\/invite$/), inviteBtn.click()]);

      // Page renders the invite-admin workflow form (no client-side
      // gate — server-side gate fires at workflow submit time, not at
      // navigate time). Documents the carve-out: navigate-only
      // @DbTableActions surfaces unfiltered for any role; the
      // destination page handles enforcement.
      await expect(page.getByRole("heading", { name: "Invite user", level: 1 })).toHaveCount(1);
    } finally {
      await ctx.close();
    }
  });

  // -------------------------------------------------------------------
  // 8.12 — server-side gate (raw POST)

  test("8.12 — POST /actions/activate on already-active admin → 409 ActionDisabledError; status unchanged", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const resp = await ctx.post("/api/db/tables/users/actions/activate", {
        data: { ids: { username: "admin" } },
      });
      expect(resp.status()).toBe(409);
      const body = (await resp.json()) as {
        name?: string;
        statusCode?: number;
        action?: string;
        id?: Record<string, unknown>;
        message?: string;
      };
      expect(body.name).toBe("ActionDisabledError");
      expect(body.statusCode).toBe(409);
      expect(body.action).toBe("activate");
      expect(body.id).toEqual({ username: "admin" });
      expect(typeof body.message).toBe("string");

      // Verify admin's status didn't change — read back via /one/:id.
      const q = await ctx.get("/api/db/tables/users/one/admin");
      expect(q.status()).toBe(200);
      const qjson = (await q.json()) as { status?: string };
      expect(qjson.status).toBe("active");
    } finally {
      await ctx.dispose();
    }
  });

  // -------------------------------------------------------------------
  // 8.18 — Intent → scope across surfaces (read-only — cancel-only)

  test("8.18.1 Surface 1 — row-actions menu items carry `as-row-actions-intent-${scope}`", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    // Use eve (`status: 'invited'`) — the only seeded user where every
    // gate-relevant action is enabled simultaneously: Activate (status
    // !== 'active'), Resend invite (status === 'invited'), Suspend
    // (status !== 'suspended'). Pivoting off bob (`pending`, where
    // Resend invite is gated out) lets us assert all six intents in a
    // single menu walk without a fallthrough conditional.
    const eveRow = await userRowByName(table, "eve");
    const menu = await openRowActionsMenu(page, eveRow);

    const byLabel = new Map(
      await menu
        .locator(".as-row-actions-menu-item")
        .evaluateAll((els) =>
          els.map((el) => [(el.textContent ?? "").trim(), el.className] as const),
        ),
    );

    // positive — Activate (predicate `status === 'active'` fails on
    // invited eve → action enabled in row menu).
    expect(byLabel.get("Activate")).toMatch(/\bas-row-actions-intent-positive\b/);
    // primary — Resend invite (gate `status !== 'invited'` fails on
    // invited eve → enabled).
    expect(byLabel.get("Resend invite")).toMatch(/\bas-row-actions-intent-primary\b/);
    expect(byLabel.get("Suspend")).toMatch(/\bas-row-actions-intent-negative\b/);
    expect(byLabel.get("Edit")).toMatch(/\bas-row-actions-intent-secondary\b/);
    expect(byLabel.get("Copy invite link")).toMatch(/\bas-row-actions-intent-secondary\b/);
    // `__remove` defaults to `intent: 'negative'`.
    expect(byLabel.get("Delete")).toMatch(/\bas-row-actions-intent-negative\b/);

    await closeMenuViaEscape(page, menu);
  });

  test("8.18.2 Surface 2 — confirm-dialog: Delete (negative) → `as-confirm-dialog-confirm-error`; Cancel stays neutral", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const bobRow = await userRowByName(table, "bob");
    const menu = await openRowActionsMenu(page, bobRow);
    await clickRowMenuItem(menu, "Delete");

    const dialog = page.locator(".as-confirm-dialog-content");
    await expect(dialog).toBeVisible();

    await expect(page.locator(".as-confirm-dialog-confirm")).toHaveClass(
      /\bas-confirm-dialog-confirm-error\b/,
    );

    // Cancel button: no scope modifier (always neutral).
    const cancelClass =
      (await page.locator(".as-confirm-dialog-cancel").getAttribute("class")) ?? "";
    expect(cancelClass).not.toMatch(/as-confirm-dialog-cancel-/);

    // Body matches the singular `__remove` template.
    await expect(page.locator(".as-confirm-dialog-body")).toHaveText("Delete item bob?");

    // Bail without mutating.
    await dismissConfirm(page);
  });

  test("8.18.3 Surface 3 — action-form submit: Suspend (negative) → `as-action-form-submit-error`", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const adminRow = await userRowByName(table, "admin");
    const menu = await openRowActionsMenu(page, adminRow);
    await clickRowMenuItem(menu, "Suspend");

    const formContent = page.locator(".as-action-form-content");
    await expect(formContent).toBeVisible();

    const submit = page.locator(".as-action-form-submit");
    await expect(submit).toHaveClass(/\bas-action-form-submit-error\b/);
    // Submit text comes from `@ui.form.submit.text 'Suspend'` (form
    // schema), not from action.label.
    await expect(submit).toHaveText("Suspend");

    const cancelClass = (await page.locator(".as-action-form-cancel").getAttribute("class")) ?? "";
    expect(cancelClass).not.toMatch(/as-action-form-cancel-/);

    await dismissActionForm(page);
  });

  test("8.18.4 Surface 3 — action-form submit: Resend invite (primary) → `as-action-form-submit-primary`", async ({
    page,
  }) => {
    // Resend invite is `intent: 'primary'` and `@InputForm`-bearing.
    // `triggerAction()` short-circuits to the form-dialog path; the
    // submit button picks up `as-action-form-submit-primary`. Eve
    // (`status: 'invited'`) is the only seeded row where the gate
    // (`status !== 'invited'`) doesn't strip the action.
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const eveRow = await userRowByName(table, "eve");
    const menu = await openRowActionsMenu(page, eveRow);
    await clickRowMenuItem(menu, "Resend invite");

    const formContent = page.locator(".as-action-form-content");
    await expect(formContent).toBeVisible();

    const submit = page.locator(".as-action-form-submit");
    await expect(submit).toHaveClass(/\bas-action-form-submit-primary\b/);
    // Submit text comes from `@ui.form.submit.text 'Send'` (form schema).
    await expect(submit).toHaveText("Send");

    await dismissActionForm(page);
  });

  // (8.18 warning intent: no demo action carries `intent: 'warning'`.
  // Documented as scenario-doc gap — Suspend/Activate/Delete cover
  // negative + positive, Resend invite covers primary, Edit+Copy
  // cover secondary; warn has no exemplar.)

  // -------------------------------------------------------------------
  // 8.19 — chip strip + +N more overflow (read-only — cancel-only)

  test("8.19.1 4-row Suspend selection — visible chips + optional `+N more…` sums to idTotal", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    await toggleSelectMode(page);
    const table = page.locator("table.as-table").first();
    // Pick 4 of 5 (skip admin so the suspend wave doesn't touch the
    // storage-state-bearing role mid-batch). manager + viewer + alice
    // + bob.
    for (const name of ["manager", "viewer", "alice", "bob"]) {
      await selectUserCheckbox(table, name);
    }
    await expect(page.locator(".as-page-selection-count")).toHaveText("4 selected");

    await clickToolbarAction(page, "Suspend");
    const formContent = await awaitActionFormReady(page);

    const idsBlock = formContent.locator(".as-action-form-ids");
    const measureBlock = formContent.locator(".as-action-form-ids-measure");

    await expect(measureBlock).toHaveCount(1);
    const measureChips = await measureBlock.locator("[data-id-chip]").count();
    expect(measureChips).toBe(4);
    await expect(measureBlock.locator("[data-id-more]")).toHaveCount(1);

    const visibleChips = await idsBlock.locator("> .as-action-form-id").count();
    const moreEl = idsBlock.locator("> .as-action-form-id-more");
    let overflow = 0;
    if ((await moreEl.count()) === 1) {
      const text = ((await moreEl.textContent()) ?? "").trim();
      const match = text.match(/^(\d+)\s+more/);
      expect(match).not.toBeNull();
      overflow = Number(match![1]);
    }
    expect(visibleChips + overflow).toBe(4);

    await dismissActionForm(page);
    // Toggle multi-select OFF so subsequent tests start in the
    // canonical `select="none"` mode (TablePage's selectMode watcher
    // only resets on `path` change, not on test boundaries).
    await clearSelection(page);
  });

  test("8.19.2 1-row Suspend — chip strip shows 1 chip, no `+N more…`", async ({ page }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const adminRow = await userRowByName(table, "admin");
    const menu = await openRowActionsMenu(page, adminRow);
    await clickRowMenuItem(menu, "Suspend");

    const formContent = await awaitActionFormReady(page);
    const idsBlock = formContent.locator(".as-action-form-ids");
    const chips = idsBlock.locator("> .as-action-form-id");
    await expect(chips).toHaveCount(1);
    await expect(chips.first()).toHaveText("admin");
    await expect(idsBlock.locator("> .as-action-form-id-more")).toHaveCount(0);
    // Measurement clone is skipped (`view.needsMeasure = allIds.length > 1`).
    await expect(formContent.locator(".as-action-form-ids-measure")).toHaveCount(0);

    await dismissActionForm(page);
  });

  // -------------------------------------------------------------------
  // 8.7 — `$actions[]` wire shape + row menu mirroring (read-only)

  test("8.7.1 GET /pages?$actions=true — admin (active) excludes `activate`+`resend-invite`; bob (pending) includes `activate`", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const resp = await ctx.get(
        "/api/db/tables/users/pages?$select=id,username,status&$actions=true&$page=1&$size=10",
      );
      expect(resp.status()).toBe(200);
      const json = (await resp.json()) as {
        data: Array<{ username: string; status: string; $actions?: string[] }>;
      };
      for (const r of json.data) {
        expect(Array.isArray(r.$actions)).toBe(true);
      }
      const byUser = new Map(json.data.map((r) => [r.username, r] as const));
      const admin = byUser.get("admin")!;
      const bob = byUser.get("bob")!;

      expect(admin.status).toBe("active");
      expect(admin.$actions).not.toContain("activate");
      expect(admin.$actions).not.toContain("resend-invite");
      expect(admin.$actions).toContain("suspend");

      expect(bob.status).toBe("pending");
      expect(bob.$actions).toContain("activate");
      expect(bob.$actions).toContain("suspend");
      expect(bob.$actions).not.toContain("resend-invite");
    } finally {
      await ctx.dispose();
    }
  });

  test("8.7.2 Row menu mirrors `$actions`: admin hides Activate+Resend invite; bob shows Activate, hides Resend invite", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const adminRow = await userRowByName(table, "admin");
    let menu = await openRowActionsMenu(page, adminRow);
    let labels = await menuItemLabels(menu, ".as-row-actions-menu-item");
    expect(labels).toContain("Suspend");
    expect(labels).not.toContain("Activate");
    expect(labels).not.toContain("Resend invite");
    await closeMenuViaEscape(page, menu);

    const bobRow = await userRowByName(table, "bob");
    menu = await openRowActionsMenu(page, bobRow);
    labels = await menuItemLabels(menu, ".as-row-actions-menu-item");
    expect(labels).toContain("Activate");
    expect(labels).toContain("Suspend");
    expect(labels).not.toContain("Resend invite");
    await closeMenuViaEscape(page, menu);
  });

  test("8.7.3 Toolbar bulk Activate (8.7 step 5) NOT reachable — Activate is row-level only; toolbar exposes only rows-level actions when 2+ rows selected", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    await toggleSelectMode(page);
    const table = page.locator("table.as-table").first();
    await selectUserCheckbox(table, "admin");
    await selectUserCheckbox(table, "bob");
    await expect(page.locator(".as-page-selection-count")).toHaveText("2 selected");

    // Default-action button — `Suspend` (rows-level + only one
    // rows-level action declared on /users → `collapseSingle`
    // promotes it to the default-render).
    const btnLabels = await page.locator(".as-table-actions-btn").allTextContents();
    expect(btnLabels).toEqual(["Suspend"]);
    // No more menu — `collapseSingle` drained others/trailingRowActions
    // when promoting the sole entry.
    await expect(page.locator(".as-table-actions-more")).toHaveCount(0);

    await clearSelection(page);
  });

  // -------------------------------------------------------------------
  // 8.5 — Bulk Suspend manager+alice via toolbar form (MUTATING)

  test("8.5 — Multi-select manager + alice; toolbar Suspend opens form; submit suspends both", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    await toggleSelectMode(page);
    const table = page.locator("table.as-table").first();
    await selectUserCheckbox(table, "manager");
    await selectUserCheckbox(table, "alice");
    await expect(page.locator(".as-page-selection-count")).toHaveText("2 selected");

    await clickToolbarAction(page, "Suspend");

    const form = await awaitActionFormReady(page);

    // Title comes from form schema's `@meta.label 'Suspend users'`.
    await expect(page.locator(".as-action-form-title")).toHaveText("Suspend users");

    const chips = form.locator(".as-action-form-ids > .as-action-form-id");
    expect(await chips.allTextContents()).toEqual(["manager", "alice"]);

    await expect(page.locator(".as-action-form-submit")).toHaveClass(
      /\bas-action-form-submit-error\b/,
    );

    await fillReason(page, "policy review");
    await expect(page.locator('.as-action-form-content input[name="notifyUser"]')).toBeChecked();

    const wire = captureLastPost(page, "/api/db/tables/users/actions/suspend");

    await expectSinglePages(
      page,
      async () => {
        await clickActionFormSubmit(page);
        await expect(page.locator(".as-action-form-content")).toHaveCount(0);
      },
      { table: "users" },
    );

    expect(wire.body()).not.toBeNull();
    const parsed = JSON.parse(wire.body()!) as {
      ids?: Array<Record<string, unknown>>;
      input?: Record<string, unknown>;
    };
    expect(parsed.ids).toEqual([{ username: "manager" }, { username: "alice" }]);
    expect(parsed.input).toEqual({ reason: "policy review", notifyUser: true });

    const toast = await findToast(page, "Suspended 2 users");
    await expect(toast).toHaveClass(/scope-good/);

    await expect.poll(() => userStatus(table, "manager")).toBe("suspended");
    await expect.poll(() => userStatus(table, "alice")).toBe("suspended");

    await clearSelection(page);
  });

  // -------------------------------------------------------------------
  // 8.20 — @DbInputForm validation (MUTATING — admin → suspended)

  test("8.20 — Suspend admin: empty submit + short submit → inline errors; good submit succeeds", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const adminRow = await userRowByName(table, "admin");
    const menu = await openRowActionsMenu(page, adminRow);
    await clickRowMenuItem(menu, "Suspend");

    const form = await awaitActionFormReady(page);

    // Empty submit — `@meta.required 'Reason is required'` fires.
    await clickActionFormSubmit(page);
    await expect(form).toBeVisible();
    const errorSlot = form.locator(".as-error-slot");
    await expect(errorSlot).toHaveText("Reason is required");
    await expect(errorSlot).toHaveAttribute("role", "alert");

    // Short submit (3 chars vs `@expect.minLength 4`).
    await fillReason(page, "abc");
    await clickActionFormSubmit(page);
    await expect(form).toBeVisible();
    await expect(errorSlot).toHaveText("At least 4 characters");

    // Good submit — wire body uses `{ ids: [{ username }], input }`.
    const wire = captureLastPost(page, "/api/db/tables/users/actions/suspend");
    await fillReason(page, "inactive admin");
    await expectSinglePages(
      page,
      async () => {
        await clickActionFormSubmit(page);
        await expect(page.locator(".as-action-form-content")).toHaveCount(0);
      },
      { table: "users" },
    );
    expect(wire.body()).not.toBeNull();
    const parsed = JSON.parse(wire.body()!) as {
      ids?: Array<Record<string, unknown>>;
      input?: Record<string, unknown>;
    };
    // Single-row dispatch via row menu still emits a 1-tuple `ids`
    // array (Suspend is `@DbActionRows` → level 'rows').
    expect(parsed.ids).toEqual([{ username: "admin" }]);
    expect(parsed.input).toEqual({ reason: "inactive admin", notifyUser: true });

    const toast = await findToast(page, "Suspended 1 user");
    await expect(toast).toHaveClass(/scope-good/);

    await expect.poll(() => userStatus(table, "admin")).toBe("suspended");
  });

  // -------------------------------------------------------------------
  // 8.6 — Activate via row menu (MUTATING — bob → active)

  test("8.6 — Open bob's row menu → Activate → POST → toast → row flips to active", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const bobRow = await userRowByName(table, "bob");
    await expect.poll(() => userStatus(table, "bob")).toBe("pending");

    const menu = await openRowActionsMenu(page, bobRow);

    const wire = captureLastPost(page, "/api/db/tables/users/actions/activate");

    await expectSinglePages(
      page,
      async () => {
        await clickRowMenuItem(menu, "Activate");
        await findToast(page, "User bob activated");
      },
      { table: "users" },
    );

    expect(wire.body()).not.toBeNull();
    // level: 'row' → `ids` is an object, not an array.
    expect((JSON.parse(wire.body()!) as { ids?: unknown }).ids).toEqual({ username: "bob" });

    await expect.poll(() => userStatus(table, "bob")).toBe("active");
  });

  // -------------------------------------------------------------------
  // 8.8 — onDisabledRows: 'skip' (MUTATING — bob → suspended)

  test("8.8 — Suspend admin (suspended) + bob (active) + alice (suspended) → only bob processed; admin/alice skipped", async ({
    page,
  }) => {
    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();

    // Confirm inherited state.
    await expect.poll(() => userStatus(table, "admin")).toBe("suspended");
    await expect.poll(() => userStatus(table, "alice")).toBe("suspended");
    await expect.poll(() => userStatus(table, "bob")).toBe("active");

    await toggleSelectMode(page);
    await selectUserCheckbox(table, "admin");
    await selectUserCheckbox(table, "bob");
    await selectUserCheckbox(table, "alice");
    await expect(page.locator(".as-page-selection-count")).toHaveText("3 selected");

    await clickToolbarAction(page, "Suspend");
    const form = await awaitActionFormReady(page);

    // Client-side chip strip carries all 3 selections (skip is server-
    // side). Use the measure clone (always full set) for assertion.
    const measureChips = await form
      .locator(".as-action-form-ids-measure [data-id-chip]")
      .allTextContents();
    expect(measureChips.toSorted()).toEqual(["admin", "alice", "bob"]);

    const wire = captureLastPost(page, "/api/db/tables/users/actions/suspend");

    await fillReason(page, "scheduled cleanup");
    await expectSinglePages(
      page,
      async () => {
        await clickActionFormSubmit(page);
        await expect(page.locator(".as-action-form-content")).toHaveCount(0);
      },
      { table: "users" },
    );

    expect(wire.body()).not.toBeNull();
    const parsed = JSON.parse(wire.body()!) as { ids?: Array<Record<string, unknown>> };
    expect(parsed.ids).toEqual([{ username: "admin" }, { username: "bob" }, { username: "alice" }]);

    // Server reports `Suspended 1 user…` — only bob was eligible.
    const toast = await findToast(page, "Suspended 1 user");
    await expect(toast).toHaveClass(/scope-good/);

    await expect.poll(() => userStatus(table, "bob")).toBe("suspended");
    await expect.poll(() => userStatus(table, "admin")).toBe("suspended");
    await expect.poll(() => userStatus(table, "alice")).toBe("suspended");

    await clearSelection(page);
  });

  // -------------------------------------------------------------------
  // 8.9 — Synthetic __remove (MUTATING — bob deleted)

  test("8.9 — Delete a fresh user via row menu — confirm prompt, DELETE preferredId, toast, row removed", async ({
    page,
  }) => {
    // **Why a fresh user, not bob/alice/etc:** every seeded /users row
    // is FK-referenced by `products.createdById` and/or
    // `orders.assigneeId` — DELETE returns
    // `Cannot delete from "users": referenced by child records (RESTRICT)`,
    // surfacing the global "Server error" dialog rather than the
    // synth-remove toast. Insert a brand-new orphan user via raw HTTP
    // first so the DELETE flow is unblocked. Documented as a
    // demo-seed gap in the hand-off (no orphan user in the seed).
    const ctx = await newRequestContext("admin");
    const username = `delete-target-${Date.now()}`;
    let createdId: number | null = null;
    try {
      const insertResp = await ctx.post("/api/db/tables/users", {
        data: {
          username,
          email: `${username}@demo.test`,
          roleId: 3,
          status: "pending",
          mfaEnabled: false,
          profile: { firstName: "Del", lastName: "User" },
        },
      });
      if (insertResp.status() >= 300) {
        const text = await insertResp.text();
        throw new Error(`insert /users failed: ${insertResp.status()} ${text}`);
      }
      // moost-db's single-insert response: `{ insertedId: <pk> }`.
      const inserted = (await insertResp.json()) as { insertedId?: number };
      if (typeof inserted.insertedId !== "number") {
        throw new Error(`insert /users unexpected body: ${JSON.stringify(inserted)}`);
      }
      createdId = inserted.insertedId;
    } finally {
      await ctx.dispose();
    }

    await gotoTable(page, "users");
    const table = page.locator("table.as-table").first();
    const targetRow = await userRowByName(table, username);

    const idIdx = await columnCellIndex(table, "id");
    const idText = ((await targetRow.locator("td").nth(idIdx).textContent()) ?? "").trim();
    expect(idText).toBe(String(createdId));

    const menu = await openRowActionsMenu(page, targetRow);
    await clickRowMenuItem(menu, "Delete");

    const dialog = page.locator(".as-confirm-dialog-content");
    await expect(dialog).toBeVisible();
    await expect(page.locator(".as-confirm-dialog-body")).toHaveText(`Delete item ${username}?`);
    await expect(page.locator(".as-confirm-dialog-confirm")).toHaveClass(
      /\bas-confirm-dialog-confirm-error\b/,
    );

    let deleteUrl: string | null = null;
    let deleteMethod: string | null = null;
    page.on("request", (req) => {
      const u = req.url();
      if (req.method() === "DELETE" && u.includes("/api/db/tables/users")) {
        deleteUrl = u;
        deleteMethod = req.method();
      }
    });

    await expectSinglePages(
      page,
      async () => {
        await page.locator(".as-confirm-dialog-confirm").click();
        await expect(page.locator(".as-confirm-dialog-content")).toHaveCount(0);
        await findToast(page, "Deleted 1 row(s)");
      },
      { table: "users" },
    );

    // Wire-shape finding (overrides the prompt's "DELETE /:id with PK"
    // guess): db-client `remove({ username })` issues
    // `DELETE /api/db/tables/users?username=<value>` — the
    // **composite-delete** route, NOT the `/users/:id` PK route. The
    // request body is the identifier object passed to `remove()`, which
    // for /users is the row object selected by `rowValueFn`. With
    // `state.rowValueFn = row => row.id` (numeric PK) we'd hit the
    // `:id` route — but `<AsTableRoot>` here is wired with
    // `rowValueFn: r => r.id` → numeric scalar; the synth-remove path
    // collects identifiers via `extractIdentifier(row, preferredId)`
    // which for /users (preferredId = ['username']) renders as
    // `{ username }`. The composite-delete URL is the result.
    //
    // Documented divergence from scenario doc 8.9 step 3 (which says
    // "DELETE /api/db/tables/users/<id> (PK form, NOT preferredId)") —
    // the canonical path is preferredId form via composite delete.
    expect(deleteMethod).toBe("DELETE");
    expect(deleteUrl).not.toBeNull();
    // Composite-delete URL carries the preferredId field as a query
    // param. URL-encoded value matches the username we created.
    expect(deleteUrl!).toMatch(/\/api\/db\/tables\/users\?username=delete-target-\d+/u);

    // Row is gone after the auto-refetch.
    const targetRowAfter = table
      .locator("tbody tr")
      .filter({ has: page.locator(`xpath=./td[normalize-space(.)="${username}"]`) });
    await expect(targetRowAfter).toHaveCount(0);
  });
});
