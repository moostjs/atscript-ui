// Section 18 — Form change tracking · live patch (batch I, forms family).
//
// Exercises `<AsForm track-changes>` against the pre-loaded `ChangeTrackingOrder`
// schema rendered by
// `packages/vue-demo/src/client/pages/forms-demo/change-tracking.vue`.
//
// The page seeds a baseline order BEFORE <AsForm> mounts, so track-changes
// captures it as the diff baseline and every edit produces a real
// `@atscript/db` patch. The right-hand diagnostics rail is driven off the
// AsForm `defineExpose` surface (isDirty / changes / getPatch / rebase):
//   - `data-testid=live-patch`  → live `JSON.stringify(getPatch())`
//   - `data-testid=change-row`  → one row per `FormFieldChange`
//   - `data-testid=last-saved`  → echo of the patch captured on Save
//   - `data-testid=save-btn`    → isDirty-gated Save button
//   - `data-testid=dirty-state` → "N unsaved change(s)" / "No unsaved changes"
//
// Schema facts the assertions lean on (see schemas/change-tracking.as) — these
// constants are the SOURCE OF TRUTH for the demo's inline `formData` seed
// (change-tracking.vue lines 14-31). Keep them in sync: if the seed bumps the
// version, reorders items, or changes a baseline value, update the constants
// below to match (the spec reads them, not the page).
//   - baseline `reference` = "ORD-2026-0042"
//   - baseline `address`   = { street, city: "San Francisco", postcode }
//   - baseline `items`     = [ {sku:"SKU-001", qty:3}, {sku:"SKU-002", qty:1} ]
//   - `version` is `@db.column.version` (= 7) → getPatch() lifts it into a
//     top-level `$cas: { version: 7 }` sibling, never a normal SET.
//   - `address` carries `@db.patch.strategy 'merge'` → a single-leaf edit emits
//     ONLY the changed leaf (`address: { city }`), not the whole sub-object.
//   - `items` is keyed by `sku` (@expect.array.key) → a qty edit emits a keyed
//     `$update`, a new row emits `$insert`, a removed row emits `$remove` (key
//     only), NEVER a wholesale `$replace`.
//
// Label locators anchor on the BASE label with a regex (`labelRegex`) rather
// than `{ exact: true }`: the required-marker `*` is painted via CSS `::after`
// on `.as-field-label` (ui-styles as-field.ts) but Playwright's accessible-name
// computation INCLUDES it, so an exact match would silently miss any field that
// gains `@meta.required` (e.g. the line-item `sku`). The regex survives the
// asterisk and any future label suffix. Matches the convention sibling
// forms-demo specs use (r-arrays/section-26-array-showcase.spec.ts).
//
// No arbitrary sleeps / fixed timeouts — every assertion is a web-first
// auto-waiting matcher, and patch JSON is parsed + structurally asserted.

import { expect, test, type Locator, type Page } from "../fixtures";

const BASELINE_REFERENCE = "ORD-2026-0042";
const BASELINE_VERSION = 7;
const CAS = { version: BASELINE_VERSION };

// Anchor on the base label, tolerating the required-marker `*` rendered via
// CSS `::after` (which the accessible name still includes).
function labelRegex(text: string): RegExp {
  return new RegExp(`^${text}(\\s*\\*)?$`);
}

async function gotoDemo(page: Page): Promise<void> {
  await page.goto("/forms-demo/change-tracking");
  await page.waitForLoadState("networkidle");
  // Hydration gate: the Reference input only exists once <AsForm> has mounted
  // and bound the seeded baseline.
  await expect(page.getByLabel(labelRegex("Reference"))).toBeVisible();
}

const form = (page: Page): Locator => page.getByTestId("change-tracking-form");
const saveBtn = (page: Page): Locator => page.getByTestId("save-btn");
const dirtyState = (page: Page): Locator => page.getByTestId("dirty-state");
const changeRows = (page: Page): Locator => page.getByTestId("change-row");

const reference = (page: Page): Locator => page.getByLabel(labelRegex("Reference"));

// Parse the live `getPatch()` JSON panel. The panel always holds valid JSON
// (`JSON.stringify(livePatch, null, 2)`), so we parse + assert structure
// rather than substring-match. `expect.poll` re-reads until the parsed shape
// satisfies the caller — web-first, no fixed sleeps.
async function readLivePatch(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("live-patch").textContent()) ?? "{}";
  return JSON.parse(raw) as Record<string, unknown>;
}

async function readLastSaved(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("last-saved").textContent()) ?? "{}";
  return JSON.parse(raw) as Record<string, unknown>;
}

// First line-item's Qty input. The keyed `items` array renders one nested
// section per row in declaration order, so `.first()` is items[0] (SKU-001,
// baseline qty 3).
function firstQtyInput(page: Page): Locator {
  return form(page).getByLabel(labelRegex("Qty")).first();
}

test.describe("Section 18 — form change tracking · live patch", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  test("initial load: Save disabled, patch is empty/clean, no changes", async ({ page }) => {
    // Save gated by isDirty → disabled at the clean baseline.
    await expect(saveBtn(page)).toBeDisabled();
    await expect(dirtyState(page)).toHaveText("No unsaved changes");

    // Live patch is an empty object — nothing diverges from baseline yet.
    await expect(page.getByTestId("live-patch")).toHaveText("{}");
    expect(await readLivePatch(page)).toEqual({});

    // Changes list is empty.
    await expect(changeRows(page)).toHaveCount(0);

    // No "Last saved patch" echo panel until the first Save.
    await expect(page.getByTestId("last-saved")).toHaveCount(0);
  });

  test("edit Reference (scalar): Save enables, patch is exactly {reference, $cas}, one change row", async ({
    page,
  }) => {
    await expect(reference(page)).toHaveValue(BASELINE_REFERENCE);

    await reference(page).fill("ORD-2026-9999");
    await reference(page).blur();

    // isDirty flips → Save enabled + the indicator counts exactly one change.
    await expect(saveBtn(page)).toBeEnabled();
    await expect(dirtyState(page)).toHaveText("1 unsaved change(s)");

    // Patch settles to EXACTLY the new reference value + the CAS guard lifted
    // from the version column — nothing else. Poll the parsed shape (auto-
    // retries while the computed panel catches up), then assert exact equality
    // so a stray extra key (an unedited field accidentally diffed, version
    // leaking as a SET, …) fails the test.
    await expect
      .poll(async () => await readLivePatch(page))
      .toEqual({ reference: "ORD-2026-9999", $cas: CAS });

    // Exactly one change row, naming the kind+path AND the before→after values
    // (the panel renders `set · reference` then `"before" → "after"`).
    await expect(changeRows(page)).toHaveCount(1);
    await expect(changeRows(page).first()).toContainText("set · reference");
    await expect(changeRows(page).first()).toContainText(
      `"${BASELINE_REFERENCE}" → "ORD-2026-9999"`,
    );
  });

  test("toggle Priority (boolean) + change Status (select): each emits a single scalar SET with $cas", async ({
    page,
  }) => {
    // Boolean SET: baseline priority=false → check it → patch.priority === true.
    const priority = form(page).getByRole("checkbox", { name: labelRegex("Priority order") });
    await priority.check();
    await expect.poll(async () => await readLivePatch(page)).toEqual({ priority: true, $cas: CAS });

    // Revert so the next assertion starts from a clean priority leaf.
    await priority.uncheck();
    await expect.poll(async () => await readLivePatch(page)).toEqual({});

    // Union/select SET: baseline status="confirmed" → pick "shipped".
    const status = form(page).getByRole("combobox", { name: labelRegex("Status") });
    await status.selectOption("shipped");
    await expect
      .poll(async () => await readLivePatch(page))
      .toEqual({ status: "shipped", $cas: CAS });
    await expect(changeRows(page).filter({ hasText: "set · status" })).toHaveCount(1);
  });

  test("edit a merge-strategy address leaf (City): patch emits ONLY the changed leaf, not the whole address", async ({
    page,
  }) => {
    // The structured "Shipping address" object renders as a collapsed
    // `<details>` by default — click its summary to expand so the leaf inputs
    // become interactable. (`<summary>` has no button role, so scope by the
    // collapsible-summary class + its title text.)
    await form(page).locator(".as-collapsible-summary", { hasText: "Shipping address" }).click();

    const city = form(page).getByLabel(labelRegex("City"));
    await expect(city).toBeVisible();
    await expect(city).toHaveValue("San Francisco");

    await city.fill("Oakland");
    await city.blur();

    await expect(saveBtn(page)).toBeEnabled();

    // `@db.patch.strategy 'merge'` → the patch carries address as a partial of
    // the CHANGED leaf only. Assert exact equality (toEqual, not toMatchObject)
    // so a regression to the default replace strategy — which would emit the
    // whole `{ street, city, postcode }` — fails here.
    await expect
      .poll(async () => await readLivePatch(page))
      .toEqual({ address: { city: "Oakland" }, $cas: CAS });

    // The change row names the dotted leaf path.
    await expect(changeRows(page)).toHaveCount(1);
    await expect(changeRows(page).first()).toContainText("address.city");
  });

  test("revert the Reference edit back to baseline: Save disabled again, patch returns to {}", async ({
    page,
  }) => {
    // Dirty it first.
    await reference(page).fill("ORD-2026-9999");
    await reference(page).blur();
    await expect(saveBtn(page)).toBeEnabled();

    // Revert to the exact original value — track-changes is revert-aware, so
    // the diff should collapse back to clean.
    await reference(page).fill(BASELINE_REFERENCE);
    await reference(page).blur();

    await expect(saveBtn(page)).toBeDisabled();
    await expect(dirtyState(page)).toHaveText("No unsaved changes");
    await expect(page.getByTestId("live-patch")).toHaveText("{}");
    expect(await readLivePatch(page)).toEqual({});
    await expect(changeRows(page)).toHaveCount(0);
  });

  test("edit a keyed line-item Qty: patch emits an items $update carrying the sku key (not $replace)", async ({
    page,
  }) => {
    const qty = firstQtyInput(page);
    await expect(qty).toHaveValue("3");

    await qty.fill("12");
    await qty.blur();

    await expect(saveBtn(page)).toBeEnabled();

    // The keyed array must diff to a per-item op, never replace the whole list.
    // Gate the poll on the FULL settled target shape so the non-retrying reads
    // below can never observe an intermediate op state.
    await expect
      .poll(async () => await readLivePatch(page))
      .toMatchObject({
        items: {
          $update: expect.arrayContaining([expect.objectContaining({ sku: "SKU-001", qty: 12 })]),
        },
        $cas: CAS,
      });

    // Read the now-settled patch once and assert the negative invariants on it:
    // keyed diff → `$update`, and NEVER a wholesale `$replace`.
    const patch = await readLivePatch(page);
    const itemsOp = patch.items as Record<string, unknown>;
    expect(itemsOp).toHaveProperty("$update");
    expect(itemsOp).not.toHaveProperty("$replace");
    expect(itemsOp).not.toHaveProperty("$insert");
    expect(itemsOp).not.toHaveProperty("$remove");

    // The change row reports the array kind on the items path.
    await expect(changeRows(page).filter({ hasText: "array · items" })).toHaveCount(1);
  });

  test("add a keyed line-item: patch emits an items $insert with the whole new row (not $replace)", async ({
    page,
  }) => {
    // The required `items` array renders open with both baseline rows. Add a
    // third row, then fill its sku + qty (an empty sku is "keyless" → the diff
    // would fall back to $replace, so a COMPLETE new row is required to observe
    // the $insert path). Each leaf commits on blur.
    const skus = form(page).getByLabel(labelRegex("SKU"));
    const qtys = form(page).getByLabel(labelRegex("Qty"));
    await expect(skus).toHaveCount(2);

    await form(page).getByRole("button", { name: "Add line item" }).click();

    // Newly-added row is appended last → it's index 2 once the array re-renders.
    await expect(skus).toHaveCount(3);
    await skus.nth(2).fill("SKU-003");
    await skus.nth(2).blur();
    await qtys.nth(2).fill("5");
    await qtys.nth(2).blur();

    await expect(saveBtn(page)).toBeEnabled();

    // Assert directly against the LIVE patch panel — NOT the imperative Save
    // echo. The panel's `livePatch` depends on the reactive `changes` computed,
    // which now invalidates when an inserted (not-yet-saved) row's non-key
    // leaves change. Before the dependency-tracking fix, `buildFormDiff`'s
    // `$insert` branch pushed the new row by reference without reading its
    // leaves, so editing qty/description left the reactive surface stale and
    // this assertion only passed via a Save round-trip. Now the live preview
    // reflects the just-filled row as the user types — no Save required.
    await expect
      .poll(async () => await readLivePatch(page))
      .toMatchObject({
        items: {
          $insert: expect.arrayContaining([
            expect.objectContaining({ sku: "SKU-003", description: "", qty: 5 }),
          ]),
        },
        $cas: CAS,
      });

    // Read the settled live patch and assert the negative invariants on it:
    // whole new item lands in $insert; existing rows are untouched, so no
    // $update and crucially no $replace of the entire list.
    const live = await readLivePatch(page);
    const itemsOp = live.items as Record<string, unknown>;
    expect(itemsOp.$insert).toEqual([{ sku: "SKU-003", description: "", qty: 5 }]);
    expect(itemsOp).not.toHaveProperty("$replace");
    expect(itemsOp).not.toHaveProperty("$update");
    expect(itemsOp).not.toHaveProperty("$remove");

    // The change row reports the array kind on the items path (driven off the
    // same reactive `changes` list the live patch reads).
    await expect(changeRows(page).filter({ hasText: "array · items" })).toHaveCount(1);
  });

  test("remove a keyed line-item: patch emits an items $remove carrying only the sku key (not $replace)", async ({
    page,
  }) => {
    // Remove items[1] (SKU-002). Each line-item object section renders its own
    // per-item Remove button (aria-label="Remove"); `.nth(1)` targets the
    // second row. minLength 1 keeps Remove enabled while 2 rows are present.
    const removeButtons = form(page).getByRole("button", { name: "Remove", exact: true });
    await expect(removeButtons).toHaveCount(2);
    await removeButtons.nth(1).click();

    await expect(saveBtn(page)).toBeEnabled();

    // Keyed remove → `$remove` carries the KEY ONLY ({sku}), never the whole
    // item and never a wholesale $replace.
    await expect
      .poll(async () => await readLivePatch(page))
      .toMatchObject({
        items: { $remove: [{ sku: "SKU-002" }] },
        $cas: CAS,
      });

    const itemsOp = (await readLivePatch(page)).items as Record<string, unknown>;
    // $remove element is EXACTLY the key — no description/qty leaked through.
    expect(itemsOp.$remove).toEqual([{ sku: "SKU-002" }]);
    expect(itemsOp).not.toHaveProperty("$replace");
    expect(itemsOp).not.toHaveProperty("$update");
  });

  test("Save: Last-saved panel echoes the patch and Save disables again (rebase cleared dirty)", async ({
    page,
  }) => {
    await reference(page).fill("ORD-2026-7777");
    await reference(page).blur();

    // Gate the snapshot on the live-patch PANEL itself (the element we parse),
    // not on a sibling control's state. Capture the settled patch to compare
    // against the Save echo.
    await expect
      .poll(async () => await readLivePatch(page))
      .toEqual({ reference: "ORD-2026-7777", $cas: CAS });
    const beforeSave = await readLivePatch(page);
    await expect(saveBtn(page)).toBeEnabled();

    await saveBtn(page).click();

    // The "Last saved patch" panel appears (it's v-if on lastSaved) and echoes
    // the captured patch verbatim.
    await expect(page.getByTestId("last-saved")).toBeVisible();
    expect(await readLastSaved(page)).toEqual(beforeSave);

    // rebase() re-baselined the form → clean again, Save disabled, live patch
    // back to {}.
    await expect(saveBtn(page)).toBeDisabled();
    await expect(dirtyState(page)).toHaveText("No unsaved changes");
    await expect(page.getByTestId("live-patch")).toHaveText("{}");
    expect(await readLivePatch(page)).toEqual({});
    await expect(changeRows(page)).toHaveCount(0);
  });
});
