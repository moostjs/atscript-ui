import type { Page, Request } from "@playwright/test";

export interface PagesObserverOptions {
  /**
   * Narrow to a specific table — matches `/api/db/tables/<table>/pages`.
   * Omit to match the unscoped `/pages` family across any table.
   */
  table?: string;
  /**
   * Quiet window (ms) past the LAST matching request before resolving.
   * Defaults to 700 ms (the table state machine debounces queries at 500 ms;
   * 700 leaves headroom for the response round-trip + microtask flush).
   *
   * Implementation note: we intentionally do NOT use `page.waitForRequest()`
   * — it resolves on the first match and would silently miss double-fires,
   * which is exactly what these helpers were built to catch (Conventions
   * baseline: "1 query" means EXACTLY one).
   */
  quietWindowMs?: number;
  /** Hard ceiling so a stuck callback can't hang the test. Default 10 s. */
  timeoutMs?: number;
}

interface CapturedPagesRequest {
  url: string;
  method: string;
  startedAt: number;
}

const PAGES_RE = /\/api\/db\/tables\/([^/?]+)\/pages(?:\?|$)/u;

function makeMatcher(table?: string) {
  return (req: Request) => {
    const url = req.url();
    const m = url.match(PAGES_RE);
    if (!m) return false;
    if (table !== undefined && m[1] !== table) return false;
    return true;
  };
}

async function observePages(
  page: Page,
  fn: () => Promise<void> | void,
  opts: PagesObserverOptions = {},
): Promise<CapturedPagesRequest[]> {
  const { table, quietWindowMs = 700, timeoutMs = 10_000 } = opts;
  const match = makeMatcher(table);
  const captured: CapturedPagesRequest[] = [];
  let lastSeenAt = 0;

  const handler = (req: Request) => {
    if (!match(req)) return;
    captured.push({ url: req.url(), method: req.method(), startedAt: Date.now() });
    lastSeenAt = Date.now();
  };
  page.on("request", handler);

  try {
    await fn();

    // We need to wait for "no matching request fired in the last
    // `quietWindowMs`". Initial wait covers the case of zero requests.
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idle = lastSeenAt === 0 ? Date.now() - start : Date.now() - lastSeenAt;
      if (idle >= quietWindowMs) break;
      await page.waitForTimeout(50);
    }
  } finally {
    page.off("request", handler);
  }

  return captured;
}

/**
 * Run `fn`, then wait for the 700 ms debounce window to close past the last
 * matching `/pages` request. Throws if anything other than ONE request was
 * observed.
 *
 * Use this for every "X must trigger exactly one query" assertion (the
 * Conventions baseline at the top of TABLE_SCENARIOS.md, and the URL-bridge
 * echo regression at Scenario 6.4).
 */
export async function expectSinglePages(
  page: Page,
  fn: () => Promise<void> | void,
  opts: PagesObserverOptions = {},
): Promise<CapturedPagesRequest> {
  const captured = await observePages(page, fn, opts);
  if (captured.length !== 1) {
    const lines = captured.map((c, i) => `  [${i}] ${c.method} ${c.url}`).join("\n");
    throw new Error(
      `expectSinglePages: expected exactly 1 /pages request, observed ${captured.length}\n${lines || "  (none)"}`,
    );
  }
  return captured[0]!;
}

/**
 * Run `fn` and assert NO `/pages` request fired during the quiet window.
 * Use this for "this state mutation must NOT trigger a re-query" guarantees
 * (Scenario 5.3 — non-query-affecting settings dialog changes).
 */
export async function expectNoPages(
  page: Page,
  fn: () => Promise<void> | void,
  opts: PagesObserverOptions = {},
): Promise<void> {
  const captured = await observePages(page, fn, opts);
  if (captured.length !== 0) {
    const lines = captured.map((c, i) => `  [${i}] ${c.method} ${c.url}`).join("\n");
    throw new Error(
      `expectNoPages: expected 0 /pages requests, observed ${captured.length}\n${lines}`,
    );
  }
}
