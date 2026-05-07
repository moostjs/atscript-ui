# E2E parallel-workers proposal

**Status:** implemented. Default is still `E2E_WORKERS=1` for unchanged single-server behaviour; opt into parallel runs with `E2E_WORKERS=4 pnpm test:e2e`.

**Context:** Originally captured at commit `ec6efba` when the suite was forced to `workers: 1` (~4m6s wall time) to dodge cross-worker SQLite contention. Implementation lands the per-worker server+DB design proposed below: each Playwright parallel slot now owns its own `:3200+i` server + `tests/e2e/.tmp/db-i/demo.db` SQLite file. Two consecutive 100% green runs at `E2E_WORKERS=4`: 258 passed in ~2.1m (49% reduction).

**Implementation notes:**
- `process.env.TEST_WORKER_INDEX` (Playwright's `workerIndex`) is unbounded — increments past `WORKERS-1` whenever a worker process restarts (e.g. between test files for isolation). Helpers must read `process.env.TEST_PARALLEL_INDEX` instead, which is stamped by the `auto: true` `workerBaseURL` fixture in `tests/e2e/fixtures.ts` from `workerInfo.parallelIndex` (bounded by `WORKERS`).
- The `auto: true` flag is load-bearing: tests like `19.1 raw HTTP` don't destructure `baseURL` and would otherwise leave `TEST_PARALLEL_INDEX` unset — helpers would silently route to replica 0 across all workers.
- A single SSR-warmup pass (`fetch /` + `fetch /login`) happens at the end of `setupWorker(idx)`; without it, the first navigation on a freshly-spawned replica eats a 5-15s cold-Vite-SSR delay that blows past `page.waitForURL`'s 20s timeout under 4-way CPU contention.
- `f-actions-mutating/section-8-actions-mutating.spec.ts` mutates `admin → suspended` and never restores. Files that do fresh form-based admin login (`k-workflows/section-19-workflows.spec.ts`) need `resetSeed()` in `beforeAll` so they survive landing on a worker that already ran section 8. Under parallel workers `resetSeed()` only touches the calling worker's DB — no cross-batch race like in the shared-DB era.

## Problem

The current single-server-shared-DB design forces workers=1 for reliability:

- Phase-1 bootstrap spins **one** dev server on `:3200` with one SQLite file at `packages/vue-demo/.data/demo.db`.
- All Playwright workers route requests to the same server → same connection → same tables.
- Mutating batches (F/H/J/K/L) write to `users`, `_presets`, `audit_log` in parallel.
- SQLite transactions race; resetSeed inside one worker can collide with another worker's mid-transaction write → `cannot start a transaction within a transaction` and similar flakes.
- Within-file serial mode (now applied across F/G/H/I/J/K/L) eliminates within-file races but cannot fix cross-file/cross-worker races.

## Proposed architecture

```
Worker 0 → http://localhost:3200 → tests/e2e/.tmp/db-0/demo.db
Worker 1 → http://localhost:3201 → tests/e2e/.tmp/db-1/demo.db
Worker 2 → http://localhost:3202 → tests/e2e/.tmp/db-2/demo.db
Worker 3 → http://localhost:3203 → tests/e2e/.tmp/db-3/demo.db
```

Each worker is fully isolated. No shared state, no contention. `resetSeed()` becomes a per-worker operation that only affects that worker's DB.

## Implementation plan

### 1. `vue-demo` server reads `DEMO_DB_PATH`

**File:** `packages/vue-demo/src/server/setup.ts` (and adapter wiring in `main.ts`).

Confirm whether `DEMO_DB_PATH` is already honoured. If not, plumb it through:

```ts
const DB_PATH = process.env.DEMO_DB_PATH ?? resolve(__dirname, "../../.data/demo.db");
const adapter = new SqliteAdapter(new BetterSqlite3Driver(DB_PATH));
```

`db:setup` script must also honour this so each worker's seed lands at the right path.

**LOC estimate:** ~5-10 LOC (likely already supports it; needs verification).

### 2. `global-setup.ts` fans out N servers

Replace the single-server spawn with a loop. Worker count derives from `process.env.PLAYWRIGHT_WORKERS ?? 4` (capped at CPU count).

```ts
const WORKERS = Number(process.env.PLAYWRIGHT_WORKERS ?? 4);
const BASE_PORT = 3200;

export default async function globalSetup(): Promise<void> {
  mkdirSync(E2E_TMP, { recursive: true });
  killStaleServers(WORKERS);

  // Sequential per-worker setup so seed errors are diagnosable.
  for (let i = 0; i < WORKERS; i++) {
    await setupWorker(i);
  }
}

async function setupWorker(idx: number): Promise<void> {
  const port = BASE_PORT + idx;
  const dbDir = resolve(E2E_TMP, `db-${idx}`);
  const dbPath = resolve(dbDir, "demo.db");
  const logPath = resolve(E2E_TMP, `server-${idx}.log`);
  const pidPath = resolve(E2E_TMP, `server-${idx}.pid`);

  mkdirSync(dbDir, { recursive: true });

  // Per-worker seed
  const seed = spawnSync("pnpm", ["--filter", "@atscript/vue-demo", "run", "db:setup"], {
    stdio: "inherit",
    env: { ...process.env, DEMO_DB_PATH: dbPath },
  });
  if (seed.status !== 0) throw new Error(`db:setup failed for worker ${idx}`);

  // Spawn server
  const out = openSync(logPath, "w");
  const child = spawn("pnpm", ["--filter", "@atscript/vue-demo", "run", "dev"], {
    stdio: ["ignore", out, out],
    detached: true,
    env: {
      ...process.env,
      DEMO_NO_LATENCY: "1",
      DEMO_TEST_MODE: "1",
      DEMO_INVITE_TTL_MS: "2000",
      DEMO_DB_PATH: dbPath,
      PORT: String(port),
      // Shared session secret so auth.setup's storageState works on every server
      SESSION_SECRET: "dev-secret-change-me",
    },
  });
  if (!child.pid) throw new Error(`spawn failed for worker ${idx}`);
  writeFileSync(pidPath, String(child.pid));
  child.unref();

  await waitForReady(`http://localhost:${port}/api/me`);
}
```

**LOC estimate:** ~50 LOC (replaces ~30 existing).

### 3. Per-worker `baseURL` via worker fixture

**File:** new `tests/e2e/fixtures.ts` (NOT a barrel addition — separate test fixture file).

```ts
import { test as base } from "@playwright/test";

export const test = base.extend<{}, { workerBaseURL: string }>({
  workerBaseURL: [
    async ({}, use, workerInfo) => {
      const port = 3200 + workerInfo.parallelIndex;
      await use(`http://localhost:${port}`);
    },
    { scope: "worker" },
  ],
});

// Override default baseURL with worker-specific one
export const expect = base.expect;
```

Tests that currently `import { test } from "@playwright/test"` switch to `import { test } from "../fixtures"`. The fixture also overrides `request.newContext({ baseURL })` defaults — needs careful threading.

Actually: the **simplest** path is overriding the project-level `use.baseURL` per worker via:

```ts
// playwright.config.ts
projects: [{
  name: "tests",
  use: {
    baseURL: undefined, // resolved per-worker via fixture
  },
}]
```

with a worker fixture that injects `baseURL` into `page.use()` and `request.use()`. May need to drop down to overriding `BASE_URL` env var read by tests.

**LOC estimate:** ~30 LOC including config wiring.

### 4. Per-worker outlet sink

**File:** `tests/e2e/helpers/outlet.ts`.

Currently reads `tests/e2e/.tmp/server.log`. Change to:

```ts
const SERVER_LOG_BASE = resolve(HELPERS_DIR, "../.tmp");

function workerLog(): string {
  const idx = process.env.TEST_WORKER_INDEX ?? "0";
  return resolve(SERVER_LOG_BASE, `server-${idx}.log`);
}
```

`serverLogOffset()` and `readEntries()` use the per-worker path.

**LOC estimate:** ~10 LOC.

### 5. Auth fixture coordination

**File:** `tests/e2e/auth.setup.ts`.

Two strategies:

**(a) Shared session secret (simplest):** all servers verify the same HMAC. Auth setup runs against `:3200` only; the resulting cookie works on all 4 servers because they share `SESSION_SECRET`. Storage state file is single-source.

Done by setting `SESSION_SECRET` in global-setup's per-worker env (above). No auth.setup changes needed.

**(b) Per-worker auth (more isolated):** auth setup runs N times, writing `playwright/.auth/<role>.<worker>.json`. Tests reference per-worker storage. More verbose, more isolated.

**Recommendation: (a) — shared secret.** The demo's session cookie is HMAC-only; identity comes from the cookie payload. Same payload on all servers means same identity. This actually exercises the demo correctly: cookies are portable across server instances by design (e.g. for horizontal scaling). The "bug surface" of differing-secrets is not interesting to test.

**LOC estimate:** ~5 LOC (just env-var plumbing).

### 6. Hardcoded port audit

Grep `tests/e2e/` for `3200` and `localhost`. Replace literal-string assertions with `baseURL`-derived dynamic refs.

Known sites (preliminary scan):
- 19.8 magic-link: `expect(link).toMatch(\`http://localhost:${PORT}/invite/...\`)` — currently `:3200` hardcoded
- Outlet test data: `target: 'newuser@demo.test'` — fine, no port
- Some console-log assertions in batch K: review each

**LOC estimate:** ~5-15 LOC across 3-5 files.

### 7. `global-teardown.ts`

```ts
for (let i = 0; i < WORKERS; i++) {
  const pidPath = resolve(E2E_TMP, `server-${i}.pid`);
  if (existsSync(pidPath)) {
    const pid = Number(readFileSync(pidPath, "utf8").trim());
    if (pid > 0) killProcessGroup(pid);
  }
}
```

Plus optional `db-<i>` directory cleanup (or leave for next run's seed to overwrite).

**LOC estimate:** ~15 LOC.

## Trade-offs

| | Single-server (current) | Per-worker servers |
|---|---|---|
| Wall time (258 tests) | ~4m6s | ~1m20s on 4 workers (estimated) |
| Setup phase | ~6s (one server boot) | ~10-15s (N parallel boots) |
| RAM cost | ~250MB (one Vite dev) | ~1-1.5GB on 4 workers |
| CPU cost | low | scales linearly with workers |
| Disk | one DB file | N DB files (small) |
| Implementation effort | already done | ~80-100 LOC + audit pass, ~3-4 hours focused work |
| Reliability | bulletproof at workers=1 | bulletproof if implemented correctly |
| Cross-server bug surface | none | exercises demo's stateless-cookie behavior |

## Open decisions

1. **Worker count default.** Hardcode `4`? Read from `process.env.PLAYWRIGHT_WORKERS`? Cap at `os.cpus().length`?
2. **CI vs local.** CI usually has fewer cores than dev machines — sane default depends on runner sizing.
3. **`workers: 1` fallback.** Should we keep the option to force single-worker via an env var when debugging a flake? Probably yes.
4. **Auth strategy.** Confirm shared `SESSION_SECRET` is acceptable. If the demo's threat model requires per-instance secrets in production, the test rig diverges from production. Probably fine — tests don't model real-world deployment isolation, just request flows.
5. **Outlet sink granularity.** If a test reads from another worker's outlet log accidentally (e.g. via misconfigured `TEST_WORKER_INDEX`), it could match a stale OTP and pass for the wrong reason. Worker-id derivation must be bulletproof.

## Verification plan

After implementation:

1. Two consecutive `pnpm test:e2e` runs at workers={1, 2, 4, 8} all 100% green.
2. Total wall-time captured for each.
3. Specifically retry the known flake roster (`8.x`, `10.1b`, `11.5`, `11.7.2`, `16.9`, `17.3`) — they should never flake again.
4. `vp lint` + `vp fmt` clean.

## When to do this

**Worth implementing if:**
- CI runs the full suite often (every PR, on multiple branches), and the wall time becomes a productivity drag
- The suite keeps growing (more batches, more scenarios)
- Local development frequency exposes the workers=1 wall time as a real bottleneck

**Defer if:**
- 4m6s on workers=1 is acceptable for current dev cadence
- The atscript-db `0.1.69` upstream work changes the test surface meaningfully (then this refactor would target the wrong code)
- The current flake roster is fully closed and we don't want to introduce new infrastructure complexity

## Alternative: per-test transaction isolation

A different long-term direction: instead of N servers, **wrap each test in a transaction** that rolls back at the end. Each test sees a clean slate without needing process isolation. This is the standard pattern in Rails/Django/etc. test suites.

Implementation requires atscript-db work:
- Test-mode flag that intercepts every controller request and wraps it in a savepoint
- Test framework hook that begins/rolls-back the savepoint per-test
- Doesn't fix workers=1 by itself (single-connection bottleneck remains) — needs to be combined with connection pooling

More framework-level work. Worth keeping in mind but probably not the next move.

## References

- Current single-worker config: [`tests/e2e/playwright.config.ts`](tests/e2e/playwright.config.ts) commit `ec6efba`
- Within-file serial mode adoption: commits `96b565a`, `19c7a1d`, `ab555ee`
- Playwright worker fixtures docs: https://playwright.dev/docs/test-fixtures#worker-scoped-fixtures
- Original PLAN.md "Coordination rules for parallel agents": [`tests/e2e/PLAN.md`](tests/e2e/PLAN.md)
