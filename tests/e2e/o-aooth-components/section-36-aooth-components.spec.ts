// Section 36 — Aooth Tier-1 components (`@atscript/vue-aooth`).
//
// Covers the two demo Tier-1 components rendered on
// `/forms-demo/aooth-components`:
//
//   • Section A — `AsConsentArray` editing a `string[]` of accepted
//     consent ids. Backend provides the pending list via
//     `@ui.form.fn.attr 'pendingConsents'`. Required items surface
//     per-row error messages on submit; non-required items never do.
//
//   • Section B — `AsPasswordRules`, a display-only fulfillment list
//     driven by `@ui.form.fn.attr 'policies'` (serialized rule
//     strings compiled via `compileFieldFn`) plus a second dynamic
//     attr `password` that reads the sibling `newPassword` field on
//     every keystroke. Both password inputs must remain masked.
//
// Both sections expose their model JSON via a `<details>` block
// (`data-testid=aooth-components-section-{a,b}-preview`) so we read
// the committed user value verbatim.

import { expect, test, type Locator, type Page } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/aooth-components");
  await page.waitForLoadState("networkidle");
  // Wait until both Tier-1 components have hydrated before any test
  // acts; consent group + password-rule list both render server-side
  // immediately so we anchor on their stable class selectors.
  await expect(
    page.locator('[data-testid="aooth-components-section-a-form"] .as-consent-array-group'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="aooth-components-section-b-form"] .as-password-rules-list'),
  ).toHaveCount(1);
}

const section = (page: Page, s: "a" | "b"): Locator =>
  page.getByTestId(`aooth-components-section-${s}-form`);

// Section A's `Accept & continue` submit button and Section B's password
// inputs occasionally collide with sibling components' hit boxes in the
// narrow demo viewport. Dispatch clicks directly to bypass Playwright's
// pointer-intercept check — matches the section-24 sibling pattern.
const tap = (locator: Locator): Promise<void> => locator.dispatchEvent("click");

async function readValue<T = unknown>(page: Page, s: "a" | "b"): Promise<T> {
  const txt = (await page.getByTestId(`aooth-components-section-${s}-preview`).textContent()) ?? "";
  return (JSON.parse(txt) as { value: T }).value;
}

test.describe("Section 36 — aooth Tier-1 components", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── A1. Backend list shape — 4 checkboxes match the schema ──────
  test("Section A renders one checkbox per backend-supplied consent (4 items)", async ({
    page,
  }) => {
    // WHY: if the `pendingConsents` wire contract changes shape (or the
    // dynamic-attr pipeline breaks), the rendered checkbox count is the
    // canary — every other assertion depends on this baseline.
    const a = section(page, "a");
    await expect(a.locator('.as-consent-array-item input[type="checkbox"]')).toHaveCount(4);
  });

  // ── A2. Toggle commits a single id into the bound array ────────
  test("Section A — clicking a consent commits its id to the bound `consents` array", async ({
    page,
  }) => {
    // WHY: this component IS the editor for the field; if commits are
    // dropped, the user's acceptance silently vanishes on submit.
    const a = section(page, "a");
    await a.getByRole("checkbox", { name: "I accept the Terms of Service" }).check();
    const value = await readValue<{ consents: string[] }>(page, "a");
    expect(value.consents).toEqual(["tos"]);
  });

  // ── A3. Multi-toggle preserves user insertion order ─────────────
  test("Section A — multi-toggle preserves user insertion order (not pendingConsents order)", async ({
    page,
  }) => {
    // WHY: the component's contract is "bound array reflects user
    // actions"; re-sorting to match `pendingConsents` would surprise
    // consumers who key off insertion order downstream.
    const a = section(page, "a");
    await a.getByRole("checkbox", { name: "I accept the Privacy Policy" }).check();
    await a.getByRole("checkbox", { name: "I accept the Terms of Service" }).check();
    await a.getByRole("checkbox", { name: "Send me product updates and offers" }).check();
    const value = await readValue<{ consents: string[] }>(page, "a");
    expect(value.consents).toEqual(["privacy", "tos", "marketing"]);
  });

  // ── A4. Unchecking removes the id (symmetric removal) ───────────
  test("Section A — unchecking an item removes its id from the array", async ({ page }) => {
    // WHY: symmetric add/remove is the contract; a regression here
    // would silently strand stale ids in the bound array.
    const a = section(page, "a");
    const privacy = a.getByRole("checkbox", { name: "I accept the Privacy Policy" });
    await privacy.check();
    expect((await readValue<{ consents: string[] }>(page, "a")).consents).toEqual(["privacy"]);
    await privacy.uncheck();
    expect((await readValue<{ consents: string[] }>(page, "a")).consents).toEqual([]);
  });

  // ── A5. Submit with no consents → per-row required errors ───────
  test("Section A — submit with no consents renders per-row errors on required rows only", async ({
    page,
  }) => {
    // WHY: per-item error placement under the missing-required rows is
    // the headline UX the user shipped — a regression to a single
    // form-level error would lose that affordance entirely.
    const a = section(page, "a");
    await tap(a.getByRole("button", { name: "Accept & continue" }));

    // Both required rows surface their backend-supplied message.
    const tosErr = a.locator(".as-consent-array-item", {
      hasText: "I accept the Terms of Service",
    });
    const privacyErr = a.locator(".as-consent-array-item", {
      hasText: "I accept the Privacy Policy",
    });
    await expect(tosErr.locator(".as-error-slot")).toHaveText(
      "You must accept the Terms of Service to continue",
    );
    await expect(privacyErr.locator(".as-error-slot")).toHaveText(
      "Privacy Policy acceptance is mandatory",
    );

    // Optional rows never render an error slot.
    const marketingRow = a.locator(".as-consent-array-item", {
      hasText: "Send me product updates and offers",
    });
    const researchRow = a.locator(".as-consent-array-item", {
      hasText: "Allow my anonymised usage to improve the product",
    });
    await expect(marketingRow.locator(".as-error-slot")).toHaveCount(0);
    await expect(researchRow.locator(".as-error-slot")).toHaveCount(0);

    // No navigation (form submission must be blocked).
    expect(new URL(page.url()).pathname).toBe("/forms-demo/aooth-components");
  });

  // ── A6. Toggling on a missing required item clears its row error ─
  test("Section A — toggling on a missing required consent clears its row error, leaves others", async ({
    page,
  }) => {
    // WHY: live error clearing follows the form's on-change validation
    // gate; staleness would falsely tell the user they still owe a
    // consent they just gave.
    const a = section(page, "a");
    await tap(a.getByRole("button", { name: "Accept & continue" }));
    const tosRow = a.locator(".as-consent-array-item", {
      hasText: "I accept the Terms of Service",
    });
    const privacyRow = a.locator(".as-consent-array-item", {
      hasText: "I accept the Privacy Policy",
    });
    await expect(tosRow.locator(".as-error-slot")).toBeVisible();
    await expect(privacyRow.locator(".as-error-slot")).toBeVisible();

    await a.getByRole("checkbox", { name: "I accept the Terms of Service" }).check();
    await expect(tosRow.locator(".as-error-slot")).toHaveCount(0);
    await expect(privacyRow.locator(".as-error-slot")).toBeVisible();
  });

  // ── A7. Required rows render the framework asterisk marker ──────
  test("Section A — required consent rows show the asterisk marker via ::after", async ({
    page,
  }) => {
    // WHY: required consents must visually match the framework's
    // required-field marker (red bold `*`). The asterisk is a CSS
    // pseudo-element gated by an `.as-consent-array-text.required`
    // class, so we read `::after` via getComputedStyle rather than DOM
    // text — a regression to literal `*` in the DOM would slip a plain
    // textContent assertion.
    const a = section(page, "a");
    const requiredText = a
      .locator(".as-consent-array-item", {
        hasText: "I accept the Terms of Service",
      })
      .locator(".as-consent-array-text");
    const optionalText = a
      .locator(".as-consent-array-item", {
        hasText: "Send me product updates and offers",
      })
      .locator(".as-consent-array-text");

    // Required row carries the marker class and a non-empty ::after content.
    await expect(requiredText).toHaveClass(/\brequired\b/);
    const requiredAfter = await requiredText.evaluate(
      (el) => getComputedStyle(el, "::after").content,
    );
    // UnoCSS arbitrary content `content-["_*"]` resolves to `" *"` —
    // browsers serialize string content with surrounding quotes.
    expect(requiredAfter).toContain("*");
    expect(requiredAfter).not.toBe("none");
    expect(requiredAfter).not.toBe("normal");

    // Optional row has no `required` class and renders no ::after content.
    await expect(optionalText).not.toHaveClass(/\brequired\b/);
    const optionalAfter = await optionalText.evaluate(
      (el) => getComputedStyle(el, "::after").content,
    );
    // Either `none` (no pseudo declared) or an empty string — neither carries the `*`.
    expect(optionalAfter).not.toContain("*");
  });

  // ── A9. Backend error at `consents` path → per-item only, no shell footer ─
  test("Section A — backend error at the field path renders per-item only, no shell footer", async ({
    page,
  }) => {
    // WHY: `setErrors({consents: ...})` (form submit OR external `:errors`)
    // propagates the same string to EVERY `useAsField` registration at
    // the `consents` path — AsField's own (drives `props.error`) AND
    // AsConsentArray's own (drives `localError`). Before the fix, BOTH
    // surfaces rendered: the per-item rows AND the shell footer
    // duplicated the same backend string. Per-item rendering is the
    // canonical display (each missing required row gets its tailored
    // message); the shell footer must stay silent.
    await page.goto("/forms-demo/aooth-components?inject-consent-error=1");
    await page.waitForLoadState("networkidle");
    const a = section(page, "a");

    // Trigger the form's validation gate (submit), then assert the
    // error chrome surfaces ONLY in per-item rows.
    await tap(a.getByRole("button", { name: "Accept & continue" }));

    const consentArray = a.locator(".as-consent-array");
    // Sanity — the field root is present.
    await expect(consentArray).toHaveCount(1);

    // The shell footer row inside the AsConsentArray field root must
    // NOT exist. The shell renders `.as-field-footer-row` iff
    // `error || hint || formAction`; with `:error="undefined"` and no
    // hint/action, it stays unrendered.
    await expect(consentArray.locator(".as-field-footer-row")).toHaveCount(0);

    // Per-item rendering DOES fire on the two required rows with their
    // tailored backend-supplied messages.
    const tosRow = a.locator(".as-consent-array-item", {
      hasText: "I accept the Terms of Service",
    });
    const privacyRow = a.locator(".as-consent-array-item", {
      hasText: "I accept the Privacy Policy",
    });
    await expect(tosRow.locator(".as-error-slot")).toHaveText(
      "You must accept the Terms of Service to continue",
    );
    await expect(privacyRow.locator(".as-error-slot")).toHaveText(
      "Privacy Policy acceptance is mandatory",
    );

    // Push a different backend error via the e2e-only trigger; the
    // shell footer must STILL not render (no duplication after a
    // second backend push either).
    await page.getByTestId("aooth-section-a-push-alt-error").dispatchEvent("click");
    await expect(consentArray.locator(".as-field-footer-row")).toHaveCount(0);
    // Per-item rows still surface their tailored messages — the
    // backend string never replaces them.
    await expect(tosRow.locator(".as-error-slot")).toHaveText(
      "You must accept the Terms of Service to continue",
    );
  });

  // ── A8. Markdown links in consent text render as anchor tags ────
  test("Section A — markdown `[label](url)` renders as a real anchor with surrounding text", async ({
    page,
  }) => {
    // WHY: the consent text is authored as markdown so legal copy can
    // link to ToS/Privacy without HTML escaping. A regression that
    // renders the raw `[Terms of Service](https://...)` source — or
    // worse, uses v-html and opens an XSS hole — must be caught here.
    const a = section(page, "a");
    const tosRow = a.locator(".as-consent-array-item", {
      hasText: "I accept the Terms of Service",
    });

    const link = tosRow.locator('a[href="https://example.com/terms"]');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText("Terms of Service");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("rel", /noreferrer/);

    // Surrounding plain text is preserved — the row reads as a whole
    // sentence, not just the link label.
    const rowText = (await tosRow.locator(".as-consent-array-text").textContent()) ?? "";
    expect(rowText).toContain("I accept the");
    expect(rowText).toContain("Terms of Service");
    // The raw markdown source must NOT leak into the DOM.
    expect(rowText).not.toContain("[Terms of Service]");
    expect(rowText).not.toContain("(https://example.com/terms)");
  });

  // ── B1. Password inputs stay masked (type="password") ───────────
  test("Section B — both password fields render with type='password'", async ({ page }) => {
    // WHY: a regression to `type='text'` exposes credentials in the
    // DOM and on screen — security-relevant, not just cosmetic.
    const b = section(page, "b");
    const newPwd = b.getByLabel("New password");
    const confirmPwd = b.getByLabel("Confirm password");
    await expect(newPwd).toHaveAttribute("type", "password");
    await expect(confirmPwd).toHaveAttribute("type", "password");
  });

  // ── B2. Initial state — all 5 rules show data-passed='false' ─────
  test("Section B — all 5 policy rows render data-passed='false' with empty password", async ({
    page,
  }) => {
    // WHY: a stale `passed=true` carried over from a prior render
    // would mislead the user into thinking a weak / empty password
    // satisfies the policy.
    const b = section(page, "b");
    const rows = b.locator(".as-password-rules-row");
    await expect(rows).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(rows.nth(i)).toHaveAttribute("data-passed", "false");
    }
  });

  // ── B3. Strong password live-flips all 5 rules to true ──────────
  test("Section B — typing a strong password live-flips all 5 rules to data-passed='true'", async ({
    page,
  }) => {
    // WHY: the dynamic `@ui.form.fn.attr 'password'` reactivity IS
    // the point of this component; if it stops being live, the
    // fulfillment list becomes useless feedback.
    const b = section(page, "b");
    await b.getByLabel("New password").fill("Aa1!aaaa");
    const rows = b.locator(".as-password-rules-row");
    for (let i = 0; i < 5; i++) {
      await expect(rows.nth(i)).toHaveAttribute("data-passed", "true");
    }
  });

  // ── B4. Weak password keeps unmet rules at false (negative case) ─
  test("Section B — weak password keeps unmet rules at data-passed='false'", async ({ page }) => {
    // WHY: positive AND negative cases cover the deserialize-fn /
    // FNPool path symmetrically; a "rule always returns true" bug
    // would only surface here.
    const b = section(page, "b");
    await b.getByLabel("New password").fill("abc");
    const rows = b.locator(".as-password-rules-row");

    // Schema rule order: length>=8, [A-Z], [a-z], \d, [^A-Za-z0-9].
    await expect(rows.nth(0)).toHaveAttribute("data-passed", "false");
    await expect(rows.nth(1)).toHaveAttribute("data-passed", "false");
    await expect(rows.nth(2)).toHaveAttribute("data-passed", "true");
    await expect(rows.nth(3)).toHaveAttribute("data-passed", "false");
    await expect(rows.nth(4)).toHaveAttribute("data-passed", "false");
  });

  // ── B5. Changing the password re-evaluates rules live ───────────
  test("Section B — changing the password re-evaluates rules (no stale cache)", async ({
    page,
  }) => {
    // WHY: catches a regression where rules are evaluated once and
    // cached, leaving the fulfillment list frozen at the first input.
    const b = section(page, "b");
    const newPwd = b.getByLabel("New password");
    const rows = b.locator(".as-password-rules-row");

    await newPwd.fill("abc");
    await expect(rows.nth(0)).toHaveAttribute("data-passed", "false");
    await expect(rows.nth(2)).toHaveAttribute("data-passed", "true");

    await newPwd.fill("abcDEF12!");
    for (let i = 0; i < 5; i++) {
      await expect(rows.nth(i)).toHaveAttribute("data-passed", "true");
    }
  });

  // ── B6. Cross-field validator (`@ui.form.validate`) — matching ─
  test("Section B — matching passwords clear the cross-field validator after submit", async ({
    page,
  }) => {
    // WHY: the schema attaches
    //   `@ui.form.validate '(v, data) => v === data.newPassword || "Passwords must match"'`
    // to `confirmPassword`. The validator runs in TWO paths: live
    // (`AsField.formRule` → `formValidate` with `rootFormData()`) and
    // submit (`useAsForm.submitValidator` → `getFormValidator` with
    // `getDomainData()`). A regression where the live path passes the
    // wrapped form (`{value: ...}`) instead of the unwrapped domain
    // makes `data.newPassword` resolve to `undefined`, and the
    // matching-passwords case wrongly stays in error after submit.
    //
    // Use `pressSequentially` (real keystrokes) instead of `fill`: on
    // `<input type="password">`, `fill` short-circuits Vue's v-model
    // (no `input` event), so the model never commits and the test
    // would fail for the wrong reason.
    const b = section(page, "b");
    await b.getByLabel("New password").pressSequentially("Aa1!aaaa");
    await b.getByLabel("Confirm password").pressSequentially("Aa1!aaaa");
    await tap(b.getByRole("button", { name: "Save password" }));
    await expect(b.locator(".as-error-slot", { hasText: "Passwords must match" })).toHaveCount(0);
  });

  // ── B7. Cross-field validator — mismatch surfaces the error ────
  test("Section B — mismatched passwords surface 'Passwords must match' on submit", async ({
    page,
  }) => {
    // WHY: negative side of B6. Without this, B6 could pass for the
    // wrong reason (e.g. validator never runs at all).
    const b = section(page, "b");
    await b.getByLabel("New password").pressSequentially("Aa1!aaaa");
    await b.getByLabel("Confirm password").pressSequentially("DIFFERENT");
    await tap(b.getByRole("button", { name: "Save password" }));
    await expect(b.locator(".as-error-slot", { hasText: "Passwords must match" })).toHaveCount(1);
  });
});
