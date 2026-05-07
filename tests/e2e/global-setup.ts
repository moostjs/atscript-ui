import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const E2E_ROOT = dirname(fileURLToPath(import.meta.url));
export const E2E_TMP = resolve(E2E_ROOT, ".tmp");

/** Number of demo-server replicas spawned by `globalSetup`. Each replica gets
 *  its own port (`BASE_PORT + i`), its own SQLite file (`E2E_TMP/db-i/demo.db`)
 *  and its own server log (`E2E_TMP/server-i.log`). Tests are routed to the
 *  matching replica via Playwright's `parallelIndex` (see `tests/e2e/fixtures.ts`).
 *  Default 1 → unchanged single-server behaviour. Set `E2E_WORKERS=4` for
 *  parallel runs. */
export const WORKERS = Math.max(1, Number(process.env.E2E_WORKERS ?? 1));
export const BASE_PORT = Number(process.env.E2E_BASE_PORT ?? 3200);

/** URL of replica 0. Hardcoded usages (auth.setup, magic-link assertions that
 *  predate the fan-out) keep using this. Per-worker tests should resolve the
 *  URL via the `baseURL` fixture in `tests/e2e/fixtures.ts`. */
export const SERVER_URL = workerUrl(0);
const READY_TIMEOUT_MS = 90_000;

export function workerUrl(idx: number): string {
  return `http://localhost:${BASE_PORT + idx}`;
}

export function workerDbPath(idx: number): string {
  return resolve(E2E_TMP, `db-${idx}`, "demo.db");
}

export function workerLogPath(idx: number): string {
  return resolve(E2E_TMP, `server-${idx}.log`);
}

export function workerPidPath(idx: number): string {
  return resolve(E2E_TMP, `server-${idx}.pid`);
}

/** Backwards-compat aliases. Callers that still use the singular forms are
 *  implicitly pinned to replica 0. */
export const SERVER_LOG = workerLogPath(0);
export const SERVER_PID = workerPidPath(0);

/**
 * Kill a process group spawned with `detached: true`. Tries the process-
 * group form first, falls back to the bare PID, swallows EPERM/ESRCH so a
 * stale PID file can never break setup or teardown.
 */
export function killProcessGroup(pid: number, signal: NodeJS.Signals = "SIGTERM"): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {}
  }
}

async function waitForReady(url: string, timeoutMs = READY_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET" });
      // 401 from /api/me also means the server is up — auth not yet established.
      if (res.ok || res.status === 401) return;
    } catch {
      // Connection refused / DNS — keep polling.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Dev server did not become ready at ${url} within ${timeoutMs}ms`);
}

function killStaleServers(workers: number) {
  for (let i = 0; i < workers; i++) {
    const pidPath = workerPidPath(i);
    if (!existsSync(pidPath)) continue;
    try {
      const pid = Number(readFileSync(pidPath, "utf8").trim());
      if (pid > 0) killProcessGroup(pid);
    } catch {}
  }
}

async function setupWorker(idx: number): Promise<void> {
  const port = BASE_PORT + idx;
  const dbPath = workerDbPath(idx);
  const logPath = workerLogPath(idx);
  const pidPath = workerPidPath(idx);
  const url = workerUrl(idx);

  mkdirSync(dirname(dbPath), { recursive: true });

  // 1. Reset the sqlite seed BEFORE the server boots so the running server
  //    doesn't hold a stale connection while the file is rewritten. The
  //    demo's `db:setup` script wipes `<DEMO_DB_PATH>*` and re-seeds.
  const seed = spawnSync("pnpm", ["--filter", "@atscript/vue-demo", "run", "db:setup"], {
    stdio: "inherit",
    env: { ...process.env, DEMO_DB_PATH: dbPath },
  });
  if (seed.status !== 0) {
    throw new Error(`db:setup failed for worker ${idx} (exit ${seed.status})`);
  }

  // 2. Spawn the dev server. `detached: true` puts it in its own process
  //    group so `globalTeardown` can kill the whole tree (pnpm wrapper +
  //    vite + moost) via `process.kill(-pid, ...)`.
  const out = openSync(logPath, "w");
  const child = spawn("pnpm", ["--filter", "@atscript/vue-demo", "run", "dev"], {
    stdio: ["ignore", out, out],
    detached: true,
    // `DEMO_NO_LATENCY=1` disables the 50/100 ms delays in
    // `packages/vue-demo/src/server/interceptors/latency.ts`. Tests that
    // actually need to observe loading states (Scenario 12.1) inject their
    // own delay via `page.route(...)` — that's deterministic and doesn't
    // depend on the natural latency surviving Playwright's locator polling.
    //
    // `DEMO_TEST_MODE=1` mounts `POST /api/_test/reset-seed` (see
    // `packages/vue-demo/src/server/controllers/test.controller.ts`). The
    // helper `resetSeed()` calls that endpoint instead of shelling out to
    // `db:setup` — wiping `.data/demo.db` on disk would desync the dev
    // server's long-lived better-sqlite3 connection and flip writes to
    // read-only mid-flight.
    // `DEMO_INVITE_TTL_MS=2000` shortens the invite magic-link TTL so 19.11
    // can verify expiry without waiting real time. Read by invite.workflow.ts
    // only when `DEMO_TEST_MODE=1`.
    // `DEMO_DB_PATH` + `PORT` + `DEMO_BASE_URL` route this replica to its
    // dedicated DB file and listen port. `DEMO_BASE_URL` is what the
    // workflow email-sender stamps into magic-link URLs — must match the
    // replica's actual listen URL so 19.11's link round-trips.
    env: {
      ...process.env,
      DEMO_NO_LATENCY: "1",
      DEMO_TEST_MODE: "1",
      DEMO_INVITE_TTL_MS: "2000",
      DEMO_DB_PATH: dbPath,
      PORT: String(port),
      DEMO_BASE_URL: url,
    },
  });
  if (!child.pid) throw new Error(`Failed to spawn vue-demo dev server for worker ${idx}`);
  writeFileSync(pidPath, String(child.pid));
  child.unref();

  // 3. Wait until /api/me responds (200 or 401 — both prove the HTTP
  //    listener is bound and routing).
  try {
    await waitForReady(`${url}/api/me`);
  } catch (err) {
    // Surface the tail of the server log so failures are diagnosable.
    try {
      const tail = readFileSync(logPath, "utf8").split("\n").slice(-40).join("\n");
      // eslint-disable-next-line no-console
      console.error(`\n[global-setup] worker ${idx} server log tail:\n${tail}\n`);
    } catch {}
    throw err;
  }
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(E2E_TMP, { recursive: true });

  // Reap any orphans from a previous interrupted run (across all expected
  // worker slots, even if the previous run was at a different WORKERS).
  killStaleServers(Math.max(WORKERS, 8));

  // Sequential per-worker setup so seed errors are diagnosable. Boot is the
  // bottleneck (~3-6 s per replica) but happens once per suite run.
  for (let i = 0; i < WORKERS; i++) {
    await setupWorker(i);
  }
}
