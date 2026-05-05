import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HELPERS_DIR = dirname(fileURLToPath(import.meta.url));
const SERVER_LOG = resolve(HELPERS_DIR, "../.tmp/server.log");

// The login workflow logs MFA OTPs inline as:
//   📧 [auth-otp] → alice@demo.test
//       context: {"code":"123456"}
// (See packages/vue-demo/src/server/workflows/auth/login.workflow.ts.)
// The email-outlet console sender uses the same "📧 [<template>] → <target>"
// header for outbound mails, so the same regex serves both Phase-1 (MFA login)
// and Phase-2 batch K (workflow magic-links).
const OTP_HEADER_RE = /📧\s+\[([^\]]+)\]\s+→\s+(\S+)/u;
const CODE_RE = /"code"\s*:\s*"(\d+)"/u;
const TOKEN_RE = /link:\s+(\S+)/u;

export interface OutletEntry {
  /** Template name, e.g. `auth-otp`, `user-invite`, `password-reset`. */
  template: string;
  /** Recipient address as logged by the workflow. */
  target: string;
  /** Numeric OTP if the workflow attached one to the context. */
  code?: string;
  /** Raw context line (JSON-ish) for ad-hoc parsing by Phase-2 tests. */
  contextLine?: string;
  /** Resume URL for outlet-paused workflows (invite / magic-link). */
  link?: string;
  /** Byte offset inside `server.log` where the entry starts. */
  offset: number;
}

interface WaitOptions {
  /**
   * Return only entries whose byte offset in `server.log` is at or after
   * this value. Capture it via `serverLogOffset()` BEFORE the action that
   * should produce the outlet event, so a stale entry from a previous test
   * cannot satisfy the wait.
   */
  sinceOffset?: number;
  /** Filter by recipient address. Required for OTPs (e.g. `alice@demo.test`). */
  email?: string;
  /** Filter by outlet template. Defaults to `auth-otp` for MFA login. */
  template?: string;
  /** How long to keep polling. Default 8 s — well past the 100 ms server latency. */
  timeoutMs?: number;
  /** Polling cadence. Default 100 ms. */
  pollMs?: number;
}

/**
 * Current byte size of `tests/e2e/.tmp/server.log`. Capture this BEFORE the
 * action that should produce an outlet entry, then pass it to
 * `waitForOtp({ sinceOffset })` so the helper ignores prior log content.
 */
export function serverLogOffset(): number {
  try {
    return statSync(SERVER_LOG).size;
  } catch {
    return 0;
  }
}

function readEntries(): OutletEntry[] {
  let buf: Buffer;
  try {
    buf = readFileSync(SERVER_LOG);
  } catch {
    return [];
  }

  const text = buf.toString("utf8");
  const entries: OutletEntry[] = [];
  const lines = text.split("\n");
  // Walk byte offsets — `📧` is 4 bytes / 2 JS chars; tracking line.length
  // would drift versus the byte-based `serverLogOffset()` anchor.
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineStart = cursor;
    cursor += Buffer.byteLength(line, "utf8") + 1; // +1 for consumed '\n'.
    const headerMatch = line.match(OTP_HEADER_RE);
    if (!headerMatch) continue;
    const [, template, target] = headerMatch;
    if (!template || !target) continue;
    const ctxLine = lines[i + 1] ?? "";
    const linkLine = lines[i + 2] ?? "";
    const codeMatch = ctxLine.match(CODE_RE);
    const linkMatch = linkLine.match(TOKEN_RE);
    entries.push({
      template,
      target,
      code: codeMatch?.[1],
      contextLine: ctxLine.trim() || undefined,
      link: linkMatch?.[1],
      offset: lineStart,
    });
  }
  return entries;
}

/**
 * Block until an outlet entry that satisfies `opts` lands in the dev-server
 * stdout log. Throws on timeout. The default template is `auth-otp` and the
 * code is required — callers that want any matching entry without a code
 * should pass `template` explicitly.
 */
export async function waitForOutletEntry(opts: WaitOptions = {}): Promise<OutletEntry> {
  const { email, template = "auth-otp", timeoutMs = 8_000, pollMs = 100, sinceOffset = 0 } = opts;
  const anchor = sinceOffset;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const matches = readEntries().filter(
      (e) =>
        e.offset >= anchor &&
        e.template === template &&
        (email === undefined || e.target === email),
    );
    const last = matches[matches.length - 1];
    if (last) return last;
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    `Outlet entry not seen within ${timeoutMs}ms (template=${template}, email=${email ?? "*"}, anchor=${anchor})`,
  );
}

/**
 * Convenience for MFA login: returns the OTP code directly.
 * For Phase 2 batch K (workflows), use `waitForOutletEntry` to also access
 * `link` / `contextLine`.
 */
export async function waitForOtp(opts: WaitOptions): Promise<string> {
  const entry = await waitForOutletEntry({ template: "auth-otp", ...opts });
  if (!entry.code) {
    throw new Error(
      `Outlet entry matched (template=${entry.template}, target=${entry.target}) but had no \`code\` field`,
    );
  }
  return entry.code;
}
