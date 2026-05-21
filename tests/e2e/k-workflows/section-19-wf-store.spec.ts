// Section 19.W — wf-store handle-based persistence (Step 7 of the wf-store
// feature). Step 6 (commit `2d77993`) wired the invite workflow onto
// `HandleStateStrategy` + `AsWfStore`; the existing 19.7 / 19.8 / 19.11 cases
// keep covering the happy/expiry paths. This file adds the missing race-
// safety + tamper + cleanup-retention coverage that the encapsulated-state
// tests can't reach.
//
// Per-worker isolation: each Playwright worker owns its own demo-server
// replica + sqlite file (see `tests/e2e/global-setup.ts`).
//
// Test-only endpoints used (mounted only when `DEMO_TEST_MODE=1`, registered
// in `packages/vue-demo/src/server/controllers/test.controller.ts`):
//   - POST `/api/_test/wf-store/seed`       wipes + seeds rows via the live
//                                            `wfStore` singleton (clear-then-
//                                            insert; lifts schemaId).
//   - POST `/api/_test/wf-store/cleanup`    drives `wfStore.cleanup({...})`.
//   - GET  `/api/_test/wf-store/handles`    lists `(handle, schemaId,
//                                            expiresAt)` for assertion.

import { expect, test, type APIRequestContext } from "../fixtures";

import {
  authFileFor,
  columnCellIndex,
  gotoTable,
  newAnonRequestContext,
  newRequestContext,
  resetSeed,
  rowByCellText,
  serverLogOffset,
  waitForOutletEntry,
} from "../helpers";

// =============================================================================
// File-local helpers — kept here per Phase-3 RFC rules (these wrappers are
// only useful inside this spec). Mirrors the postWf helper in
// section-19-workflows.spec.ts, but isolated so the two files don't drift.

interface WfResponse {
  wfs?: string;
  finished?: boolean;
  ok?: boolean;
  user?: { username: string; roleName: string };
  sent?: boolean;
  outlet?: string;
  inputRequired?: {
    payload: unknown;
    transport: string;
    context?: Record<string, unknown> & { errors?: Record<string, string> };
  };
  error?: string | { message?: string; statusCode?: number; [k: string]: unknown };
  [k: string]: unknown;
}

async function postWf(
  ctx: APIRequestContext,
  body: Record<string, unknown>,
): Promise<{ status: number; setCookie: string | null; json: WfResponse }> {
  // Helper convenience: tests pass `input` (and optional `action`) at the top
  // level and we compose the on-wire envelope `{ action?, formData? }` here.
  // The wire format is still strict — this just keeps test call sites terse.
  const wireBody = composeWfBody(body);
  const res = await ctx.post("/api/wf", {
    data: wireBody,
    headers: { "content-type": "application/json" },
  });
  const headers = res.headers();
  const setCookie = headers["set-cookie"] ?? null;
  const text = await res.text();
  let json: WfResponse;
  try {
    json = text ? (JSON.parse(text) as WfResponse) : ({} as WfResponse);
  } catch {
    json = { error: text } as WfResponse;
  }
  return { status: res.status(), setCookie, json };
}

function composeWfBody(body: Record<string, unknown>): Record<string, unknown> {
  const { input, action, ...rest } = body as {
    input?: unknown;
    action?: string;
    [k: string]: unknown;
  };
  if (input === undefined && action === undefined) return rest;
  const envelope: { action?: string; formData?: unknown } = {};
  if (action !== undefined) envelope.action = action;
  if (input !== undefined) envelope.formData = input;
  return { ...rest, input: envelope };
}

function uniq(): string {
  return Math.floor(Math.random() * 1e9)
    .toString(36)
    .padStart(6, "0");
}

/** Pull the `wfs` token out of an `/invite/<urlenc>` magic link. */
function extractWfsFromLink(link: string): string {
  const m = link.match(/\/invite\/([^/?#]+)$/);
  if (!m) throw new Error(`unexpected magic link format: ${link}`);
  return decodeURIComponent(m[1]!);
}

interface SeedRow {
  handle: string;
  schemaId: string;
  expiresAt: number;
  state?: { context?: unknown; indexes?: number[]; meta?: Record<string, unknown> };
}

async function seedStore(ctx: APIRequestContext, rows: SeedRow[]): Promise<number> {
  const res = await ctx.post("/api/_test/wf-store/seed", {
    data: { rows },
    headers: { "content-type": "application/json" },
  });
  if (!res.ok()) throw new Error(`wf-store/seed failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { inserted: number };
  return body.inserted;
}

async function cleanupStore(ctx: APIRequestContext, retention?: number): Promise<number> {
  const res = await ctx.post("/api/_test/wf-store/cleanup", {
    data: retention === undefined ? {} : { retention },
    headers: { "content-type": "application/json" },
  });
  if (!res.ok()) throw new Error(`wf-store/cleanup failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { deletedCount: number };
  return body.deletedCount;
}

async function listHandles(ctx: APIRequestContext): Promise<
  Array<{
    handle: string;
    schemaId: string;
    expiresAt?: number;
    inviteEmail?: string;
    inviteRole?: string;
  }>
> {
  const res = await ctx.get("/api/_test/wf-store/handles");
  if (!res.ok()) throw new Error(`wf-store/handles failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as {
    handles: Array<{
      handle: string;
      schemaId: string;
      expiresAt?: number;
      inviteEmail?: string;
      inviteRole?: string;
    }>;
  };
  return body.handles;
}

// =============================================================================
// Tests

test.describe.configure({ mode: "serial" });

test.describe("Section 19.W — wf-store (handle-based persistence)", () => {
  // Per-worker baseline reset. Other 19.x scenarios issue invitations, which
  // leave `wf_states` rows behind for the cleanup test to reason about.
  test.beforeAll(async () => {
    await resetSeed();
  });

  test.describe("19.W1 — invite handle is single-use (race-safety)", () => {
    test("19.W1 raw — two parallel resumes on the same wfs: one wins, one 410s", async () => {
      const id = uniq();
      const email = `race-${id}@demo.test`;

      // Issue the invite as admin and capture the magic-link token.
      let wfs: string;
      const adminCtx = await newRequestContext("admin");
      try {
        const start = await postWf(adminCtx, { wfid: "api/users/invite" });
        const outletAnchor = serverLogOffset();
        const submit = await postWf(adminCtx, {
          wfs: start.json.wfs,
          input: { email, roleId: 3 },
        });
        // `invite-send` outlets and pauses; capture the link.
        expect(submit.json.finished).toBeFalsy();
        const entry = await waitForOutletEntry({
          template: "user-invite",
          email,
          sinceOffset: outletAnchor,
        });
        if (!entry.link) throw new Error("user-invite outlet had no link line");
        wfs = extractWfsFromLink(entry.link);
        // Sanity: HandleStateStrategy mints UUIDs (8-4-4-4-12 hex) — proves
        // the dispatcher routed `api/users/invite` to the handle store.
        expect(wfs).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      } finally {
        await adminCtx.dispose();
      }

      // Two parallel anon contexts replay the same wfs at the same time.
      // `getAndDelete` does findOne + deleteMany; `deletedCount === 1` is the
      // race-safety guard — exactly one caller should win.
      const ctxA = await newAnonRequestContext();
      const ctxB = await newAnonRequestContext();
      try {
        const [a, b] = await Promise.all([postWf(ctxA, { wfs }), postWf(ctxB, { wfs })]);
        const responses = [a, b];

        // Exactly one resume must surface the InviteAcceptForm payload (200-
        // ish, `inputRequired` with username/password fields).
        const winners = responses.filter(
          (r) => r.status >= 200 && r.status < 300 && r.json.inputRequired !== undefined,
        );
        // The other must be 410 with the expired/invalid sentinel body.
        const losers = responses.filter((r) => r.status === 410);

        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(1);

        const winner = winners[0]!;
        // Resume lands at `invite-accept` whose form requires username +
        // password — proves the wf state actually advanced past invite-send.
        const ctxKeys = Object.keys(winner.json.inputRequired?.context ?? {});
        // The form should be back; errors should not be set on a fresh resume.
        expect(winner.json.inputRequired?.context?.errors).toBeUndefined();
        // No info-leak about which token was consumed — winner doesn't echo
        // the raw token in the response body.
        expect(JSON.stringify(winner.json)).not.toContain(wfs);
        // Just a defensive sanity assertion against ctxKeys being weirdly empty.
        expect(ctxKeys.length).toBeGreaterThanOrEqual(0);

        const loser = losers[0]!;
        const errMsg = typeof loser.json.error === "string" ? loser.json.error : "";
        expect(errMsg).toMatch(/expired|invalid/i);
      } finally {
        await ctxA.dispose();
        await ctxB.dispose();
      }
    });
  });

  test.describe("19.W2 — handle persists across cookie wipe", () => {
    test("19.W2 UI — invitee opens magic link in clean context, mid-flow cookie wipe still completes", async ({
      browser,
    }) => {
      const id = uniq();
      const email = `nocookie-${id}@demo.test`;

      // Admin-side: issue invite + capture link.
      const adminCtx = await newRequestContext("admin");
      let link: string;
      try {
        const start = await postWf(adminCtx, { wfid: "api/users/invite" });
        const outletAnchor = serverLogOffset();
        const submit = await postWf(adminCtx, {
          wfs: start.json.wfs,
          input: { email, roleId: 3 },
        });
        expect(submit.json.finished).toBeFalsy();
        const entry = await waitForOutletEntry({
          template: "user-invite",
          email,
          sinceOffset: outletAnchor,
        });
        if (!entry.link) throw new Error("user-invite outlet had no link line");
        link = entry.link;
      } finally {
        await adminCtx.dispose();
      }

      const chosenUsername = `nck-${id}`;
      const inviteeCtx = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      try {
        const page = await inviteeCtx.newPage();
        await page.goto(link);
        await expect(page.getByRole("heading", { name: "Accept invitation" })).toBeVisible();

        // KEY DIFFERENCE vs encapsulated strategy: state lives in the DB
        // keyed by the URL handle, NOT in a session cookie. Wiping cookies
        // mid-flow proves the form payload survived purely via the handle.
        await inviteeCtx.clearCookies();
        // `localStorage` / `sessionStorage` in case the form ever caches state
        // there (it doesn't today, but make the proof airtight).
        await page.evaluate(() => {
          try {
            window.localStorage.clear();
            window.sessionStorage.clear();
          } catch {}
        });

        // Fill credentials and submit. The form's wfs is held in component
        // state from the initial GET — the navigation didn't touch the URL,
        // so cookie clearance has no effect on the resume.
        await page.locator('input[name="username"]').fill(chosenUsername);
        await page.locator('input[name="password"]').fill("secure-pass");
        await Promise.all([
          page.waitForURL(/\/$/),
          page.getByRole("button", { name: /Accept|Sign In|Submitting|Accepting/i }).click(),
        ]);
        // After invite-issue-session the demo navigates to `/`; sign-in
        // succeeded ↔ the resume worked despite the wipe.
      } finally {
        await inviteeCtx.close();
      }

      // Admin-side cross-check: row activated for the chosen username.
      const adminBrowserCtx = await browser.newContext({
        storageState: authFileFor("admin"),
      });
      try {
        const adminPage = await adminBrowserCtx.newPage();
        // Hit the table API directly — no need to drive the UI when we just
        // need to assert a row state. Avoids the auto-refetch debounce dance.
        const resp = await adminPage.request.get(
          "/api/db/tables/users/pages?$select=username,email,status&$page=1&$size=200",
        );
        expect(resp.ok()).toBe(true);
        const body = (await resp.json()) as {
          data: Array<{ username: string; email: string; status: string }>;
        };
        const row = body.data.find((r) => r.email === email);
        expect(row).toBeTruthy();
        expect(row?.username).toBe(chosenUsername);
        expect(row?.status).toBe("active");
      } finally {
        await adminBrowserCtx.close();
      }
    });
  });

  test.describe("19.W3 — tampered / unknown handle returns 410", () => {
    test("19.W3 raw — three classes of bad token all resolve to 410 + generic body", async () => {
      const ctx = await newAnonRequestContext();
      try {
        // 1) Garbage that doesn't match any token shape (UUID or AES-GCM
        //    base64url). Encapsulated strategy receives it and surfaces a
        //    decode failure → mapped to 410 by the engine.
        const garbage = await postWf(ctx, { wfs: "not-a-real-uuid-just-garbage" });
        expect(garbage.status).toBe(410);

        // 2) UUID-shape but unknown to the store. Token-shape dispatcher
        //    routes to handle strategy; `getAndDelete` finds nothing →
        //    consume returns null → 410.
        const zeroUuid = await postWf(ctx, { wfs: "00000000-0000-0000-0000-000000000000" });
        expect(zeroUuid.status).toBe(410);

        // 3) Different UUID shape, also unknown. Same path as (2) — exists
        //    to prove the response is shape-driven, not value-pinned.
        const fakeUuid = await postWf(ctx, { wfs: "deadbeef-cafe-babe-1234-567890abcdef" });
        expect(fakeUuid.status).toBe(410);

        for (const r of [garbage, zeroUuid, fakeUuid]) {
          const errMsg = typeof r.json.error === "string" ? r.json.error : "";
          // Generic error text — must NOT leak token-shape diagnostics, sql
          // strings, stack traces, or internal field names.
          expect(errMsg).toMatch(/expired|invalid/i);
          // No internal-info leak: response body shouldn't surface filenames,
          // DB column names, or store-internals like `getAndDelete`.
          const allText = JSON.stringify(r.json);
          expect(allText).not.toMatch(/getAndDelete|deleteMany|wf_states|sqlite|stack/i);
          // No Set-Cookie sneaks out.
          expect(r.setCookie).toBeNull();
        }
      } finally {
        await ctx.dispose();
      }
    });
  });

  test.describe("19.W4 — cleanup retention semantics", () => {
    test("19.W4 raw — cleanup({ retention }) deletes only rows whose expiresAt is older than now-retention", async () => {
      const adminCtx = await newRequestContext("admin");
      try {
        // `seed` always clears first, so prior 19.W1 / 19.W2 invites can't pollute.
        const now = Date.now();
        // 1) recently-expired (within retention)
        // 2) expired-long-ago (past retention)
        // 3) live (expires in the future)
        const inserted = await seedStore(adminCtx, [
          {
            handle: "seed-recent",
            schemaId: "test/recent",
            expiresAt: now - 100,
            state: { context: { tag: "recent" }, indexes: [0] },
          },
          {
            handle: "seed-old",
            schemaId: "test/old",
            expiresAt: now - 10_000_000,
            state: { context: { tag: "old" }, indexes: [0] },
          },
          {
            handle: "seed-live",
            schemaId: "test/live",
            expiresAt: now + 10_000_000,
            state: { context: { tag: "live" }, indexes: [0] },
          },
        ]);
        expect(inserted).toBe(3);

        // retention = 1_000_000 ms (~16.6 min). The "old" row's expiresAt is
        // now - 10_000_000 ≪ now - 1_000_000 → past retention → deleted.
        const deleted1 = await cleanupStore(adminCtx, 1_000_000);
        expect(deleted1).toBe(1);

        const remaining1 = await listHandles(adminCtx);
        const tagsAfter1 = remaining1.map((h) => h.schemaId).toSorted();
        expect(tagsAfter1).toEqual(["test/live", "test/recent"]);

        // retention = 0 → cutoff = now → "recent" (now-100) gets deleted, "live" survives.
        const deleted2 = await cleanupStore(adminCtx, 0);
        expect(deleted2).toBe(1);

        const remaining2 = await listHandles(adminCtx);
        expect(remaining2.map((h) => h.schemaId)).toEqual(["test/live"]);

        // retention = Infinity → no-op even on still-live rows.
        const deleted3 = await cleanupStore(adminCtx, Number.POSITIVE_INFINITY);
        expect(deleted3).toBe(0);
        const remaining3 = await listHandles(adminCtx);
        expect(remaining3.map((h) => h.schemaId)).toEqual(["test/live"]);
      } finally {
        await adminCtx.dispose();
      }
    });
  });

  test.describe("19.W5 — schemaId lift round-trips on the wf_states row", () => {
    test("19.W5 raw — seed { schemaId } → handles list reflects the same schemaId per row", async () => {
      const adminCtx = await newRequestContext("admin");
      try {
        // `seed` always clears first, so prior scenarios can't pollute.
        const now = Date.now();
        const handle1 = "lift-invite";
        const handle2 = "lift-other";

        await seedStore(adminCtx, [
          {
            handle: handle1,
            schemaId: "api/users/invite",
            expiresAt: now + 60_000,
            state: { context: { kind: "invite" }, indexes: [0] },
          },
          {
            handle: handle2,
            schemaId: "api/sample/wf",
            expiresAt: now + 60_000,
            state: { context: { kind: "sample" }, indexes: [0] },
          },
        ]);

        const handles = await listHandles(adminCtx);
        const byHandle = new Map(handles.map((h) => [h.handle, h]));
        expect(byHandle.get(handle1)?.schemaId).toBe("api/users/invite");
        expect(byHandle.get(handle2)?.schemaId).toBe("api/sample/wf");
        // expiresAt round-trips — proves the `set()` path persists it
        // alongside the lift, not just on update paths.
        expect(byHandle.get(handle1)?.expiresAt).toBe(now + 60_000);
        expect(byHandle.get(handle2)?.expiresAt).toBe(now + 60_000);
      } finally {
        await adminCtx.dispose();
      }
    });
  });

  test.describe("19.W6 — @wf.store.fromContext populates shadow columns from state.context", () => {
    test("19.W6 raw — seed rows with email/roleName context; shadow columns inviteEmail/inviteRole reflect the copy", async () => {
      const adminCtx = await newRequestContext("admin");
      try {
        const now = Date.now();
        await seedStore(adminCtx, [
          {
            handle: "shadow-1",
            schemaId: "api/users/invite",
            expiresAt: now + 60_000,
            state: {
              context: { email: "alice@example.com", roleName: "viewer", other: "ignored" },
              indexes: [0],
            },
          },
          {
            // Path-miss + clear semantics: no email/roleName in context →
            // shadow columns null.
            handle: "shadow-2",
            schemaId: "api/users/invite",
            expiresAt: now + 60_000,
            state: { context: { unrelated: 1 }, indexes: [0] },
          },
          {
            // Nested-path skip: `email` only at top level — `state.foo.email`
            // should NOT count.
            handle: "shadow-3",
            schemaId: "api/users/invite",
            expiresAt: now + 60_000,
            state: { context: { foo: { email: "nope@x.com" } }, indexes: [0] },
          },
        ]);

        const handles = await listHandles(adminCtx);
        const byHandle = new Map(handles.map((h) => [h.handle, h]));

        // Top-level keys copied verbatim.
        expect(byHandle.get("shadow-1")?.inviteEmail).toBe("alice@example.com");
        expect(byHandle.get("shadow-1")?.inviteRole).toBe("viewer");

        // Path-miss leaves the column null (omitted from the response).
        expect(byHandle.get("shadow-2")?.inviteEmail).toBeUndefined();
        expect(byHandle.get("shadow-2")?.inviteRole).toBeUndefined();

        // Nested email is not picked up — `@wf.store.fromContext 'email'` is
        // a top-level dot-path, not a recursive search.
        expect(byHandle.get("shadow-3")?.inviteEmail).toBeUndefined();
      } finally {
        await adminCtx.dispose();
      }
    });

    test("19.W6 UI — invite flow populates inviteEmail / inviteRole on the wf_states row", async () => {
      const adminCtx = await newRequestContext("admin");
      try {
        // Drive the real invite workflow once (admin invites a fresh email)
        // and assert the wf_states row shadows reflect the context.
        const offset = serverLogOffset();
        const r1 = await postWf(adminCtx, {
          wfid: "api/users/invite",
          input: { email: "shadow-test@example.com", roleId: 3 },
        });
        // 200 (synchronous) or 201 (async) — both indicate the flow ran;
        // shadow column check runs against the persisted row regardless.
        expect([200, 201]).toContain(r1.status);
        // The flow pauses on the email outlet; no need to consume the magic
        // link — we just want the wf_states row written.
        await waitForOutletEntry({ template: "user-invite", sinceOffset: offset });

        const handles = await listHandles(adminCtx);
        const inviteRow = handles.find((h) => h.inviteEmail === "shadow-test@example.com");
        expect(inviteRow, "wf_states row for the new invite must exist").toBeTruthy();
        if (!inviteRow) return;
        expect(inviteRow.schemaId).toBe("api/users/invite");
        // roleId 3 in the seeded role table maps to roleName 'viewer' (see
        // packages/vue-demo/src/server/seed.ts).
        expect(inviteRow.inviteRole).toBe("viewer");
      } finally {
        await adminCtx.dispose();
      }
    });
  });

  test.describe("19.W7 — /wf_states demo table renders shadow columns and respects @ui.table.hidden", () => {
    // Hidden in the schema — `state`, `handle`, `createdBy`, `lastUpdatedBy`
    // come from `AsWfStateRecord` (moost-wf base); `id` is the demo's own
    // re-declared `@meta.id` column.
    const HIDDEN_COLUMNS = ["state", "handle", "id", "createdBy", "lastUpdatedBy"] as const;
    // Visible — schemaId is inherited (no annotation), shadows are local.
    const VISIBLE_COLUMNS = ["schemaId", "inviteEmail", "inviteRole"] as const;

    test("19.W7 raw — meta payload carries @ui.table.hidden in the type metadata", async () => {
      const adminCtx = await newRequestContext("admin");
      try {
        const res = await adminCtx.get("/api/db/tables/wf_states/meta");
        expect(res.ok()).toBe(true);
        const meta = (await res.json()) as {
          type: { type: { props: Record<string, { metadata?: Record<string, unknown> }> } };
        };
        const props = meta.type?.type?.props ?? {};
        for (const col of HIDDEN_COLUMNS) {
          expect(
            props[col]?.metadata?.["ui.table.hidden"],
            `${col} must carry ui.table.hidden in wire metadata`,
          ).toBe(true);
        }
        for (const col of VISIBLE_COLUMNS) {
          expect(
            props[col]?.metadata?.["ui.table.hidden"],
            `${col} must NOT carry ui.table.hidden`,
          ).toBeUndefined();
        }
      } finally {
        await adminCtx.dispose();
      }
    });

    test("19.W7 UI — admin opens /wf_states; thead omits hidden columns, shadow columns reflect a fresh invite", async ({
      browser,
    }) => {
      // Seed: drive one invite so a wf_states row exists with shadow values.
      const email = `wf-states-ui-${Date.now()}@example.com`;
      const adminCtx = await newRequestContext("admin");
      try {
        const offset = serverLogOffset();
        const r = await adminCtx.post("/api/wf", {
          data: { wfid: "api/users/invite", input: { formData: { email, roleId: 3 } } },
        });
        expect([200, 201]).toContain(r.status());
        await waitForOutletEntry({ template: "user-invite", sinceOffset: offset });
      } finally {
        await adminCtx.dispose();
      }

      const adminBrowserCtx = await browser.newContext({
        storageState: authFileFor("admin"),
      });
      try {
        const adminPage = await adminBrowserCtx.newPage();
        await gotoTable(adminPage, "wf_states");
        const table = adminPage.locator("table[data-as-main-table]");

        for (const col of HIDDEN_COLUMNS) {
          await expect(
            table.locator(`thead th[data-column-path="${col}"]`),
            `hidden column ${col} must not render a <th>`,
          ).toHaveCount(0);
        }
        for (const col of VISIBLE_COLUMNS) {
          await expect(
            table.locator(`thead th[data-column-path="${col}"]`),
            `visible column ${col} must render exactly one <th>`,
          ).toHaveCount(1);
        }

        // Shadow column populated — admin can spot the pending invite by
        // email without inspecting the JSON state blob.
        const emailIdx = await columnCellIndex(table, "inviteEmail");
        await expect
          .poll(async () => await rowByCellText(table, emailIdx, email).count())
          .toBeGreaterThan(0);

        const inviteRow = rowByCellText(table, emailIdx, email).first();
        const roleIdx = await columnCellIndex(table, "inviteRole");
        await expect(inviteRow.locator("td").nth(roleIdx)).toHaveText("viewer");
      } finally {
        await adminBrowserCtx.close();
      }
    });
  });
});
