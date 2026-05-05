import { existsSync, readFileSync, unlinkSync } from "node:fs";

import { killProcessGroup, SERVER_PID } from "./global-setup";

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(SERVER_PID)) return;

  let pid = 0;
  try {
    pid = Number(readFileSync(SERVER_PID, "utf8").trim());
  } catch {}

  if (pid > 0) killProcessGroup(pid);

  try {
    unlinkSync(SERVER_PID);
  } catch {}
}
