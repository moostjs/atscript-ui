import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const E2E_ROOT = dirname(fileURLToPath(import.meta.url));
export const E2E_TMP = resolve(E2E_ROOT, ".tmp");
export const SERVER_LOG = resolve(E2E_TMP, "server.log");
export const SERVER_PID = resolve(E2E_TMP, "server.pid");

export const SERVER_URL = "http://localhost:3200";
const READY_TIMEOUT_MS = 90_000;

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

function killStaleServer() {
  if (!existsSync(SERVER_PID)) return;
  try {
    const pid = Number(readFileSync(SERVER_PID, "utf8").trim());
    if (pid > 0) killProcessGroup(pid);
  } catch {}
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(E2E_TMP, { recursive: true });

  // Reap any orphan from a previous interrupted run.
  killStaleServer();

  // 1. Reset the sqlite seed BEFORE any dev server boots so the running
  //    server doesn't hold a stale connection while the file is rewritten.
  //    The demo's `db:setup` script wipes `.data/demo.db*` and re-seeds.
  const seed = spawnSync("pnpm", ["--filter", "@atscript/vue-demo", "run", "db:setup"], {
    stdio: "inherit",
    env: { ...process.env },
  });
  if (seed.status !== 0) {
    throw new Error(`db:setup failed (exit ${seed.status})`);
  }

  // 2. Spawn the dev server. `detached: true` puts it in its own process
  //    group so `globalTeardown` can kill the whole tree (pnpm wrapper +
  //    vite + moost) via `process.kill(-pid, ...)`.
  const out = openSync(SERVER_LOG, "w");
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
    env: { ...process.env, DEMO_NO_LATENCY: "1", DEMO_TEST_MODE: "1" },
  });
  if (!child.pid) throw new Error("Failed to spawn vue-demo dev server");
  writeFileSync(SERVER_PID, String(child.pid));
  child.unref();

  // 3. Wait until /api/me responds (200 or 401 — both prove the HTTP
  //    listener is bound and routing).
  try {
    await waitForReady(`${SERVER_URL}/api/me`);
  } catch (err) {
    // Surface the tail of the server log so failures are diagnosable.
    try {
      const tail = readFileSync(SERVER_LOG, "utf8").split("\n").slice(-40).join("\n");
      // eslint-disable-next-line no-console
      console.error(`\n[global-setup] server.log tail:\n${tail}\n`);
    } catch {}
    throw err;
  }
}
