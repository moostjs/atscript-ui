// Section 21 — Union variant round-trip in edit form (Phase C).
//
// Verifies the AsForm union-variant picker correctly identifies the variant
// from a prefilled value and that switching variants round-trips through the
// PATCH wire. Phase A added the optional union fields to three demo schemas
// (customers.primaryContact, orders.paymentMethod, audit_log.payload);
// Phase B seeded variants deterministically across the rows.
//
// Variant detection paths exercised:
//   - customers: fingerprint union (no discriminator key) — variant detected
//     by required-prop set on the prefilled value.
//   - orders: kind-discriminated union (`kind: 'card' | 'bank' | 'invoice'`).
//   - audit_log: type-discriminated union (`type: 'login' | 'logout' | 'note'`).
//
// audit_log is read-only by ARBAC policy (see
// `packages/vue-demo/src/server/auth/arbac-policy.ts:99`), so the save
// round-trip is only exercised on customers + orders. The read-side
// detection tests on audit_log still load the edit page to confirm
// prefilled-value → trigger-label resolution.
//
// Stable selectors (set up earlier in the project, see vue-form unit tests
// at `packages/vue-form/src/__tests__/as-union.spec.ts` for usage examples):
//   - `.as-variant-trigger`        — picker button with current variant label
//   - `.as-dropdown-item`          — items in the picker dropdown
//   - `.as-object-empty-add`       — empty-state "Add <Field Label>" button
//   - `button.as-field-remove-btn` — clears an optional field
//   - `.as-collapsible-title`      — title chip on a collapsible (field label)
//   - `.as-submit-btn`             — form submit
//
// Each test scopes the variant trigger to its labeled collapsible
// (`:has(.as-collapsible-title:text('<Field Label>'))`) so it can never
// hit a stray picker rendered elsewhere on the page.

import { expect, test, type Page } from "../fixtures";

import { resetSeed } from "../helpers";

// Tests within a describe block are independent — different row PKs, no
// shared mutation between them. The mutating round-trip uses row 5 while
// the read-side tests use rows 1-4, so a single failure does not cascade.
// Default `mode: 'parallel'` is fine; the worker still runs them serially
// inside a single Playwright worker process.

// Resolve a variant trigger inside the labeled collapsible. Field labels
// are stable per Phase A schema (`@meta.label`). The collapsible's
// container class is either `as-collapsible-section` (level 1) or
// `as-collapsible-island` (level 2+); `[class*="as-collapsible-"]` matches
// either branch.
function variantTrigger(page: Page, fieldLabel: string) {
  return page.locator(
    `[class*="as-collapsible-"]:has(.as-collapsible-title:text-is("${fieldLabel}")) .as-variant-trigger`,
  );
}

function variantSection(page: Page, fieldLabel: string) {
  return page.locator(
    `[class*="as-collapsible-"]:has(.as-collapsible-title:text-is("${fieldLabel}"))`,
  );
}

// Wait for the form's first leaf input to render. Form load is gated by an
// async `client.meta() + client.one()` round-trip; until both resolve the
// page shows `Loading…`. Both customers and orders expose a `Name` /
// `Customer` field as the first input, but a more reliable check is that
// the explicit `Loading…` placeholder is gone.
async function waitForFormReady(page: Page) {
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
  await expect(page.locator(".as-submit-btn")).toBeVisible();
}

// Navigate to a table's edit form for the given row id and wait until the
// async meta+one round-trip has resolved.
async function gotoEdit(page: Page, table: string, id: number) {
  await page.goto(`/${table}/${id}/edit`);
  await waitForFormReady(page);
}

// Open the labeled collapsible so its leaf inputs become interactable.
// Top-level sections render as `<details>` and start collapsed by default.
async function expandSection(page: Page, fieldLabel: string) {
  await variantSection(page, fieldLabel).locator(".as-collapsible-summary").first().click();
}

// Assert the row is in the "no value yet" state for the given union field:
// the `Add <Label>` empty-state button is visible, and there is no variant
// trigger anywhere on the page (each spec page only renders one union
// field, so the global `.as-variant-trigger` count check is safe).
async function expectEmptyUnion(page: Page, fieldLabel: string) {
  await expect(
    page.locator(".as-object-empty-add", { hasText: `Add ${fieldLabel}` }),
  ).toBeVisible();
  await expect(page.locator(".as-variant-trigger")).toHaveCount(0);
}

test.describe("Section 21 — union variant round-trip in edit form", () => {
  test.beforeAll(async () => {
    await resetSeed();
  });

  // ── customers (fingerprint union, no discriminator) ────────────────────
  test.describe("Section 21.1 — customers (fingerprint union)", () => {
    test("row 1 prefilled email contact → trigger shows 'Email contact'", async ({ page }) => {
      await gotoEdit(page, "customers", 1);
      await expect(variantTrigger(page, "Primary contact")).toHaveText("Email contact");
    });

    test("row 2 prefilled phone contact → trigger shows 'Phone contact'", async ({ page }) => {
      await gotoEdit(page, "customers", 2);
      await expect(variantTrigger(page, "Primary contact")).toHaveText("Phone contact");
    });

    test("row 3 prefilled postal contact → trigger shows 'Postal contact'", async ({ page }) => {
      await gotoEdit(page, "customers", 3);
      await expect(variantTrigger(page, "Primary contact")).toHaveText("Postal contact");
    });

    test("row 4 with null primaryContact → 'Add Primary contact' empty-state, no trigger", async ({
      page,
    }) => {
      await gotoEdit(page, "customers", 4);
      await expectEmptyUnion(page, "Primary contact");
    });

    test("switch row 5 from Email to Phone, save, reload → trigger shows 'Phone contact'", async ({
      page,
    }) => {
      // Use row 5 (Email) so row 1 stays untouched for the read-side check
      // when this file re-runs against the same seed (resetSeed() is once
      // per file).
      await gotoEdit(page, "customers", 5);
      const trigger = variantTrigger(page, "Primary contact");
      await expect(trigger).toHaveText("Email contact");

      await expandSection(page, "Primary contact");

      // Open the variant picker and switch to Phone.
      await trigger.click();
      await page.locator(".as-dropdown-item", { hasText: "Phone contact" }).click();
      await expect(trigger).toHaveText("Phone contact");

      // Fill the now-required `Phone` leaf — required by the variant's
      // `@meta.required 'Phone is required'` constraint.
      await variantSection(page, "Primary contact")
        .getByLabel("Phone", { exact: true })
        .fill("+1-555-9999");

      // Capture the PATCH wire body for shape assertion (path-only — db client
      // PATCHes the table root with the full row).
      const patchPromise = page.waitForRequest(
        (req) =>
          req.method() === "PATCH" &&
          /\/api\/db\/tables\/customers\/?$/u.test(req.url().split("?")[0]),
        { timeout: 10_000 },
      );
      await page.locator(".as-submit-btn").click();
      const patchReq = await patchPromise;
      const body = patchReq.postDataJSON() as {
        id: number;
        primaryContact: Record<string, unknown>;
      };
      expect(body.id).toBe(5);
      // Fingerprint union: `phone` key present, `email` key absent.
      expect(body.primaryContact).toMatchObject({ phone: "+1-555-9999" });
      expect("email" in body.primaryContact).toBe(false);

      // Reload + re-assert the trigger label resolves to the persisted variant.
      await gotoEdit(page, "customers", 5);
      await expect(variantTrigger(page, "Primary contact")).toHaveText("Phone contact");

      // Expand the section to verify the rendered leaf inputs match the
      // persisted variant. The customers row also has a top-level `email`
      // (the customer's email address) outside the union, so we scope the
      // assertion to the Primary contact collapsible.
      await expandSection(page, "Primary contact");
      const primaryContactSection = variantSection(page, "Primary contact");
      await expect(primaryContactSection.getByLabel("Phone", { exact: true })).toBeVisible();
      // `Email`-only leaf is not rendered for the Phone variant.
      await expect(primaryContactSection.getByLabel("Email", { exact: true })).toHaveCount(0);
    });
  });

  // ── orders (kind-discriminated union) ──────────────────────────────────
  test.describe("Section 21.2 — orders (kind-discriminated union)", () => {
    test("row 1 prefilled credit card → trigger shows 'Credit card'", async ({ page }) => {
      await gotoEdit(page, "orders", 1);
      await expect(variantTrigger(page, "Payment method")).toHaveText("Credit card");
    });

    test("row 2 prefilled bank transfer → trigger shows 'Bank transfer'", async ({ page }) => {
      await gotoEdit(page, "orders", 2);
      await expect(variantTrigger(page, "Payment method")).toHaveText("Bank transfer");
    });

    test("row 3 prefilled invoice → trigger shows 'Invoice'", async ({ page }) => {
      await gotoEdit(page, "orders", 3);
      await expect(variantTrigger(page, "Payment method")).toHaveText("Invoice");
    });

    test("row 4 with null paymentMethod → 'Add Payment method' empty-state, no trigger", async ({
      page,
    }) => {
      await gotoEdit(page, "orders", 4);
      await expectEmptyUnion(page, "Payment method");
    });

    test("switch row 5 from Card to Invoice, save, reload → trigger shows 'Invoice'", async ({
      page,
    }) => {
      await gotoEdit(page, "orders", 5);
      const trigger = variantTrigger(page, "Payment method");
      await expect(trigger).toHaveText("Credit card");

      await expandSection(page, "Payment method");

      await trigger.click();
      await page.locator(".as-dropdown-item", { hasText: "Invoice" }).click();
      await expect(trigger).toHaveText("Invoice");

      // Fill the new variant's required leaf — `Invoice #`.
      await variantSection(page, "Payment method")
        .getByLabel("Invoice #", { exact: true })
        .fill("INV-9999");

      const patchPromise = page.waitForRequest(
        (req) =>
          req.method() === "PATCH" &&
          /\/api\/db\/tables\/orders\/?$/u.test(req.url().split("?")[0]),
        { timeout: 10_000 },
      );
      await page.locator(".as-submit-btn").click();
      const patchReq = await patchPromise;
      const body = patchReq.postDataJSON() as {
        id: number;
        paymentMethod: { kind: string; invoiceNumber?: string; last4?: string };
      };
      expect(body.id).toBe(5);
      expect(body.paymentMethod.kind).toBe("invoice");
      expect(body.paymentMethod.invoiceNumber).toBe("INV-9999");
      expect("last4" in body.paymentMethod).toBe(false);

      await gotoEdit(page, "orders", 5);
      await expect(variantTrigger(page, "Payment method")).toHaveText("Invoice");
      // Expand to verify rendered leaves. The Card-only `Last 4` leaf is no
      // longer in the section after the variant switch.
      await expandSection(page, "Payment method");
      const section = variantSection(page, "Payment method");
      await expect(section.getByLabel("Last 4", { exact: true })).toHaveCount(0);
      await expect(section.getByLabel("Invoice #", { exact: true })).toBeVisible();
    });
  });

  // ── audit_log (type-discriminated, read-only) ──────────────────────────
  test.describe("Section 21.3 — audit_log (type-discriminated, read-only)", () => {
    test("row 1 prefilled login payload → trigger shows 'Login payload'", async ({ page }) => {
      await gotoEdit(page, "audit_log", 1);
      await expect(variantTrigger(page, "Payload")).toHaveText("Login payload");
    });

    test("row 2 prefilled logout payload → trigger shows 'Logout payload'", async ({ page }) => {
      await gotoEdit(page, "audit_log", 2);
      await expect(variantTrigger(page, "Payload")).toHaveText("Logout payload");
    });

    test("row 3 prefilled note payload → trigger shows 'Note payload'", async ({ page }) => {
      await gotoEdit(page, "audit_log", 3);
      await expect(variantTrigger(page, "Payload")).toHaveText("Note payload");
    });

    test("row 4 with null payload → 'Add Payload' empty-state", async ({ page }) => {
      await gotoEdit(page, "audit_log", 4);
      await expectEmptyUnion(page, "Payload");
    });
    // No save round-trip: audit_log has no write rule in
    // `arbac-policy.ts:99-100` (read-only by policy).
  });
});
