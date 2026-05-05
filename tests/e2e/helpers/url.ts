import { expect, type Page } from "@playwright/test";

/**
 * Assert that `page.url()` contains every fragment after decoding both sides.
 *
 * Decoded comparison is mandatory: `URLSearchParams` re-encodes operator
 * characters (`~`, `'`, `/`, `=`) that `@uniqu/url`'s `buildUrl` emits raw.
 * A byte-wise `toContain` would false-fail on `status~='/bob/i'` versus
 * `status~%3D%27%2Fbob%2Fi%27` — the regression the URL-bridge echo guard
 * was patched to handle (TABLE_SCENARIOS.md, Scenario 6.4).
 */
export function expectUrlQuery(
  page: Page,
  fragments: string | string[],
  opts: { not?: boolean } = {},
): void {
  const list = typeof fragments === "string" ? [fragments] : fragments;
  const decoded = decodeURIComponent(page.url());
  for (const fragment of list) {
    const target = decodeURIComponent(fragment);
    if (opts.not) {
      expect(decoded, `expected URL NOT to contain "${target}", got: ${decoded}`).not.toContain(
        target,
      );
    } else {
      expect(decoded, `expected URL to contain "${target}", got: ${decoded}`).toContain(target);
    }
  }
}
