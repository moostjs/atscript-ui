// Section 20 — Framework rigidity / security (scenarios 20.1–20.21).
//
// Single-file collapse + serial mode: the section's sub-batches mutate
// shared SQLite state (resetSeed, preset inserts, audit-log writes).
// Multiple resetSeed() calls racing across worker files trip
// "cannot start a transaction within a transaction", so we pin to ONE
// worker and one resetSeed in beforeAll. Tests do not reset between
// each other — each queries a baseline before asserting.
//
// Wire shapes (verified against the demo dev server):
//   - ActionDisabledError → 409 { name, action, id?|ids?, statusCode, message }.
//     (Scenario doc says "400 or 403"; actual contract is 409.)
//   - ARBAC denial → 403 { message: "Insufficient privileges …", error: "Forbidden" }.
//   - InputForm validation → 500 { message: "<field>: <ValidatorError>" }.
//     `@UseValidationErrorTransform()` lives on AsReadableController only;
//     action endpoints inherit it via @Inherit() but the validator pipe error
//     bubbles past the catch interceptor. SECURITY FINDING.
//   - Identifier strict-mode failure → same 500 path. Bare scalars / non-array
//     ids → "Expected JSON array of identifier objects". Unknown-keyed objects
//     → "[N]: Identifier fields must exactly match one of: [id], [username], [email]".
//   - Cross-table action → 404 (HTML body — endpoint bound per controller).
//   - Preset CRUD endpoints: NO trailing slash (`/api/db/_presets`). Insert
//     response is `{ insertedId }`, not `{ id }`.
//   - Reserved-id POST/PATCH/DELETE → 400 code "reserved_id".
//   - Cross-user PATCH/DELETE → 404 code "preset_not_found" (no existence leak).
//   - canPublish denial → 403 code "publish_forbidden".
//   - Public-label collision → 409 code "public_name_conflict".
//   - insertMany on _presets → 405 code "action_unsupported".
//   - Per-user cap → 409 code "preset_limit_reached" + { limit, count }.
//   - Identity scrub: extra fields (public/label/publicLabel/aspects) stored
//     as null on appConf rows; readback returns them as explicit nulls.
//   - /query scope: `app` always required, `tableKey` required when
//     type ≠ 'appConf'; missing → 400 code "missing_scope".
//   - Login Set-Cookie: `demo.sid=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`.
//   - SessionGuard miss → 401 ("No authentication credentials provided" /
//     "Not authenticated").
//
// Open security findings (see hand-off summary):
//   1. ValidatorError on action endpoints leaks 500 instead of 400.
//   2. `/api/db/_presets/one/:id` bypasses the read-gate (uses findById
//      directly without transformFilter) — viewer can fetch any preset by id.
//   3. JSON-column FILTER on customers.address silently 200s instead of 400
//      (sort path correctly rejects). Demo's customers table lacks
//      @db.table.filterable 'manual' so the filter never gates.
//
// Mutation chain across this file (admin / manager / viewer contexts):
//   20.1.a  activate(admin)              → 409 (already active)
//   20.1.b  suspend(viewer)              → ok ; replay → 409
//   20.1.c  resend-invite(admin)         → 409
//   20.16   activate(bob)                → ok ; replay → 409
//   20.10   appConf POST                 → admin row inserted
//   20.11   viewer × 10 inserts on products  → cap-fill ; 11th → 409
//   20.21   suspend(manager)             → audit_log gains 1 row
// Bob is gate-flipped to active in 20.16; downstream tests must not assume
// bob is still pending.

import { expect, test, type APIRequestContext } from "../fixtures";

import { newAnonRequestContext, newRequestContext, resetSeed } from "../helpers";

interface InsertResp {
  insertedId?: string;
  id?: string;
}

async function savePreset(
  ctx: APIRequestContext,
  data: {
    app?: string;
    tableKey?: string;
    public?: boolean;
    label: string;
    type?: "preset" | "userConf" | "appConf";
  },
): Promise<string> {
  const res = await ctx.post("/api/db/_presets", {
    data: {
      type: data.type ?? "preset",
      app: data.app ?? "vuedemo",
      tableKey: data.tableKey ?? "users",
      public: data.public ?? false,
      data: { label: data.label, content: {} },
    },
  });
  expect(res.ok(), `savePreset ${data.label} failed: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as InsertResp;
  const id = body.insertedId ?? body.id;
  if (!id) throw new Error(`savePreset: missing insertedId in response: ${JSON.stringify(body)}`);
  return id;
}

test.describe.configure({ mode: "serial" });

test.describe("Section 20 — Framework rigidity / security (single-file batch)", () => {
  test.beforeAll(async () => {
    await resetSeed();
  });

  // 20.10's appConf row is `{ data: { appearance: 'dark' } }` (no `content`
  // key). Demo UI reads `data.content.columns` unconditionally on table
  // pages and 500s if the row leaks into an unrelated test run. Reset on
  // teardown so downstream batches inherit a clean baseline.
  test.afterAll(async () => {
    await resetSeed();
  });

  // 20.1 — Disabled action: direct POST is rejected (ActionDisabledError).

  test("20.1 — POST activate against an already-active user → 409 ActionDisabledError", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/activate", {
        data: { ids: { username: "admin" } },
      });
      expect(res.status()).toBe(409);
      const body = (await res.json()) as {
        name?: string;
        action?: string;
        id?: Record<string, unknown>;
      };
      expect(body.name).toBe("ActionDisabledError");
      expect(body.action).toBe("activate");
      expect(body.id).toEqual({ username: "admin" });

      const verify = await ctx.get("/api/db/tables/users/one?username=admin");
      const row = (await verify.json()) as { status?: string };
      expect(row.status).toBe("active");
    } finally {
      await ctx.dispose();
    }
  });

  test("20.1 — POST suspend against already-suspended user → 409", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const first = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: { ids: [{ username: "viewer" }], input: { reason: "first run" } },
      });
      expect(first.ok()).toBeTruthy();
      const second = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: { ids: [{ username: "viewer" }], input: { reason: "replay" } },
      });
      expect(second.status()).toBe(409);
      const body = (await second.json()) as { name?: string; action?: string };
      expect(body.name).toBe("ActionDisabledError");
      expect(body.action).toBe("suspend");
    } finally {
      await ctx.dispose();
    }
  });

  test("20.1 — POST resend-invite against active user → 409 (gate `status !== 'invited'`)", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/resend-invite", {
        data: { ids: { username: "admin" }, input: {} },
      });
      expect(res.status()).toBe(409);
      const body = (await res.json()) as { name?: string };
      expect(body.name).toBe("ActionDisabledError");
    } finally {
      await ctx.dispose();
    }
  });

  // 20.2 — ARBAC role gate.

  test("20.2 — viewer POST users.suspend → 403", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: { ids: [{ username: "alice" }], input: { reason: "evil-test" } },
      });
      expect(res.status()).toBe(403);
      const body = (await res.json()) as { message?: string };
      expect(body.message).toContain("Insufficient privileges");
    } finally {
      await ctx.dispose();
    }
  });

  test("20.2 — viewer's /meta does NOT expose suspend/activate/resend-invite actions", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      const res = await ctx.get("/api/db/tables/users/meta");
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        actions?: Array<{ name?: string }>;
      };
      const names = (body.actions ?? []).map((a) => a.name);
      expect(names).not.toContain("suspend");
      expect(names).not.toContain("activate");
      expect(names).not.toContain("resend-invite");
    } finally {
      await ctx.dispose();
    }
  });

  // 20.3 — Column-level narrow on $select.

  test("20.3 — viewer's $select drops password/salt server-side", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      const res = await ctx.get(
        "/api/db/tables/users/pages?$select=id,username,password,salt&$size=2",
      );
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      const rows = body.data ?? [];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row).not.toHaveProperty("password");
        expect(row).not.toHaveProperty("salt");
      }
    } finally {
      await ctx.dispose();
    }
  });

  test("20.3 — admin's $select returns password/salt verbatim (admin scope = unrestricted)", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.get(
        "/api/db/tables/users/pages?$select=id,username,password,salt&$size=1",
      );
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      const rows = body.data ?? [];
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const row = rows[0];
      expect(row).toHaveProperty("password");
      expect(row).toHaveProperty("salt");
      expect(typeof row.password).toBe("string");
      expect((row.password as string).length).toBeGreaterThan(0);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.3 — viewer's /meta drops fields outside the column allow-list", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      const res = await ctx.get("/api/db/tables/users/meta");
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        fields?: Record<string, unknown>;
      };
      const fields = Object.keys(body.fields ?? {});
      expect(fields).toEqual(expect.arrayContaining(["id", "username", "status"]));
      expect(fields).not.toContain("password");
      expect(fields).not.toContain("salt");
      expect(fields).not.toContain("email");
    } finally {
      await ctx.dispose();
    }
  });

  // 20.4 — Schema validation on @InputForm payload. ValidatorError throws
  // from `validatorPipe()` arg-resolve are caught by the global
  // `validationErrorTransform()` interceptor → HTTP 400 + structured `_body`.

  test("20.4 — InputForm payload with wrong type is rejected", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: { ids: [{ username: "bob" }], input: { reason: 42 } },
      });
      expect(res.status()).toBe(400);
      const body = (await res.json()) as { message?: string; _body?: unknown };
      expect(body.message).toMatch(/reason/i);
      expect(body._body).toBeDefined();
    } finally {
      await ctx.dispose();
    }
  });

  test("20.4 — InputForm payload below @expect.minLength is rejected", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: { ids: [{ username: "bob" }], input: { reason: "x" } },
      });
      expect(res.status()).toBe(400);
      const body = (await res.json()) as { message?: string };
      expect(body.message).toMatch(/reason|At least/i);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.4 — InputForm payload missing required field is rejected", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: { ids: [{ username: "bob" }], input: { sneakyAdmin: true } },
      });
      expect(res.status()).toBe(400);
    } finally {
      await ctx.dispose();
    }
  });

  // 20.5 — DEFERRED: demo's forceFilters is client-only; server enforcement
  // would require an applyMetaOverlay override that isn't wired.
  test.skip("20.5 — forceFilters server-side enforcement [DEFERRED]", () => {});

  // 20.6 — Preset isolation read.

  test("20.6 — viewer's /query does NOT include manager's private preset", async () => {
    const adminCtx = await newRequestContext("admin");
    const managerCtx = await newRequestContext("manager");
    const viewerCtx = await newRequestContext("viewer");
    try {
      const presetId = await savePreset(managerCtx, {
        tableKey: "orders",
        label: "Manager view",
      });

      const adminList = await adminCtx.get("/api/db/_presets/query?app=vuedemo&tableKey=orders");
      expect(adminList.ok()).toBeTruthy();
      const adminRows = (await adminList.json()) as Array<{ id?: string }>;
      expect(adminRows.map((r) => r.id)).not.toContain(presetId);

      const viewerList = await viewerCtx.get("/api/db/_presets/query?app=vuedemo&tableKey=orders");
      expect(viewerList.ok()).toBeTruthy();
      const viewerRows = (await viewerList.json()) as Array<{ id?: string }>;
      expect(viewerRows.map((r) => r.id)).not.toContain(presetId);
    } finally {
      await adminCtx.dispose();
      await managerCtx.dispose();
      await viewerCtx.dispose();
    }
  });

  // Originally a SECURITY FINDING (#1 in atscript-db SECURITY_REPORT) — the
  // read-gate overlay was missing on the findById path, so `/one/:id` leaked
  // any preset by id. Fixed in `@atscript/moost-db@0.1.69`.
  test("20.6 — GET /api/db/_presets/one/<other-user-id> closes leak (no row in body)", async () => {
    const managerCtx = await newRequestContext("manager");
    const viewerCtx = await newRequestContext("viewer");
    try {
      const presetId = await savePreset(managerCtx, {
        tableKey: "orders",
        label: "Manager direct-fetch",
      });
      // Narrow projection bypasses the unrelated reconstructNullParent
      // null-deref noise on the default `$select`. Either way, the gate
      // must reject the row regardless of projection.
      // Pre-fix: this returned HTTP 200 with the manager's row (read-gate
      // wasn't applied to `findById`). Post-fix: moost-db routes /one/:id
      // through `transformOne()` which delegates to `transformFilter()`,
      // and `AsPresetsController.transformFilter` requires `app` /
      // `tableKey` in the filter for scope isolation. The /one/:id route
      // doesn't accept URL filter params (returns 400 "Filtering is not
      // allowed for one endpoint"), so the leak path is now closed: a
      // probe without scope params can't reach the row at all.
      const res = await viewerCtx.get(
        `/api/db/_presets/one/${encodeURIComponent(presetId)}?$select=id,user,label`,
      );
      // Either 400 (filter required by overlay can't be carried via URL)
      // or 404 (overlay applies and row hidden). Both close the leak;
      // 200 (the pre-fix shape) is the failure mode.
      expect([400, 404]).toContain(res.status());
      // And under no circumstances should the body carry manager's row.
      const body = await res.text();
      expect(body).not.toMatch(/Manager direct-fetch/);
      expect(body).not.toMatch(/"user":\s*"manager"/);
    } finally {
      await managerCtx.dispose();
      await viewerCtx.dispose();
    }
  });

  // 20.7 — Preset edit/delete by non-owner is rejected.

  test("20.7 — viewer PATCH on manager's preset → 404 preset_not_found", async () => {
    const managerCtx = await newRequestContext("manager");
    const viewerCtx = await newRequestContext("viewer");
    try {
      const presetId = await savePreset(managerCtx, {
        tableKey: "orders",
        label: "Manager edit-target",
      });
      // Originally tolerant of [404, 500] because of the
      // `reconstructNullParent` null-deref upstream of `requireOwner`.
      // Fixed in `@atscript/db@0.1.69` — wire shape now matches the
      // DELETE path's tight `404 preset_not_found`.
      const res = await viewerCtx.patch("/api/db/_presets", {
        data: {
          id: presetId,
          type: "preset",
          app: "vuedemo",
          tableKey: "orders",
          data: { label: "Hacked" },
        },
      });
      expect(res.status()).toBe(404);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("preset_not_found");
    } finally {
      await managerCtx.dispose();
      await viewerCtx.dispose();
    }
  });

  test("20.7 — viewer DELETE on manager's preset → 404 preset_not_found", async () => {
    const managerCtx = await newRequestContext("manager");
    const viewerCtx = await newRequestContext("viewer");
    try {
      const presetId = await savePreset(managerCtx, {
        tableKey: "orders",
        label: "Manager delete-target",
      });
      const res = await viewerCtx.delete(`/api/db/_presets/${presetId}`);
      expect(res.status()).toBe(404);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("preset_not_found");
    } finally {
      await managerCtx.dispose();
      await viewerCtx.dispose();
    }
  });

  // 20.8 — canPublish + public-label uniqueness.

  test("20.8 — viewer POST with public:true → 403 publish_forbidden", async () => {
    const viewerCtx = await newRequestContext("viewer");
    try {
      const res = await viewerCtx.post("/api/db/_presets", {
        data: {
          type: "preset",
          app: "vuedemo",
          tableKey: "orders",
          public: true,
          data: { label: "Viewer-evil-public", content: {} },
        },
      });
      expect(res.status()).toBe(403);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("publish_forbidden");
    } finally {
      await viewerCtx.dispose();
    }
  });

  test("20.8 — public-label uniqueness collision → 409 public_name_conflict", async () => {
    const adminCtx = await newRequestContext("admin");
    try {
      await savePreset(adminCtx, { public: true, label: "DupLabel-A" });
      const dup = await adminCtx.post("/api/db/_presets", {
        data: {
          type: "preset",
          app: "vuedemo",
          tableKey: "users",
          public: true,
          data: { label: "DupLabel-A", content: {} },
        },
      });
      expect(dup.status()).toBe(409);
      const body = (await dup.json()) as { code?: string; message?: string };
      expect(body.code).toBe("public_name_conflict");
      expect(body.message).toMatch(/already exists/i);
    } finally {
      await adminCtx.dispose();
    }
  });

  // 20.9 — Reserved-id namespace.

  test("20.9 — POST with id 'sys:standard' → 400 reserved_id", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/_presets", {
        data: {
          id: "sys:standard",
          type: "preset",
          app: "vuedemo",
          tableKey: "users",
          data: { label: "hacked", content: {} },
        },
      });
      expect(res.status()).toBe(400);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("reserved_id");
    } finally {
      await ctx.dispose();
    }
  });

  test("20.9 — PATCH 'sys:standard' → 400 reserved_id", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.patch("/api/db/_presets", {
        data: { id: "sys:standard", data: { label: "hacked" } },
      });
      expect(res.status()).toBe(400);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("reserved_id");
    } finally {
      await ctx.dispose();
    }
  });

  test("20.9 — DELETE 'sys:standard' → 400 reserved_id", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.delete("/api/db/_presets/sys:standard");
      expect(res.status()).toBe(400);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("reserved_id");
    } finally {
      await ctx.dispose();
    }
  });

  // 20.10 — Identity scrub on appConf writes.

  test("20.10 — appConf POST with extra preset-only fields → server stores them as null", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/_presets", {
        data: {
          type: "appConf",
          app: "vuedemo",
          public: true,
          label: "evil",
          publicLabel: "evil-public",
          aspects: ["columns", "filters"],
          data: { appearance: "dark" },
        },
      });
      expect(res.ok()).toBeTruthy();

      const list = await ctx.get("/api/db/_presets/query?app=vuedemo&type=appConf");
      expect(list.ok()).toBeTruthy();
      const rows = (await list.json()) as Array<{
        public?: unknown;
        label?: unknown;
        publicLabel?: unknown;
        aspects?: unknown;
        data?: { appearance?: string };
      }>;
      expect(rows.length).toBeGreaterThan(0);
      const ours = rows.find((r) => r.data?.appearance === "dark");
      expect(ours, "appConf row not found in readback").toBeTruthy();
      expect(ours?.public).toBeNull();
      expect(ours?.label).toBeNull();
      expect(ours?.publicLabel).toBeNull();
      expect(ours?.aspects).toBeNull();
    } finally {
      await ctx.dispose();
    }
  });

  // 20.11 — Per-user cap + insertMany rejection.

  test("20.11 — insertMany on /_presets → 405 action_unsupported", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      const res = await ctx.post("/api/db/_presets", {
        data: [
          {
            type: "preset",
            app: "vuedemo",
            tableKey: "users",
            data: { label: "P1", content: {} },
          },
          {
            type: "preset",
            app: "vuedemo",
            tableKey: "users",
            data: { label: "P2", content: {} },
          },
        ],
      });
      expect(res.status()).toBe(405);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("action_unsupported");
    } finally {
      await ctx.dispose();
    }
  });

  test("20.11 — per-user cap rejects (cap+1)-th insert with preset_limit_reached", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      // Fresh `products` scope — no other tests insert here, so count is
      // deterministic.
      for (let i = 0; i < 10; i++) {
        const res = await ctx.post("/api/db/_presets", {
          data: {
            type: "preset",
            app: "vuedemo",
            tableKey: "products",
            data: { label: `viewer-cap-${i}`, content: {} },
          },
        });
        expect(res.ok(), `cap fill ${i} failed`).toBeTruthy();
      }
      const overflow = await ctx.post("/api/db/_presets", {
        data: {
          type: "preset",
          app: "vuedemo",
          tableKey: "products",
          data: { label: "viewer-cap-overflow", content: {} },
        },
      });
      expect(overflow.status()).toBe(409);
      const body = (await overflow.json()) as {
        code?: string;
        limit?: number;
        count?: number;
      };
      expect(body.code).toBe("preset_limit_reached");
      expect(body.limit).toBe(10);
      expect(body.count).toBe(10);
    } finally {
      await ctx.dispose();
    }
  });

  // Bonus probes: read-gate scope validation on `/query`.
  test("20.6 (bonus) — /query without 'app' → 400 missing_scope", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      const res = await ctx.get("/api/db/_presets/query");
      expect(res.status()).toBe(400);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("missing_scope");
    } finally {
      await ctx.dispose();
    }
  });

  test("20.6 (bonus) — /query with 'app' but no 'tableKey' → 400 missing_scope", async () => {
    const ctx = await newRequestContext("viewer");
    try {
      const res = await ctx.get("/api/db/_presets/query?app=vuedemo");
      expect(res.status()).toBe(400);
    } finally {
      await ctx.dispose();
    }
  });

  // 20.12 — Anonymous access (SessionGuard).

  test("20.12 — anonymous GET /users/meta → 401", async () => {
    const ctx = await newAnonRequestContext();
    try {
      const res = await ctx.get("/api/db/tables/users/meta");
      expect(res.status()).toBe(401);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe("Unauthorized");
    } finally {
      await ctx.dispose();
    }
  });

  test("20.12 — anonymous POST /users/actions/suspend → 401", async () => {
    const ctx = await newAnonRequestContext();
    try {
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: { ids: [{ username: "alice" }], input: { reason: "anon" } },
      });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.12 — anonymous /api/me → 401", async () => {
    const ctx = await newAnonRequestContext();
    try {
      const res = await ctx.get("/api/me");
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.12 — anonymous can hit /api/wf to start the public login workflow", async () => {
    const ctx = await newAnonRequestContext();
    try {
      const res = await ctx.post("/api/wf", {
        data: { wfid: "api/auth/login" },
      });
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as { wfs?: string };
      expect(typeof body.wfs).toBe("string");
      expect((body.wfs ?? "").length).toBeGreaterThan(0);
    } finally {
      await ctx.dispose();
    }
  });

  // 20.13 — Session tampering.

  test("20.13 — modified payload with stale signature → 401", async () => {
    const ctx = await newAnonRequestContext();
    try {
      const evilPayload = Buffer.from(
        JSON.stringify({
          userId: 1,
          username: "evil",
          roleId: 1,
          roleName: "admin",
          issuedAt: 1778161000,
        }),
      ).toString("base64url");
      const staleSig = "0i6aWf7M_Ve_MqL6LNxUbeaxkdwlFqED3iaF6CSngb4";
      const tamperedCookie = `${evilPayload}.${staleSig}`;
      const res = await ctx.get("/api/db/tables/users/meta", {
        headers: { Cookie: `demo.sid=${tamperedCookie}` },
      });
      expect(res.status()).toBe(401);
      const body = (await res.json()) as { message?: string };
      expect(body.message).toMatch(/Not authenticated/i);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.13 — gibberish cookie value → 401", async () => {
    const ctx = await newAnonRequestContext();
    try {
      const res = await ctx.get("/api/db/tables/users/meta", {
        headers: { Cookie: "demo.sid=this-is-not-a-jwt-and-has-no-dot" },
      });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.13 — empty cookie value → 401", async () => {
    const ctx = await newAnonRequestContext();
    try {
      const res = await ctx.get("/api/db/tables/users/meta", {
        headers: { Cookie: "demo.sid=" },
      });
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.13 — bit-flipped real-cookie payload → 401", async () => {
    // Take a real admin cookie, flip ONE byte of the payload, keep the
    // original signature. HMAC verification rejects.
    const adminCtx = await newRequestContext("admin");
    let realCookie = "";
    try {
      const state = await adminCtx.storageState();
      const cookie = state.cookies.find((c) => c.name === "demo.sid");
      if (!cookie) throw new Error("admin cookie missing in storage state");
      realCookie = cookie.value;
    } finally {
      await adminCtx.dispose();
    }
    const dotIdx = realCookie.indexOf(".");
    expect(dotIdx).toBeGreaterThan(0);
    const payload = realCookie.slice(0, dotIdx);
    const sig = realCookie.slice(dotIdx + 1);
    const tampered = `${payload[0] === "A" ? "B" : "A"}${payload.slice(1)}.${sig}`;

    const anonCtx = await newAnonRequestContext();
    try {
      const res = await anonCtx.get("/api/db/tables/users/meta", {
        headers: { Cookie: `demo.sid=${tampered}` },
      });
      expect(res.status()).toBe(401);
    } finally {
      await anonCtx.dispose();
    }
  });

  // DEFERRED: FK constraints prevent seeded-user deletion via raw HTTP.
  test.skip("20.13 — replay old session for deleted user [DEFERRED]", () => {});
  // DEFERRED: SESSION_MAX_AGE_SEC=7d, not feasible in e2e.
  test.skip("20.13 — session expiry rejects past-max-age cookie [DEFERRED]", () => {});

  // 20.14 — SQL / regex injection in filter values.

  test("20.14 — filter with classic SQL-injection value executes safely + returns empty result", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const params = new URLSearchParams();
      params.set("username", "admin'; DROP TABLE users; --");
      params.set("$size", "5");
      const res = await ctx.get(`/api/db/tables/users/pages?${params.toString()}`);
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as { count?: number; data?: unknown[] };
      expect(body.count).toBe(0);
      expect(body.data).toEqual([]);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.14 — `users` table still exists after the injection attempt", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.get("/api/db/tables/users/pages?$size=2");
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as { count?: number };
      expect(body.count).toBeGreaterThanOrEqual(6);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.14 — multi-line/UNION-style payload is also bound safely", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const params = new URLSearchParams();
      params.set("username", "admin' UNION SELECT * FROM users--");
      params.set("$size", "2");
      const res = await ctx.get(`/api/db/tables/users/pages?${params.toString()}`);
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as { count?: number };
      expect(body.count).toBe(0);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.14 — regex injection: malformed regex is rejected by parser, not applied as SQL", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const params = new URLSearchParams();
      params.set("username~", "'/admin' OR 1=1/'");
      const res = await ctx.get(`/api/db/tables/users/pages?${params.toString()}`);
      expect(res.ok()).toBeFalsy();
      expect([400, 422, 500]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });

  test("20.14 — well-formed regex value matches against the literal pattern, not arbitrary SQL", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const params = new URLSearchParams();
      params.set("username~", "'/admin/'");
      params.set("$size", "10");
      const res = await ctx.get(`/api/db/tables/users/pages?${params.toString()}`);
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        count?: number;
        data?: Array<{ username?: string }>;
      };
      expect(body.count).toBe(1);
      expect(body.data?.[0]?.username).toBe("admin");
    } finally {
      await ctx.dispose();
    }
  });

  // 20.15 — Cross-table action invocation.

  test("20.15 — cross-table action POST → 404", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/orders/actions/suspend", {
        data: { ids: [{ id: 1 }], input: { reason: "evil" } },
      });
      expect(res.status()).toBe(404);
    } finally {
      await ctx.dispose();
    }
  });

  // 20.16 — TOCTOU action gate re-evaluation.

  test("20.16 — gate re-evaluates row state per-call (post-mutation rejection)", async () => {
    const ctx = await newRequestContext("admin");
    try {
      // bob is pending → activate succeeds → status='active'.
      const ok = await ctx.post("/api/db/tables/users/actions/activate", {
        data: { ids: { username: "bob" } },
      });
      expect(ok.ok()).toBeTruthy();

      // Replay — gate's `disabled: u => u.status === 'active'` fires.
      const replay = await ctx.post("/api/db/tables/users/actions/activate", {
        data: { ids: { username: "bob" } },
      });
      expect(replay.status()).toBe(409);
      const body = (await replay.json()) as { name?: string };
      expect(body.name).toBe("ActionDisabledError");
    } finally {
      await ctx.dispose();
    }
  });

  // 20.17 — Identifier strict-mode.

  test("20.17 — extra unknown field in identifier object → rejection", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: {
          ids: [{ username: "alice", "; DROP TABLE users; --": 1 }],
          input: { reason: "test injection" },
        },
      });
      // Tolerant of [400, 422, 500] because the gate-interceptor's
      // pre-arg-resolve `ValidatorError` throw escapes moost's
      // interceptor stack as 500. Awaiting moost fix to interceptor
      // registration ordering — see SECURITY_REPORT.md finding 3c
      // (still open at moost@0.6.9). Tighten to 400 once landed.
      expect(res.ok()).toBeFalsy();
      expect([400, 422, 500]).toContain(res.status());
      const body = (await res.json()) as { message?: string };
      expect(body.message).toMatch(/Identifier fields|exactly match/i);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.17 — bare scalar `ids` value → rejection", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: { ids: "alice", input: { reason: "test" } },
      });
      expect(res.ok()).toBeFalsy();
      expect([400, 422, 500]).toContain(res.status());
      const body = (await res.json()) as { message?: string };
      expect(body.message).toMatch(/Expected JSON array|identifier/i);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.17 — heterogeneous identifier shapes inside one array — server normalises and runs gate per-item", async () => {
    const ctx = await newRequestContext("admin");
    try {
      // Both `{username}` and `{id}` are legitimate identifier shapes.
      // alice is already suspended at this point and id=99999 has no row,
      // so onDisabledRows='skip' yields zero survivors → 409.
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: {
          ids: [{ username: "alice" }, { id: 99999 }],
          input: { reason: "heterogeneous" },
        },
      });
      expect([200, 201, 409]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });

  test("20.17 — composite identifier with two unique-index fields together → rejection", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/tables/users/actions/suspend", {
        data: {
          ids: [{ id: 5, username: "alice" }],
          input: { reason: "composite" },
        },
      });
      expect(res.ok()).toBeFalsy();
      expect([400, 422, 500]).toContain(res.status());
      const body = (await res.json()) as { message?: string };
      expect(body.message).toMatch(/Identifier fields|exactly match/i);
    } finally {
      await ctx.dispose();
    }
  });

  // 20.18 — @db.depth.limit blocks nested writes.

  test("20.18 — nested PATCH on orders rejects unknown nested field", async () => {
    const ctx = await newRequestContext("admin");
    try {
      // `customer` is not a column on orders; the body validator rejects
      // before @db.depth.limit 0 has a chance to fire.
      const res = await ctx.patch("/api/db/tables/orders", {
        data: { id: 1, customer: { id: 2, name: "evil" } },
      });
      expect(res.ok()).toBeFalsy();
      expect([400, 422, 500]).toContain(res.status());
      const body = (await res.json()) as { message?: string };
      expect(body.message).toMatch(/Unexpected property|customer|depth/i);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.18 — nested PATCH using a number column with object value → rejected", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.patch("/api/db/tables/orders", {
        data: { id: 1, customerId: { id: 2, sneak: "evil" } },
      });
      expect(res.ok()).toBeFalsy();
      expect([400, 422, 500]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });

  // 20.19 — @db.json columns rejected for sort.

  test("20.19 — sort on customers.address (@db.json) → 400", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.get("/api/db/tables/customers/pages?$sort=address:asc&$size=2");
      expect(res.status()).toBe(400);
      const body = (await res.json()) as { message?: string };
      expect(body.message).toMatch(/Unknown field|address|sort/i);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.19 — sort on customers.preferences (@db.json) → 400", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.get("/api/db/tables/customers/pages?$sort=preferences:desc&$size=2");
      expect(res.status()).toBe(400);
    } finally {
      await ctx.dispose();
    }
  });

  test("20.19 — meta exposes filterable=false / sortable=false on @db.json columns", async () => {
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.get("/api/db/tables/customers/meta");
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as {
        fields?: Record<string, { filterable?: boolean; sortable?: boolean }>;
      };
      expect(body.fields?.address).toEqual({ filterable: false, sortable: false });
      expect(body.fields?.preferences).toEqual({ filterable: false, sortable: false });
    } finally {
      await ctx.dispose();
    }
  });

  // Originally a SECURITY FINDING — filter on @db.json silently 200'd
  // instead of 400. Fixed in `@atscript/moost-db@0.1.69` — the field-
  // descriptor `filterable: false` (set automatically for `@db.json`
  // and array columns by the SQL adapter, see invariant #14) is now
  // honoured by the URL filter parser too.
  test("20.19 — filter on customers.address (@db.json) → 400", async () => {
    const ctx = await newRequestContext("admin");
    try {
      // Plain string equality syntax — the URL parser accepts it; the
      // moost-db filter handler must reject because address is @db.json.
      const res = await ctx.get("/api/db/tables/customers/pages?address=Berlin&$size=2");
      expect(res.status()).toBe(400);
      const body = (await res.json()) as { message?: string };
      expect(body.message).toMatch(/Unknown field|address|filter|json/i);
    } finally {
      await ctx.dispose();
    }
  });

  // 20.20 — Same-site cookie semantics.

  test("20.20 — login Set-Cookie includes SameSite=Lax + HttpOnly + Path=/ + Max-Age=604800", async () => {
    const ctx = await newAnonRequestContext();
    try {
      const start = await ctx.post("/api/wf", {
        data: { wfid: "api/auth/login" },
      });
      const startBody = (await start.json()) as { wfs?: string };
      expect(startBody.wfs).toBeTruthy();

      const finish = await ctx.post("/api/wf", {
        data: {
          wfs: startBody.wfs,
          input: { username: "admin", password: "demo-password" },
        },
      });
      const headers = finish.headers();
      const setCookie = headers["set-cookie"] ?? "";
      expect(setCookie).toMatch(/demo\.sid=/);
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      expect(setCookie).toMatch(/Path=\//);
      expect(setCookie).toMatch(/Max-Age=604800/);
    } finally {
      await ctx.dispose();
    }
  });

  // DEFERRED: true CSRF simulation needs multi-origin browser context;
  // SameSite=Lax already verified via Set-Cookie above.
  test.skip("20.20 — cross-origin POST without cookie [DEFERRED]", () => {});

  // 20.21 — Audit log: every mutation is recorded.

  test("20.21 — admin suspends a user → audit_log gains exactly one row with the right shape", async () => {
    const adminCtx = await newRequestContext("admin");
    try {
      // Suspend `manager` (still active here — earlier tests suspended viewer only).
      const mutateRes = await adminCtx.post("/api/db/tables/users/actions/suspend", {
        data: {
          ids: [{ username: "manager" }],
          input: { reason: "audit-test 20.21" },
        },
      });
      expect(mutateRes.ok(), `suspend manager failed: ${mutateRes.status()}`).toBeTruthy();

      // The audit interceptor uses fire-and-forget `void writeRows(...)`,
      // so the POST may return before the row commits. Poll the most-
      // recent rows for our entry by its unique `changes` substring.
      let ours:
        | {
            actorId?: number;
            entityType?: string;
            entityId?: number;
            action?: string;
            changes?: string;
          }
        | undefined;
      for (let i = 0; i < 30; i++) {
        const rows = await adminCtx.get("/api/db/tables/audit_log/pages?$size=20&$sort=-createdAt");
        const list = (await rows.json()) as {
          data?: Array<{
            actorId?: number;
            entityType?: string;
            entityId?: number;
            action?: string;
            changes?: string;
          }>;
        };
        ours = (list.data ?? []).find((r) => (r.changes ?? "").includes("audit-test 20.21"));
        if (ours) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(ours, "fresh audit row not found after polling 3s").toBeTruthy();
      // Actor is admin (userId=1), NOT the affected user (manager id=2).
      expect(ours?.actorId).toBe(1);
      expect(ours?.entityType).toBe("users");
      expect(ours?.entityId).toBe(2);
      expect(ours?.action).toBe("suspend");
    } finally {
      await adminCtx.dispose();
    }
  });

  // 20.21 — Gate-rejected attempts are also audited (`<action>.failed`).
  test("20.21 — gate-rejected suspend is logged with `<action>.failed` label", async () => {
    const adminCtx = await newRequestContext("admin");
    try {
      // viewer is already suspended (earlier 20.1 test), so replay trips the
      // AFTER_GUARD gate and throws `ActionDisabledError`.
      const failRes = await adminCtx.post("/api/db/tables/users/actions/suspend", {
        data: {
          ids: [{ username: "viewer" }],
          input: { reason: "audit-test 20.21-FAILED" },
        },
      });
      expect(failRes.status()).toBe(409);
      const body = (await failRes.json()) as { name?: string };
      expect(body.name).toBe("ActionDisabledError");

      // Fire-and-forget audit write; poll the most-recent rows for ours.
      let ours:
        | {
            actorId?: number;
            entityType?: string;
            entityId?: number;
            action?: string;
            changes?: string;
          }
        | undefined;
      for (let i = 0; i < 30; i++) {
        const rows = await adminCtx.get(
          "/api/db/tables/audit_log/pages?$size=100&$sort=-createdAt",
        );
        const list = (await rows.json()) as {
          data?: Array<{
            actorId?: number;
            entityType?: string;
            entityId?: number;
            action?: string;
            changes?: string;
          }>;
        };
        // `changes` is `JSON.stringify({ message, response })`; parse to match
        // shape rather than substring-grepping escaped wire form.
        ours = (list.data ?? []).find((r) => {
          if (r.action !== "suspend.failed") return false;
          try {
            const parsed = JSON.parse(r.changes ?? "{}") as { message?: string };
            return (
              typeof parsed.message === "string" &&
              parsed.message.includes('Action "suspend" is disabled')
            );
          } catch {
            return false;
          }
        });
        if (ours) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(ours, "fresh audit-failure row not found after polling 3s").toBeTruthy();
      expect(ours?.actorId).toBe(1);
      expect(ours?.entityType).toBe("users");
      expect(ours?.action).toBe("suspend.failed");
      // `error` callback writes `entityId: 0` since the thrown error has no id/ids.
      expect(ours?.entityId).toBe(0);
      const parsedChanges = JSON.parse(ours?.changes ?? "{}") as {
        message?: string;
        response?: unknown;
      };
      expect(parsedChanges.message).toContain('Action "suspend" is disabled');
      expect(parsedChanges.response).toEqual({});
    } finally {
      await adminCtx.dispose();
    }
  });
});
