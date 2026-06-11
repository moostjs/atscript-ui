// Section 19 — Workflows: login, register, invite.
//
// **Per-worker reset.** Each Playwright worker owns its own demo-server
// replica + sqlite file (see `tests/e2e/global-setup.ts`), so `resetSeed()`
// here only touches THIS worker's DB and never races other batches. This
// undoes any prior file's mutations to `admin` / `alice` / `viewer` (e.g.
// section 8.20 leaves admin suspended) so 19.1's login-as-admin starts
// from a clean baseline. Per-test mutations still scope themselves via
// `uniq()` ids + viewer suspend/activate in 19.3's afterAll for in-file
// hygiene.
//
// Wire-shape findings:
//   - Login finish: `{ wfs?, finished: true, data: { ok: true, user: { username, roleName } } }`
//     + Set-Cookie `demo.sid=...; HttpOnly; SameSite=Lax; Path=/`. Phase 4
//     migrated the wire shape to the unified WfFinished envelope so domain
//     data now lives under `.data`.
//   - Login wrong-creds: `inputRequired.context.errors.password = "Invalid
//     username or password"`. NO Set-Cookie. Unknown-username and
//     wrong-password produce the same message for no info-leak
//     (login.workflow.ts).
//   - Login suspended: `errors.__form = "Account is suspended"`. Vue-form
//     renders `__form` via the `form.error` slot → `[role="alert"]
//     .as-form-error` banner above submit.
//   - MFA wrong code: `errors.code = "Invalid code"`. The same `wfs` token
//     re-submits with the correct code → finishes (verifyOtp doesn't
//     mutate `ctx.otpCode`).
//   - Register OTP outlet: stdout `[register-otp]` line with code; no
//     `link:` line (OTP path doesn't pause at an outlet).
//   - Invite outlet: stdout `[user-invite]` with `link:
//     http://localhost:3200/invite/<urlenc>`. `outletEmail` pauses the
//     workflow with `{ sent: true }` (no `inputRequired`); invitee resumes
//     via the magic-link URL whose `:token` param forwards as `wfs`.
//   - Non-admin invite: `invite-start` throws `HttpError(403, "Admin
//     only")` even with a valid `wfs` token — stolen tokens can't bypass.
//
// Flake notes:
//   - Anchor outlet reads via `serverLogOffset()` BEFORE the action — stale
//     OTP/MFA entries from `auth.setup.ts` (alice fixture) would otherwise
//     satisfy the wait.
//   - `useMe()` cache doesn't leak across `browser.newContext()`.
//   - `expect.poll(...)` over a fixed `waitForResponse` for "row appears in
//     /users" — table auto-refetch debounce can be 700-1200 ms.

import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "../fixtures";

import {
  authFileFor,
  columnCellIndex,
  DEMO_PASSWORD,
  gotoTable,
  newAnonRequestContext,
  newRequestContext,
  resetSeed,
  rowByCellText,
  serverLogOffset,
  waitForOtp,
  waitForOutletEntry,
} from "../helpers";

// =============================================================================
// File-local helpers (chat-RFC required to promote).
//
// `postWf` mirrors `helpers/auth.ts#postWf` but stays local — these tests
// inspect response body shapes + Set-Cookie headers directly instead of
// throwing on non-2xx.

interface WfResponse {
  wfs?: string;
  finished?: boolean;
  /** Phase 4 WfFinished envelope: domain payload moved under `.data`. */
  data?: { ok?: boolean; user?: { username: string; roleName: string }; [k: string]: unknown };
  sent?: boolean;
  outlet?: string;
  inputRequired?: {
    payload: unknown;
    transport: string;
    context?: Record<string, unknown> & { errors?: Record<string, string> };
  };
  error?: { message?: string; statusCode?: number; [k: string]: unknown };
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
    json = { error: { message: text } } as WfResponse;
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

/** Generate a low-collision id for unique usernames / emails per test. */
function uniq(): string {
  return Math.floor(Math.random() * 1e9)
    .toString(36)
    .padStart(6, "0");
}

/** Fresh anonymous browser context — sign-in flows must not inherit
 *  the project-level admin storageState. */
async function newAnonBrowserContext(browser: Browser): Promise<BrowserContext> {
  return await browser.newContext({ storageState: { cookies: [], origins: [] } });
}

/** Wait for the sidebar's "Signed in as <name>" line to render. */
async function expectSignedInAs(page: Page, username: string): Promise<void> {
  await expect(page.locator("nav").getByText(`Signed in as`)).toContainText(username);
}

/** Direct-suspend `bob` via the actions endpoint — used to set up 19.3
 *  without driving the (form-bearing) Suspend dialog through the UI.
 *  `SuspendUsersInput` requires `reason` (`@meta.required`) so we must
 *  pass a non-empty string. */
async function suspendUserViaApi(
  ctx: APIRequestContext,
  username: string,
  reason = "test-suspend",
): Promise<void> {
  const resp = await ctx.post("/api/db/tables/users/actions/suspend", {
    data: { ids: [{ username }], input: { reason, notifyUser: false } },
    headers: { "content-type": "application/json" },
  });
  if (!resp.ok()) {
    throw new Error(`suspendUserViaApi(${username}): ${resp.status()} ${await resp.text()}`);
  }
}

// =============================================================================
// Tests

test.describe.configure({ mode: "serial" });

test.describe("Section 19 — workflows", () => {
  // Restore per-worker DB to seed state — see file header for why this is
  // safe under parallel workers (it wasn't in the shared-DB era).
  test.beforeAll(async () => {
    await resetSeed();
  });

  test.describe("19.1 — login happy path", () => {
    test("19.1 UI — admin signs in via /login form; redirects + sidebar reflects", async ({
      browser,
    }) => {
      const ctx = await newAnonBrowserContext(browser);
      try {
        const page = await ctx.newPage();
        await page.goto("/login");
        await expect(page.getByRole("heading", { name: "AtShop — Sign In" })).toBeVisible();
        await page.locator('input[name="username"]').fill("admin");
        await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
        await Promise.all([
          page.waitForURL(/\/$/),
          page.getByRole("button", { name: /Sign In/i }).click(),
        ]);
        await expectSignedInAs(page, "admin");
      } finally {
        await ctx.close();
      }
    });

    test("19.1 raw HTTP — POST /api/wf{wfid:'api/auth/login'} → credentials → finished+ok+Set-Cookie", async () => {
      const ctx = await newAnonRequestContext();
      try {
        const start = await postWf(ctx, { wfid: "api/auth/login" });
        // moost-wf returns 201 on POST /api/wf (Created semantics for the
        // workflow state row). Both initial and intermediate steps land at
        // 2xx; only error-bearing throws (HttpError) escalate to 4xx/5xx.
        expect(start.status).toBeGreaterThanOrEqual(200);
        expect(start.status).toBeLessThan(300);
        expect(typeof start.json.wfs).toBe("string");
        // The start response carries the LoginForm payload; no errors.
        expect(start.json.inputRequired).toBeDefined();
        expect(start.json.inputRequired?.context?.errors).toBeUndefined();

        const finish = await postWf(ctx, {
          wfs: start.json.wfs,
          input: { username: "admin", password: DEMO_PASSWORD },
        });
        expect(finish.status).toBeGreaterThanOrEqual(200);
        expect(finish.status).toBeLessThan(300);
        expect(finish.json.finished).toBe(true);
        expect(finish.json.data?.ok).toBe(true);
        expect(finish.json.data?.user).toEqual({ username: "admin", roleName: "admin" });
        // Set-Cookie attributes per workflow issueSession(): HttpOnly,
        // SameSite=Lax, Path=/, Max-Age (numeric, 7 days × 1000 ms).
        expect(finish.setCookie).not.toBeNull();
        expect(finish.setCookie).toMatch(/demo\.sid=/);
        expect(finish.setCookie).toMatch(/HttpOnly/i);
        expect(finish.setCookie).toMatch(/SameSite=Lax/i);
        expect(finish.setCookie).toMatch(/Path=\//i);
      } finally {
        await ctx.dispose();
      }
    });
  });

  test.describe("19.2 — wrong credentials (no info leak)", () => {
    test("19.2 raw — wrong password and unknown username yield IDENTICAL generic error; no Set-Cookie", async () => {
      const ctxA = await newAnonRequestContext();
      const ctxB = await newAnonRequestContext();
      try {
        const startA = await postWf(ctxA, { wfid: "api/auth/login" });
        const wrongPw = await postWf(ctxA, {
          wfs: startA.json.wfs,
          input: { username: "admin", password: "totally-wrong" },
        });
        expect(wrongPw.status).toBeGreaterThanOrEqual(200);
        expect(wrongPw.status).toBeLessThan(300);
        expect(wrongPw.setCookie).toBeNull();
        expect(wrongPw.json.finished).toBeFalsy();
        const wrongPwMsg = wrongPw.json.inputRequired?.context?.errors?.password;
        expect(wrongPwMsg).toBe("Invalid username or password");

        const startB = await postWf(ctxB, { wfid: "api/auth/login" });
        const unknown = await postWf(ctxB, {
          wfs: startB.json.wfs,
          input: { username: "ghost-xyz", password: "anything" },
        });
        expect(unknown.status).toBeGreaterThanOrEqual(200);
        expect(unknown.status).toBeLessThan(300);
        expect(unknown.setCookie).toBeNull();
        const unknownMsg = unknown.json.inputRequired?.context?.errors?.password;
        expect(unknownMsg).toBe("Invalid username or password");
        // No info leak: identical message text.
        expect(unknownMsg).toBe(wrongPwMsg);
      } finally {
        await ctxA.dispose();
        await ctxB.dispose();
      }
    });

    test("19.2 UI — wrong password renders inline error on the password field", async ({
      browser,
    }) => {
      const ctx = await newAnonBrowserContext(browser);
      try {
        const page = await ctx.newPage();
        await page.goto("/login");
        await page.locator('input[name="username"]').fill("admin");
        await page.locator('input[name="password"]').fill("totally-wrong");
        await page.getByRole("button", { name: /Sign In/i }).click();
        // Inline error rendered via `<AsFieldShell>` `as-error-slot[role=alert]`
        // bound to the password field (vue-form field-path keying).
        const errorSlot = page.locator(
          'input[name="password"] ~ * .as-error-slot, input[name="password"] ~ .as-error-slot, .as-error-slot[role="alert"]',
        );
        await expect(errorSlot.filter({ hasText: "Invalid username or password" })).toBeVisible();
        // Did NOT navigate.
        expect(new URL(page.url()).pathname).toBe("/login");
      } finally {
        await ctx.close();
      }
    });
  });

  test.describe("19.3 — suspended account", () => {
    // Use `viewer` — F/H/J never mutate it, so suspend/activate here
    // can't race other batches. Session lookup doesn't enforce `status`,
    // so the cached `viewer.json` storageState stays usable.

    test.beforeAll(async () => {
      const adminCtx = await newRequestContext("admin");
      try {
        await suspendUserViaApi(adminCtx, "viewer", "test-19.3");
      } finally {
        await adminCtx.dispose();
      }
    });

    test.afterAll(async () => {
      // Reactivate viewer so subsequent runs (and any spec that issues
      // a fresh `viewer` login) don't trip the suspended gate.
      const adminCtx = await newRequestContext("admin");
      try {
        await adminCtx.post("/api/db/tables/users/actions/activate", {
          data: { ids: { username: "viewer" } },
          headers: { "content-type": "application/json" },
        });
      } finally {
        await adminCtx.dispose();
      }
    });

    test("19.3 raw — suspended viewer → wf returns __form: 'Account is suspended'; no Set-Cookie", async () => {
      const ctx = await newAnonRequestContext();
      try {
        const start = await postWf(ctx, { wfid: "api/auth/login" });
        const submit = await postWf(ctx, {
          wfs: start.json.wfs,
          input: { username: "viewer", password: DEMO_PASSWORD },
        });
        expect(submit.status).toBeGreaterThanOrEqual(200);
        expect(submit.status).toBeLessThan(300);
        expect(submit.setCookie).toBeNull();
        expect(submit.json.finished).toBeFalsy();
        // `__form` = moost-wf form-level error convention; UI surface via
        // the `form.error` slot is covered by the sibling UI test.
        expect(submit.json.inputRequired?.context?.errors?.__form).toBe("Account is suspended");
      } finally {
        await ctx.dispose();
      }
    });

    test("19.3 UI — suspended viewer login renders the __form banner above the submit button", async ({
      browser,
    }) => {
      const ctx = await newAnonBrowserContext(browser);
      try {
        const page = await ctx.newPage();
        await page.goto("/login");
        await page.locator('input[name="username"]').fill("viewer");
        await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
        await page.getByRole("button", { name: /Sign In/i }).click();
        // The form does NOT close — viewer stays on /login.
        const banner = page.locator('[role="alert"].as-form-error');
        await expect(banner).toBeVisible();
        await expect(banner).toContainText("Account is suspended");
        expect(new URL(page.url()).pathname).toBe("/login");
      } finally {
        await ctx.close();
      }
    });
  });

  test.describe("19.4 — MFA flow (alice, mfaEnabled)", () => {
    test("19.4a raw — wrong OTP keeps wfs+ctx; same wfs + correct OTP finishes", async () => {
      const ctx = await newAnonRequestContext();
      try {
        const start = await postWf(ctx, { wfid: "api/auth/login" });
        const otpAnchor = serverLogOffset();
        const cred = await postWf(ctx, {
          wfs: start.json.wfs,
          input: { username: "alice", password: DEMO_PASSWORD },
        });
        expect(cred.json.finished).toBeFalsy();
        expect(typeof cred.json.wfs).toBe("string");
        // MfaPincodeForm passed back; alice's email surfaces in context.
        expect(cred.json.inputRequired?.context?.email).toBe("alice@demo.test");

        const code = await waitForOtp({ email: "alice@demo.test", sinceOffset: otpAnchor });

        // First, submit a wrong code → still paused at login-verify-otp,
        // errors.code = 'Invalid code', new wfs token returned.
        const wrong = await postWf(ctx, {
          wfs: cred.json.wfs,
          input: { code: "000000" },
        });
        expect(wrong.json.finished).toBeFalsy();
        expect(wrong.json.inputRequired?.context?.errors?.code).toBe("Invalid code");
        expect(typeof wrong.json.wfs).toBe("string");

        // Re-submit with the correct code via the new wfs → finishes.
        const right = await postWf(ctx, {
          wfs: wrong.json.wfs,
          input: { code },
        });
        expect(right.json.finished).toBe(true);
        expect(right.json.data?.ok).toBe(true);
        expect(right.json.data?.user?.username).toBe("alice");
        expect(right.setCookie).toMatch(/demo\.sid=/);
      } finally {
        await ctx.dispose();
      }
    });

    test("19.4b raw — direct correct-OTP path finishes on first MFA submit", async () => {
      const ctx = await newAnonRequestContext();
      try {
        const start = await postWf(ctx, { wfid: "api/auth/login" });
        const otpAnchor = serverLogOffset();
        const cred = await postWf(ctx, {
          wfs: start.json.wfs,
          input: { username: "alice", password: DEMO_PASSWORD },
        });
        const code = await waitForOtp({ email: "alice@demo.test", sinceOffset: otpAnchor });
        const fin = await postWf(ctx, {
          wfs: cred.json.wfs,
          input: { code },
        });
        expect(fin.json.finished).toBe(true);
        expect(fin.json.data?.user?.username).toBe("alice");
        expect(fin.setCookie).toMatch(/demo\.sid=/);
      } finally {
        await ctx.dispose();
      }
    });
  });

  test.describe("19.5 — self-registration", () => {
    test("19.5 raw — credentials → register-otp form transition + OTP outlet wire shape", async () => {
      const id = uniq();
      const username = `reg-${id}`;
      const email = `${username}@demo.test`;

      const ctx = await newAnonRequestContext();
      try {
        const start = await postWf(ctx, { wfid: "api/auth/register" });
        expect(typeof start.json.wfs).toBe("string");

        const otpAnchor = serverLogOffset();
        const submit = await postWf(ctx, {
          wfs: start.json.wfs,
          input: { username, email, password: "regpass-99" },
        });
        // Workflow advances to register-verify-otp (OtpForm payload back).
        expect(submit.json.finished).toBeFalsy();
        expect(submit.json.inputRequired?.context?.email).toBe(email);
        // OTP logged inline by `register-otp` template (no `link` line —
        // OTP path doesn't pause at an outlet).
        const entry = await waitForOutletEntry({
          template: "register-otp",
          email,
          sinceOffset: otpAnchor,
        });
        expect(entry.code).toMatch(/^\d{6}$/);
        expect(entry.link).toBeUndefined();
      } finally {
        await ctx.dispose();
      }
    });

    test("19.5 UI — full happy path: credentials → OTP → signed in; admin sees new active viewer row", async ({
      browser,
    }) => {
      const id = uniq();
      const username = `reg-ui-${id}`;
      const email = `${username}@demo.test`;

      const anonCtx = await newAnonBrowserContext(browser);
      try {
        const page = await anonCtx.newPage();
        await page.goto("/register");
        await expect(page.getByRole("heading", { name: "AtShop — Register" })).toBeVisible();
        await page.locator('input[name="username"]').fill(username);
        await page.locator('input[name="email"]').fill(email);
        await page.locator('input[name="password"]').fill("regpass-99");

        // Anchor the outlet read BEFORE submit so a stale `register-otp`
        // entry from a previous test (or auth.setup.ts's alice fixture)
        // can't satisfy the wait.
        const otpAnchor = serverLogOffset();
        await page.getByRole("button", { name: /Register|Submit|Submitting/i }).click();

        await expect(page.locator('input[name="code"]')).toBeVisible();
        // Root `@ui.form.fn.title` is form-level `(data, ctx)` — the heading
        // must show the email passed via `@wf.context.pass`, not the fallback.
        await expect(
          page.getByRole("heading", { name: `Enter the code sent to ${email}` }),
        ).toBeVisible();

        const entry = await waitForOutletEntry({
          template: "register-otp",
          email,
          sinceOffset: otpAnchor,
        });
        expect(entry.code).toMatch(/^\d{6}$/);

        // Submit OTP → workflow finishes → onFinished navigates to '/'.
        await page.locator('input[name="code"]').fill(entry.code!);
        await Promise.all([
          page.waitForURL(/\/$/),
          page.getByRole("button", { name: /Verify|Submit|Submitting/i }).click(),
        ]);
        await expectSignedInAs(page, username);
      } finally {
        await anonCtx.close();
      }

      // As admin, verify the new row landed with `Status: active` +
      // `Role: viewer`. Use a fresh storage state so the just-signed-in
      // viewer's `__as_me` cache doesn't leak.
      const adminBrowserCtx = await browser.newContext({
        storageState: authFileFor("admin"),
      });
      try {
        const adminPage = await adminBrowserCtx.newPage();
        await gotoTable(adminPage, "users");
        const table = adminPage.locator("table[data-as-main-table]");
        // Auto-refetch debounce can produce a 700-1200ms gap before the
        // new row paints — poll on row presence rather than racing a
        // single waitForResponse.
        const usernameIdx = await columnCellIndex(table, "username");
        const statusIdx = await columnCellIndex(table, "status");
        const roleIdx = await columnCellIndex(table, "roleId");
        await expect
          .poll(async () => await rowByCellText(table, usernameIdx, username).count())
          .toBeGreaterThan(0);
        const row = rowByCellText(table, usernameIdx, username).first();
        await expect(row.locator("td").nth(usernameIdx)).toContainText(username);
        await expect(row.locator("td").nth(statusIdx)).toContainText(/active/i);
        // viewer role id is 3 in the seed; the column renders the bare
        // FK-id (no @db.rel.FK label resolution on /users for roleId).
        await expect(row.locator("td").nth(roleIdx)).toContainText(/^3$|viewer|Read-only/i);
      } finally {
        await adminBrowserCtx.close();
      }
    });
  });

  test.describe("19.6 — register duplicates", () => {
    test("19.6a raw — duplicate username surfaces inline 'Username already taken' on the username field", async () => {
      const ctx = await newAnonRequestContext();
      try {
        const start = await postWf(ctx, { wfid: "api/auth/register" });
        const submit = await postWf(ctx, {
          wfs: start.json.wfs,
          input: { username: "admin", email: `unique-${uniq()}@demo.test`, password: "regpass-99" },
        });
        expect(submit.json.finished).toBeFalsy();
        expect(submit.json.inputRequired?.context?.errors?.username).toBe("Username already taken");
        expect(submit.setCookie).toBeNull();
      } finally {
        await ctx.dispose();
      }
    });

    test("19.6b raw — duplicate email surfaces inline 'Email already registered' on the email field", async () => {
      const ctx = await newAnonRequestContext();
      try {
        const start = await postWf(ctx, { wfid: "api/auth/register" });
        const submit = await postWf(ctx, {
          wfs: start.json.wfs,
          input: { username: `unique-${uniq()}`, email: "admin@demo.test", password: "regpass-99" },
        });
        expect(submit.json.finished).toBeFalsy();
        expect(submit.json.inputRequired?.context?.errors?.email).toBe("Email already registered");
        expect(submit.setCookie).toBeNull();
      } finally {
        await ctx.dispose();
      }
    });
  });

  test.describe("19.7 — admin issues invitation", () => {
    test("19.7 UI — admin invites; invite-send outlets magic link; pending row appears in /users", async ({
      page,
      baseURL,
    }) => {
      const id = uniq();
      const email = `invitee-${id}@demo.test`;

      await page.goto("/users/invite");
      await expect(page.getByRole("heading", { name: "Invite user", level: 1 })).toBeVisible();
      await page.locator('input[name="email"]').fill(email);
      // Role is FK-resolved via @db.rel.FK — Reka Combobox renders the
      // role's `description` ("Read-only" for viewer / id 3).
      await page.locator(".as-ref-input").click();
      await page.locator(".as-ref-item").filter({ hasText: "Read-only" }).click();

      // Anchor the outlet read BEFORE submit so a stale `user-invite`
      // entry from a sibling test can't satisfy the wait.
      const outletAnchor = serverLogOffset();
      await page.getByRole("button", { name: /Send invite|Send Invite|Sending/i }).click();

      // `invite-send` outlets the link + pauses; `invite-admin.vue` redirects
      // to `/users` after 1500ms. Reaching either is evidence the wf advanced
      // past invite-start.
      const entry = await waitForOutletEntry({
        template: "user-invite",
        email,
        sinceOffset: outletAnchor,
      });
      // Replica's `DEMO_BASE_URL` env var (set in `global-setup.ts`) is what
      // the email-sender stamps into the magic-link, so it equals `baseURL`.
      expect(entry.link?.startsWith(`${baseURL}/invite/`)).toBe(true);

      // Skip gotoTable here — the auto-redirect already lands hydrated, so
      // re-navigating would just clear the loading overlay we don't need.
      await page.waitForURL(/\/users(\?|$)/, { timeout: 5_000 });
      const table = page.locator("table[data-as-main-table]");
      await expect(table).toBeVisible();

      // `username` is server-stamped `pending-<base36>`, `status` is
      // `invited`. Poll past the table auto-refetch debounce (see file head).
      const emailIdx = await columnCellIndex(table, "email");
      const usernameIdx = await columnCellIndex(table, "username");
      const statusIdx = await columnCellIndex(table, "status");
      await expect
        .poll(async () => await rowByCellText(table, emailIdx, email).count())
        .toBeGreaterThan(0);
      const row = rowByCellText(table, emailIdx, email).first();
      await expect(row.locator("td").nth(usernameIdx)).toContainText(/^pending-/);
      await expect(row.locator("td").nth(statusIdx)).toContainText(/invited/i);
    });
  });

  test.describe("19.8 — magic link → accept", () => {
    // Drives the issuer-side via raw HTTP (captures the magic link from
    // the outlet) and the invitee-side via the UI. 19.7 covers the
    // admin-side UI end-to-end.
    test("19.8 UI — invitee opens magic link in fresh context, sets credentials, signs in; admin sees row activated", async ({
      browser,
    }) => {
      const id = uniq();
      const email = `accept-${id}@demo.test`;

      const adminCtx = await newRequestContext("admin");
      let link: string;
      try {
        const start = await postWf(adminCtx, { wfid: "api/users/invite" });
        const outletAnchor = serverLogOffset();
        const submit = await postWf(adminCtx, {
          wfs: start.json.wfs,
          input: { email, roleId: 3 },
        });
        // `invite-send` outlets and pauses the workflow with `sent:true`.
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

      const chosenUsername = `acc-${id}`;
      const inviteeCtx = await newAnonBrowserContext(browser);
      try {
        const page = await inviteeCtx.newPage();
        // `/invite/:token` mounts InviteAcceptForm via AsWfForm; visiting
        // the link triggers a wfs resume that lands at `invite-accept`.
        // (The form's `@ui.form.fn.title` needs ui-fns; demo doesn't wire
        // it, so the title falls back to `@meta.label`. Field presence is
        // enough — wfs resume succeeded if the form rendered at all.)
        await page.goto(link);
        await expect(page.getByRole("heading", { name: "Accept invitation" })).toBeVisible();
        await expect(page.locator('input[name="username"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();

        await page.locator('input[name="username"]').fill(chosenUsername);
        await page.locator('input[name="password"]').fill("secure-pass");
        await Promise.all([
          page.waitForURL(/\/$/),
          page.getByRole("button", { name: /Accept|Sign In|Submitting|Accepting/i }).click(),
        ]);
        await expectSignedInAs(page, chosenUsername);
      } finally {
        await inviteeCtx.close();
      }

      // Switch back to admin context and verify the row flipped from
      // `pending-<base36>` / `invited` to `<chosenUsername>` / `active`.
      const adminBrowserCtx = await browser.newContext({
        storageState: authFileFor("admin"),
      });
      try {
        const adminPage = await adminBrowserCtx.newPage();
        await gotoTable(adminPage, "users");
        const table = adminPage.locator("table[data-as-main-table]");
        const usernameIdx = await columnCellIndex(table, "username");
        const emailIdx = await columnCellIndex(table, "email");
        const statusIdx = await columnCellIndex(table, "status");
        await expect
          .poll(async () => await rowByCellText(table, usernameIdx, chosenUsername).count())
          .toBeGreaterThan(0);
        const row = rowByCellText(table, usernameIdx, chosenUsername).first();
        await expect(row.locator("td").nth(emailIdx)).toContainText(email);
        await expect(row.locator("td").nth(statusIdx)).toContainText(/active/i);
      } finally {
        await adminBrowserCtx.close();
      }
    });
  });

  test.describe("19.9 — invite duplicate email blocked", () => {
    test("19.9 raw — POST invite for existing email returns 409 'A user with that email already exists'", async () => {
      const ctx = await newRequestContext("admin");
      try {
        const start = await postWf(ctx, { wfid: "api/users/invite" });
        const submit = await postWf(ctx, {
          wfs: start.json.wfs,
          input: { email: "admin@demo.test", roleId: 3 },
        });
        // The step throws `HttpError(409)` so the wf endpoint surfaces a
        // non-2xx response; `postWf` returns the raw status.
        expect(submit.status).toBe(409);
        // Body shape from moost's HttpError serializer:
        // { statusCode: 409, error: 'Conflict', message: '...' }.
        const msg =
          (submit.json as { message?: string }).message ??
          (submit.json.error as { message?: string } | undefined)?.message;
        expect(msg).toBe("A user with that email already exists");
      } finally {
        await ctx.dispose();
      }
    });
  });

  test.describe("19.10 — non-admin invite rejected (server-side gate)", () => {
    test("19.10 raw — manager hits api/users/invite → 403 'Admin only'; no row inserted", async () => {
      const id = uniq();
      const targetEmail = `rejected-${id}@demo.test`;

      const managerCtx = await newRequestContext("manager");
      try {
        // The admin gate lives INSIDE `invite-start`; moost-wf drains the
        // first step on the START request, so 403 surfaces here — no `wfs`
        // token ever issued, nothing to smuggle past the gate.
        const start = await postWf(managerCtx, { wfid: "api/users/invite" });
        expect(start.status).toBe(403);
        const startMsg =
          (start.json as { message?: string }).message ??
          (start.json.error as { message?: string } | undefined)?.message;
        expect(startMsg).toBe("Admin only");
        expect(start.setCookie).toBeNull();
      } finally {
        await managerCtx.dispose();
      }

      // Verify no row was inserted — scan the full users page (avoids
      // hand-crafting a Uniquery `$filter` per the demo URL grammar).
      const adminCtx = await newRequestContext("admin");
      try {
        const resp = await adminCtx.get(
          "/api/db/tables/users/pages?$select=username,email&$page=1&$size=100",
        );
        expect(resp.ok()).toBe(true);
        const body = (await resp.json()) as { data: Array<{ email: string }> };
        expect(body.data.find((r) => r.email === targetEmail)).toBeUndefined();
      } finally {
        await adminCtx.dispose();
      }
    });
  });

  test.describe("19.11 — magic-link expiry", () => {
    // global-setup boots the server with `DEMO_INVITE_TTL_MS=2000` so
    // `invite-send`'s `@StepTTL` expires after ~2s. Test issues the
    // invite, sleeps past TTL, asserts the magic-link resume returns 410
    // and the pending row stays `Status: invited`.

    test("19.11 — magic link expires after TTL: resume returns 410; pending row stays 'invited'", async ({
      browser,
    }) => {
      const id = uniq();
      const email = `expire-${id}@demo.test`;

      // Issue the invite as admin via raw HTTP and capture the link.
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

      // Wait past the 2s TTL with margin for clock drift / GC pauses.
      await new Promise((r) => setTimeout(r, 2500));

      // The link is `http://localhost:3200/invite/<urlenc-token>`. A direct
      // GET would hit the SPA HTML — re-derive the `wfs` and POST it
      // (mirrors what the page-side AsWfForm does internally).
      const tokenMatch = link.match(/\/invite\/([^/?#]+)$/);
      if (!tokenMatch) throw new Error(`unexpected magic link format: ${link}`);
      const wfs = decodeURIComponent(tokenMatch[1]!);

      const anonReq = await newAnonRequestContext();
      try {
        const resume = await postWf(anonReq, { wfs });
        // `WorkflowsController` maps the engine's expired-state body
        // (`{ error: 'Invalid or expired workflow state' }`) to HTTP 410
        // Gone. Body retains `error` for diagnostics.
        expect(resume.status).toBe(410);
        const bodyError = (resume.json as { error?: string }).error;
        expect(bodyError).toMatch(/expired|invalid/i);
      } finally {
        await anonReq.dispose();
      }

      // UI surface — `useWfForm` uses raw fetch so `<WfExpiryBanner>` (wired
      // to the demo's wrapped fetch's `on410` bus) doesn't light up; the
      // page's `#wf.error` slot renders the Retry button instead, and the
      // InviteAcceptForm fields stay unmounted.
      const inviteeCtx = await newAnonBrowserContext(browser);
      try {
        const page = await inviteeCtx.newPage();
        await page.goto(link);
        await expect(page.locator('input[name="username"]')).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Retry/i })).toBeVisible();
      } finally {
        await inviteeCtx.close();
      }

      // Placeholder row stays `invited` — invite-start inserted it before
      // the TTL window, and TTL expiry doesn't delete it.
      const adminBrowserCtx = await browser.newContext({
        storageState: authFileFor("admin"),
      });
      try {
        const adminPage = await adminBrowserCtx.newPage();
        await gotoTable(adminPage, "users");
        const table = adminPage.locator("table[data-as-main-table]");
        const emailIdx = await columnCellIndex(table, "email");
        const statusIdx = await columnCellIndex(table, "status");
        await expect
          .poll(async () => await rowByCellText(table, emailIdx, email).count())
          .toBeGreaterThan(0);
        const row = rowByCellText(table, emailIdx, email).first();
        await expect(row.locator("td").nth(statusIdx)).toContainText(/invited/i);
      } finally {
        await adminBrowserCtx.close();
      }
    });
  });
});
