/**
 * `true` outside a production build — the gate for authoring-time warnings, so
 * their strings and checks cost a shipped app nothing.
 *
 * Read from `process.env.NODE_ENV` rather than `import.meta.env`: bundlers
 * replace this expression with a literal in both the ESM and the CJS output,
 * while `import.meta` only exists in the former. Where neither a bundler nor a
 * `process` shim is present the read throws — warnings stay on, which is the
 * safe side of the trade.
 */
function detectDev(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true;
  }
}

export const DEV: boolean = detectDev();
