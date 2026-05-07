import { existsSync, readFileSync, unlinkSync } from "node:fs";

import { killProcessGroup, WORKERS, workerPidPath } from "./global-setup";

export default async function globalTeardown(): Promise<void> {
  // Kill every replica we know about. Use `Math.max(WORKERS, 8)` to also reap
  // stale PIDs from previous runs at higher worker counts so an interrupted
  // 8-worker run can't leak a server when the next run is only 2-worker.
  for (let i = 0; i < Math.max(WORKERS, 8); i++) {
    const pidPath = workerPidPath(i);
    if (!existsSync(pidPath)) continue;

    let pid = 0;
    try {
      pid = Number(readFileSync(pidPath, "utf8").trim());
    } catch {}

    if (pid > 0) killProcessGroup(pid);

    try {
      unlinkSync(pidPath);
    } catch {}
  }
}
