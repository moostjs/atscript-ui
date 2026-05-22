// Section 17 — Edit form OCC (batch I).
//
// SUT: `packages/vue-demo/src/client/components/EditByPath.vue` together with
// the `versionColumn` exposed in `/meta` and the 409 `version_mismatch`
// branch surfaced by `db-client`'s `ClientError`.
//
// Schema setup: `packages/vue-demo/src/server/schemas/products.as` declares
// `@db.column.version version: number.int` on `ProductsTable`. The SQL
// adapter (sqlite, 0.1.84+) auto-creates the column with `NOT NULL DEFAULT 0`
// on schema sync, so existing seeded rows acquire `version = 0` automatically
// — no manual migration / seed change required. `resetSeed()` brings the DB
// to a known state at the file level.
//
// Test 17.1 — Version field is auto-hidden in the edit form.
//   `/meta` returns `versionColumn: "version"`. `EditByPath.vue` passes that
//   to `createFormDef`, which strips the field from the rendered form. The
//   test loads `/products/SKU-00001/edit` and asserts NO labeled "Version"
//   input exists, while a non-version field ("Name") IS rendered. This
//   proves the `versionColumn` plumbing from server → meta → form-def →
//   renderer holds end-to-end.
//
// Test 17.2 — Stale write triggers 409 `version_mismatch` + friendly message.
//   Approach: simulate a concurrent edit by issuing a direct PATCH from the
//   test (bypassing the UI) to bump the row's version server-side AFTER the
//   form has already hydrated its in-memory copy. The form still holds the
//   old version; submitting carries the stale value, and the
//   `AsDbController` auto-lifts `version` into `$cas`, detects the mismatch,
//   and responds with 409 `{ kind: "version_mismatch", currentVersion: N }`.
//   `EditByPath.vue`'s catch branch surfaces this as
//   "Row changed since you opened the form (current version: N). …".
//
// Mutating spec → `mode: serial` + `resetSeed()` in `beforeAll` per the
// batch I conventions established by section-15.

import { expect, test } from "../fixtures";
import { gotoTable, resetSeed } from "../helpers";

test.describe.configure({ mode: "serial" });

test.describe("Section 17 — Edit form OCC (version hidden + 409 version_mismatch)", () => {
  test.beforeAll(async () => {
    await resetSeed();
  });

  test("17.1 — version field is auto-hidden via /meta versionColumn", async ({ page, baseURL }) => {
    // Land on the table first so the SPA shell is warm and the meta cache
    // is already populated for the products route.
    await gotoTable(page, "products");

    // Edit by preferredId (SKU). The first seeded product is `SKU-00001`
    // (see `seedProducts` in `server/seed.ts`).
    await page.goto(`${baseURL}/products/SKU-00001/edit`);
    await page.waitForURL(/\/products\/SKU-00001\/edit$/u, { timeout: 10_000 });

    // Wait for the form to hydrate — `Loading…` clears once `record` is set.
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0, {
      timeout: 10_000,
    });

    // The edit heading is the canonical "form rendered" signal.
    await expect(page.getByRole("heading", { name: /Edit products #SKU-00001/u })).toBeVisible();

    // Non-version field IS rendered — confirms the form populated normally.
    const nameInput = page.getByLabel("Name", { exact: true });
    await expect(nameInput).toBeVisible();

    // Core assertion: no input/select for `version`. We check via the
    // `getByLabel("Version")` selector (which would match the
    // `<AsFieldShell>`-emitted `<label>` if the field rendered) AND via
    // the defensive `input[name="version"]` backup selector.
    await expect(page.getByLabel("Version", { exact: true })).toHaveCount(0);
    await expect(page.locator('input[name="version"]')).toHaveCount(0);
  });

  test("17.2 — stale submit triggers 409 version_mismatch with friendly message", async ({
    page,
    baseURL,
  }) => {
    await gotoTable(page, "products");

    // Fetch the current row directly to learn its `id` + `version`. We
    // intentionally skip the UI for this read — the form will fetch its
    // own copy on navigation.
    const oneUrl = `${baseURL}/api/db/tables/products/one?sku=SKU-00002`;
    const oneRes = await page.request.get(oneUrl);
    expect(oneRes.ok()).toBe(true);
    const initialRow = (await oneRes.json()) as {
      id: number;
      sku: string;
      name: string;
      version: number;
    };
    expect(initialRow.sku).toBe("SKU-00002");
    expect(typeof initialRow.version).toBe("number");

    // Navigate the form. After hydration the form holds `initialRow.version`
    // in its in-memory `record.value`.
    await page.goto(`${baseURL}/products/SKU-00002/edit`);
    await page.waitForURL(/\/products\/SKU-00002\/edit$/u, { timeout: 10_000 });
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0, {
      timeout: 10_000,
    });

    const nameInput = page.getByLabel("Name", { exact: true });
    await expect(nameInput).toBeVisible();

    // Simulate a concurrent writer: PATCH the row out-of-band with the
    // CURRENT version. Server auto-lifts `version` to `$cas`, the write
    // succeeds, and the row's `version` is bumped to `initialRow.version + 1`.
    // The browser form is now holding a stale copy.
    const concurrentPatch = await page.request.fetch(`${baseURL}/api/db/tables/products`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      data: { ...initialRow, name: `${initialRow.name} (concurrent)` },
    });
    expect(concurrentPatch.ok()).toBe(true);

    // Confirm the version actually bumped server-side — guards against the
    // controller silently dropping the OCC contract.
    const reread = await page.request.get(oneUrl);
    const bumped = (await reread.json()) as { version: number };
    expect(bumped.version).toBe(initialRow.version + 1);

    // Now drive the UI: edit `Name` and submit. The PATCH carries the OLD
    // `version` (from the hydrated copy), so the server must respond 409
    // `version_mismatch`.
    await nameInput.fill(`${initialRow.name} (ui)`);

    // Capture the PATCH response so we can assert the wire status. We pick
    // up the response (not the request) because the body shape is what
    // EditByPath's catch branch inspects.
    const patchResponsePromise = page.waitForResponse(
      (r) =>
        r.request().method() === "PATCH" &&
        /\/api\/db\/tables\/products\/?$/u.test(r.url().split("?")[0]),
      { timeout: 10_000 },
    );

    await page.locator(".as-submit-btn").click();
    const patchResp = await patchResponsePromise;
    expect(patchResp.status()).toBe(409);
    const body = (await patchResp.json()) as { kind?: string; currentVersion?: number };
    expect(body.kind).toBe("version_mismatch");
    expect(body.currentVersion).toBe(initialRow.version + 1);

    // EditByPath surfaces the 409 as a friendly inline error. The exact
    // suffix `(current version: N)` depends on the server payload but the
    // prefix is stable.
    const errorPara = page.locator("p.scope-error");
    await expect(errorPara).toContainText(/Row changed since you opened the form/iu, {
      timeout: 5_000,
    });
    await expect(errorPara).toContainText(`current version: ${initialRow.version + 1}`);
  });
});
