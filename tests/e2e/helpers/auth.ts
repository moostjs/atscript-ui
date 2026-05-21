import type { APIRequestContext } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serverLogOffset, waitForOtp } from "./outlet";

const HELPERS_DIR = dirname(fileURLToPath(import.meta.url));

export const DEMO_PASSWORD = "demo-password";

export type DemoRole = "admin" | "manager" | "viewer" | "alice";

export interface RoleSpec {
  username: DemoRole;
  password: string;
  /** True when the seed marks this user `mfaEnabled: true`. */
  mfa: boolean;
  /** Email used by the demo's MFA outlet — must match the seed. */
  email?: string;
}

export const DEMO_ROLES: RoleSpec[] = [
  { username: "admin", password: DEMO_PASSWORD, mfa: false },
  { username: "manager", password: DEMO_PASSWORD, mfa: false },
  { username: "viewer", password: DEMO_PASSWORD, mfa: false },
  { username: "alice", password: DEMO_PASSWORD, mfa: true, email: "alice@demo.test" },
];

/**
 * Absolute path of the storage-state JSON for a given role. Phase-1 specs
 * pick this via `playwright.config.ts` `use.storageState`; Phase-2 specs
 * import this when they need to switch role mid-file.
 */
export function authFileFor(role: DemoRole): string {
  return resolve(HELPERS_DIR, "../../../playwright/.auth/", `${role}.json`);
}

interface WfResponse {
  wfs?: string;
  finished?: boolean;
  ok?: boolean;
  inputRequired?: { payload: unknown; transport: string; context?: Record<string, unknown> };
  error?: { message?: string; [k: string]: unknown };
  [k: string]: unknown;
}

async function postWf(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<WfResponse> {
  const res = await request.post("/api/wf", {
    data: body,
    headers: { "content-type": "application/json" },
  });
  if (!res.ok()) {
    throw new Error(`/api/wf ${res.status()}: ${await res.text()}`);
  }
  return (await res.json()) as WfResponse;
}

/**
 * Run the `api/auth/login` workflow handshake against the demo and leave
 * the resulting `demo.sid` cookie on the supplied APIRequestContext.
 *
 * For MFA users (`alice`), this reads the OTP via the outlet sink
 * (`helpers/outlet.ts`) which tails the demo dev server's stdout log.
 */
export async function performLogin(request: APIRequestContext, role: RoleSpec): Promise<void> {
  // Step 1 — start the workflow.
  const start = await postWf(request, { wfid: "api/auth/login" });
  if (!start.wfs) throw new Error("login: missing wfs token after start");

  // Step 2 — submit credentials. Server replies with either:
  //   (a) `{ finished: true, ok: true, ... }` + Set-Cookie (non-MFA), or
  //   (b) `{ wfs: <new>, inputRequired: <mfa form> }` (MFA path).
  // Capture the server-log byte offset BEFORE the request so the outlet
  // sink only matches the OTP line this submission produced (not a stale
  // one from a prior test run).
  const otpAnchor = serverLogOffset();
  const credentials = await postWf(request, {
    wfs: start.wfs,
    input: { formData: { username: role.username, password: role.password } },
  });

  if (credentials.error) {
    throw new Error(`login(${role.username}): ${credentials.error.message ?? "unknown error"}`);
  }

  if (credentials.finished) {
    // Non-MFA branch — Playwright tracked the Set-Cookie via the
    // APIRequestContext, no further work needed.
    return;
  }

  if (!role.mfa) {
    throw new Error(
      `login(${role.username}): expected non-MFA finish, got intermediate response: ${JSON.stringify(credentials)}`,
    );
  }

  if (!credentials.wfs) {
    throw new Error(`login(${role.username}): missing wfs token at MFA step`);
  }

  // Step 3 (MFA only) — pull the OTP from the dev-server stdout sink.
  if (!role.email) throw new Error(`login(${role.username}): MFA role missing email`);
  const code = await waitForOtp({ email: role.email, sinceOffset: otpAnchor });
  const finished = await postWf(request, {
    wfs: credentials.wfs,
    input: { formData: { code } },
  });
  if (!finished.finished) {
    throw new Error(
      `login(${role.username}): MFA submission did not finish: ${JSON.stringify(finished)}`,
    );
  }
}
