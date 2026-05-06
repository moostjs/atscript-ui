import type { Page, Request } from "@playwright/test";

export interface WireRecord {
  url: string;
  method: string;
  body?: unknown;
  ts: number;
}

export interface WireCapture {
  /** All matching requests captured since the last `reset()` (or since attach). */
  records: WireRecord[];
  /** Clear `records` mid-test without detaching the listener. */
  reset: () => void;
  /** Detach the listener — call from `try/finally` to avoid leaking handlers across tests. */
  dispose: () => void;
}

export interface CaptureOpts {
  /** Substring the request URL must contain to be captured. */
  urlSubstring: string;
  /** Restrict by HTTP method (case-sensitive uppercase). Default: any method. */
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
}

/**
 * Attach a `request` listener that pushes every matching request onto a
 * `records[]` array. Bodies are JSON-parsed when possible, fall back to
 * the raw string. The returned `dispose()` MUST be called from a
 * `try/finally` (or test teardown) to avoid leaking listeners across
 * tests — one of batch F's flake sources was the un-removed listener
 * accumulating handlers across the whole serial chain.
 *
 * @example
 * const wire = captureWire(page, { urlSubstring: "/api/db/_presets" });
 * try {
 *   // ... interact ...
 *   expect(wire.records.find((r) => r.method === "POST")).toBeDefined();
 * } finally {
 *   wire.dispose();
 * }
 */
export function captureWire(page: Page, opts: CaptureOpts): WireCapture {
  const records: WireRecord[] = [];
  const handler = (req: Request) => {
    if (!req.url().includes(opts.urlSubstring)) return;
    const method = req.method();
    if (opts.method && method !== opts.method) return;
    let body: unknown;
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      try {
        body = req.postDataJSON();
      } catch {
        body = req.postData();
      }
    }
    records.push({ url: req.url(), method, body, ts: Date.now() });
  };
  page.on("request", handler);
  return {
    records,
    reset() {
      records.length = 0;
    },
    dispose() {
      page.off("request", handler);
    },
  };
}

/**
 * Convenience: capture POST bodies to URLs containing `urlSubstring` and
 * expose the most-recent body via a `.body()` getter. Mirrors the original
 * batch-F `captureWirePost` shape but with a `.dispose()` to avoid the
 * listener leak. Returns `null` until the first matching POST fires.
 */
export function captureLastPost(
  page: Page,
  urlSubstring: string,
): { body: () => string | null; dispose: () => void } {
  let body: string | null = null;
  const handler = (req: Request) => {
    if (req.url().includes(urlSubstring) && req.method() === "POST") {
      body = req.postData();
    }
  };
  page.on("request", handler);
  return {
    body: () => body,
    dispose: () => page.off("request", handler),
  };
}

/**
 * Convenience for the `/api/db/_presets` capture pattern (batch H). Same
 * shape as `captureWire(page, { urlSubstring: "/api/db/_presets" })` but
 * narrower call-site footprint at the consumer.
 */
export function capturePresetWire(page: Page): WireCapture {
  return captureWire(page, { urlSubstring: "/api/db/_presets" });
}
