// Section 21 — wf-demo /qr-and-copy — verifies AsQrCode + AsCopy
// (`@atscript/vue-aooth`) render phantom values delivered via
// `@wf.context.pass` + `@ui.form.fn.value`.
//
// Unit tests in `vue-aooth/src/__tests__/` already cover the components in
// isolation; this smoke proves the end-to-end wire-up: workflow context →
// fn resolver → phantom `props.value` → rendered SVG / input.

import { expect, test } from "../fixtures";

test.describe("Section 21 — qr-and-copy phantom field renderers (smoke)", () => {
  test("21.1 QR svg + base32 secret + magic-link copy render from workflow context", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/qr-and-copy");

      // QR SVG: AsQrCode dynamic-imports `qrcode` and v-html's the SVG into
      // `.as-qr-code-svg`. Visibility = both the resolver fired (otherwise
      // no `props.value`) AND the optional `qrcode` peer dep is wired.
      const svg = page.locator(".as-qr-code-svg svg");
      await expect(svg).toBeVisible();

      // Manual-secret fallback. The server's base32 alphabet is
      // `A-Z2-7`, length 32 (160-bit secret). Match exact char-set so
      // a regression that pipes the URI through instead of the secret
      // would fail (URIs contain `:` and `/`).
      const secret = page.locator(".as-qr-code-secret");
      await expect(secret).toBeVisible();
      await expect(secret).toHaveText(/^[A-Z2-7]{32}$/);

      // Magic link: AsCopy's read-only input. Server generates
      // `https://example.com/invite/<32-hex>`.
      const copyInput = page.locator(".as-copy-input");
      await expect(copyInput).toHaveValue(/^https:\/\/example\.com\/invite\/[a-f0-9]{32}$/);

      // Click → swaps button label to "Copied". Clipboard write itself
      // requires a permission grant in headless Chromium; we assert the
      // label flip which only fires on a successful write.
      await ctx.grantPermissions(["clipboard-write", "clipboard-read"]);
      await page.getByRole("button", { name: /^Copy$/ }).click();
      await expect(page.getByRole("button", { name: /^Copied$/ })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("21.2 Continue submits and finishes with success banner", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await ctx.newPage();
      await page.goto("/wf-demo/qr-and-copy");

      // Wait until the QR has rendered — anchors that the first
      // requireInput round-trip resolved and the form is interactive.
      await expect(page.locator(".as-qr-code-svg svg")).toBeVisible();

      await page.getByRole("button", { name: /Continue/i }).click();
      await expect(page.getByText(/Done — in a real flow/i)).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
