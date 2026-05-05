import { expect, type Page } from "@playwright/test";

interface GotoTableOptions {
  /** Override the API path probed for `/meta` — defaults to the route slug. */
  apiPath?: string;
  /** How long to wait for the in-flight requests to settle. */
  timeoutMs?: number;
}

/**
 * Navigate to a demo table route and wait for the first-paint network round
 * trip to settle: `/api/db/tables/<table>/meta` (~50 ms) + the initial
 * `/pages` query (~100 ms).
 *
 * Phase-1 smoke + Phase-2 specs both should call this instead of a bare
 * `page.goto(...)` so the "loading skeleton" overlay has cleared and the
 * table body is interactable before the first assertion runs.
 */
export async function gotoTable(
  page: Page,
  slug: string,
  opts: GotoTableOptions = {},
): Promise<void> {
  const { apiPath = slug, timeoutMs = 15_000 } = opts;
  const metaUrl = `**/api/db/tables/${apiPath}/meta`;
  const pagesUrl = `**/api/db/tables/${apiPath}/pages**`;

  // Pre-arm the waiters BEFORE navigating so we never miss a request.
  const metaPromise = page.waitForResponse(metaUrl, { timeout: timeoutMs });
  const pagesPromise = page.waitForResponse(pagesUrl, { timeout: timeoutMs });

  await page.goto(`/${slug}`);
  await Promise.all([metaPromise, pagesPromise]);

  // Loading overlay clears once `state.loadingMetadata` flips false. The demo
  // renders the overlay as `<div class="absolute inset-0 grid place-items-center">Loading…</div>`
  // — assert it's gone so subsequent locators don't race against it.
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0, { timeout: timeoutMs });
}
