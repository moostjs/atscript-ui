// Section 35 — Multiselect dispatch on array-showcase.
//
// Verifies the built-in `multiselect` form-field type. Eligibility rules
// (see `packages/ui/src/form/create-form-def.ts`):
//   1. Literal-union array (e.g. `('react' | 'vue')[]`) → multiselect.
//   2. Array of primitives carrying `@ui.form.options` → multiselect.
//   3. Explicit `@ui.form.type multiselect` opt-in (not covered here; the
//      first two rules already pick up every demo field).
//
// Demo target: `/forms-demo/array-showcase` — same page as section 26. The
// four multiselect fields appended at the bottom of the schema are:
//   - `frameworksUsed: ('react'|'vue'|'svelte'|'angular')[]`  required, literal-union
//   - `roles: string[]` + `@ui.form.options Admin/Editor/Viewer`     required
//   - `frameworks?: ('react'|'vue')[]`                       optional, literal-union
//   - `topics: string[]` + options + minLength 1 / maxLength 3       bounded
//
// Selector contract surfaced by `as-multi-select.vue` (reka-ui Combobox):
//   - `.as-multi-select-field`  — outer field container (shell)
//   - `.as-multi-select-root`   — `ComboboxRoot` host
//   - `.as-multi-select-anchor` — clickable trigger holding chips + input
//   - `.as-multi-select-chip`   — one per selected option, with a
//     `.as-multi-select-chip-remove` button
//   - `.as-multi-select-input`  — the `ComboboxInput` (role=combobox)
//
// The popup portals to `document.body`; items render as `role=option`
// inside a `[role=listbox]` container styled as `.as-multi-select-content`.

import { expect, type Locator, type Page, test } from "../fixtures";

async function gotoDemo(page: Page) {
  await page.goto("/forms-demo/array-showcase");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("array-showcase-form").locator(".as-submit-btn")).toBeVisible();
}

const section = (page: Page): Locator => page.getByTestId("array-showcase-form");

async function readPreview(page: Page): Promise<Record<string, unknown>> {
  const raw = (await page.getByTestId("array-showcase-preview").textContent()) ?? "{}";
  const parsed = JSON.parse(raw) as { value?: Record<string, unknown> };
  return parsed.value ?? {};
}

// Resolve the multiselect field container by its visible label.
function multiselect(page: Page, label: string): Locator {
  return section(page)
    .locator(".as-multi-select-field", {
      has: page.locator(".as-field-label", { hasText: new RegExp(`^${label}(\\s*\\*)?$`) }),
    })
    .first();
}

// Chip locator for a selected option, identified by its visible label text.
function chip(field: Locator, label: string): Locator {
  return field.locator(".as-multi-select-chip", { hasText: label });
}

// Open the popup for a multiselect field by clicking its anchor, then return
// the listbox locator (portalled to body — scope by visible content).
async function openPopup(page: Page, field: Locator): Promise<Locator> {
  await field.locator(".as-multi-select-anchor").click();
  const listbox = page.locator(".as-multi-select-content").last();
  await expect(listbox).toBeVisible();
  return listbox;
}

// Pick an option from an open popup by its visible label.
async function pick(listbox: Locator, label: string): Promise<void> {
  await listbox.getByRole("option", { name: label, exact: true }).click();
}

async function submit(page: Page): Promise<void> {
  await section(page).locator(".as-submit-btn").click();
}

test.describe("Section 35 — multiselect dispatch", () => {
  test.beforeEach(async ({ page }) => {
    await gotoDemo(page);
  });

  // ── Literal-union → multiselect, NOT add/remove array UI ─────
  test("literal-union array renders combobox, not the array add/remove UI", async ({ page }) => {
    const frameworksUsed = multiselect(page, "Frameworks");
    await expect(frameworksUsed).toBeVisible();
    await expect(frameworksUsed.locator(".as-multi-select-root")).toBeVisible();

    // All four literal members surface as options once the popup opens.
    const listbox = await openPopup(page, frameworksUsed);
    await expect(listbox.getByRole("option")).toHaveCount(4);
    for (const label of ["react", "vue", "svelte", "angular"]) {
      await expect(listbox.getByRole("option", { name: label, exact: true })).toBeVisible();
    }

    // Crucially: no add/remove array UI for this field.
    await expect(frameworksUsed.locator(".as-array-add-btn")).toHaveCount(0);
    await expect(frameworksUsed.locator(".as-object-empty-add")).toHaveCount(0);
  });

  // ── string[] + @ui.form.options → multiselect ────────────────
  test("string[] with @ui.form.options renders multiselect", async ({ page }) => {
    const roles = multiselect(page, "Roles");
    await expect(roles).toBeVisible();
    await expect(roles.locator(".as-multi-select-root")).toBeVisible();

    const listbox = await openPopup(page, roles);
    await expect(listbox.getByRole("option")).toHaveCount(3);
    for (const label of ["Admin", "Editor", "Viewer"]) {
      await expect(listbox.getByRole("option", { name: label, exact: true })).toBeVisible();
    }

    await expect(roles.locator(".as-array-add-btn")).toHaveCount(0);
  });

  // ── Plain string[] (negative control: tags) still renders array UI ──
  test("plain string[] without options keeps the array add/remove UI", async ({ page }) => {
    const tagsAdd = section(page).locator(".as-object-empty-add", { hasText: "Add Tags" });
    await expect(tagsAdd).toBeVisible();

    const tagsField = section(page).locator(".as-multi-select-field", {
      has: page.locator(".as-field-label", { hasText: /^Tags$/ }),
    });
    await expect(tagsField).toHaveCount(0);
  });

  // ── Picking options surfaces chips and writes the model array ────────
  test("picking options pushes values into the model and renders chips", async ({ page }) => {
    const frameworksUsed = multiselect(page, "Frameworks");

    let listbox = await openPopup(page, frameworksUsed);
    await pick(listbox, "react");
    await pick(listbox, "svelte");
    // Close the popup so it doesn't intercept subsequent clicks on the page.
    await page.keyboard.press("Escape");

    await expect(chip(frameworksUsed, "react")).toBeVisible();
    await expect(chip(frameworksUsed, "svelte")).toBeVisible();

    let preview = await readPreview(page);
    expect(preview.frameworksUsed).toEqual(["react", "svelte"]);

    // Re-open and toggle "react" off via the popup (clicking a checked item
    // in multiple mode deselects it).
    listbox = await openPopup(page, frameworksUsed);
    await pick(listbox, "react");
    await page.keyboard.press("Escape");

    preview = await readPreview(page);
    expect(preview.frameworksUsed).toEqual(["svelte"]);
    await expect(chip(frameworksUsed, "react")).toHaveCount(0);
  });

  // ── Chip remove button drops just that value from the model ──────────
  test("clicking a chip's remove button drops just that value", async ({ page }) => {
    const frameworksUsed = multiselect(page, "Frameworks");

    const listbox = await openPopup(page, frameworksUsed);
    await pick(listbox, "react");
    await pick(listbox, "vue");
    await pick(listbox, "svelte");
    await page.keyboard.press("Escape");

    let preview = await readPreview(page);
    expect(preview.frameworksUsed).toEqual(["react", "vue", "svelte"]);

    await chip(frameworksUsed, "vue").locator(".as-multi-select-chip-remove").click();

    preview = await readPreview(page);
    expect(preview.frameworksUsed).toEqual(["react", "svelte"]);
    await expect(chip(frameworksUsed, "vue")).toHaveCount(0);
  });

  // ── Optional multiselect: starts as the scalar-field AsNoData placeholder ──
  test("optional multiselect starts as a placeholder and toggling populates it", async ({
    page,
  }) => {
    const optional = multiselect(page, "Preferred frameworks");
    await expect(optional).toBeVisible();

    const placeholder = optional.locator(".as-no-data").first();
    await expect(placeholder).toBeVisible();
    await expect(optional.locator(".as-multi-select-root")).toHaveCount(0);
    await expect(optional.locator(".as-object-empty-add")).toHaveCount(0);
    let preview = await readPreview(page);
    expect(preview.frameworks).toBeUndefined();

    // Click the placeholder → model becomes [] → combobox renders empty.
    await placeholder.click();
    await expect(optional.locator(".as-multi-select-root")).toBeVisible();
    await expect(optional.locator(".as-multi-select-chip")).toHaveCount(0);
    preview = await readPreview(page);
    expect(preview.frameworks).toEqual([]);

    const listbox = await openPopup(page, optional);
    await pick(listbox, "vue");
    await page.keyboard.press("Escape");

    preview = await readPreview(page);
    expect(preview.frameworks).toEqual(["vue"]);
    await expect(chip(optional, "vue")).toBeVisible();

    // X clear button (header actions) returns to the placeholder state.
    await optional.locator(".as-field-header-actions .as-field-remove-btn").first().click();
    await expect(optional.locator(".as-no-data").first()).toBeVisible();
    await expect(optional.locator(".as-multi-select-root")).toHaveCount(0);
    preview = await readPreview(page);
    expect(preview.frameworks).toBeUndefined();
  });

  // ── Bounded multiselect: minLength 1 fires on empty submit ───
  test("bounded multiselect: submitting with no topic surfaces the minLength error", async ({
    page,
  }) => {
    await submit(page);
    const topics = multiselect(page, "Topics");
    await expect(topics.getByText("Pick at least one topic")).toBeVisible();
  });

  // ── Bounded multiselect: maxLength 3 fires when 4 toggled ────
  test("bounded multiselect: selecting four topics surfaces the maxLength error", async ({
    page,
  }) => {
    const topics = multiselect(page, "Topics");

    const listbox = await openPopup(page, topics);
    await pick(listbox, "Frontend");
    await pick(listbox, "Backend");
    await pick(listbox, "DevOps");
    await pick(listbox, "Design");
    await page.keyboard.press("Escape");

    await submit(page);
    await expect(topics.getByText("Pick at most three topics")).toBeVisible();
  });

  // ── Bounded multiselect: valid selection clears its error ────
  test("bounded multiselect: a valid selection clears the minLength error and writes to the model", async ({
    page,
  }) => {
    await submit(page);
    const topics = multiselect(page, "Topics");
    await expect(topics.getByText("Pick at least one topic")).toBeVisible();

    const listbox = await openPopup(page, topics);
    await pick(listbox, "Frontend");
    await page.keyboard.press("Escape");

    await submit(page);
    await expect(topics.getByText("Pick at least one topic")).toHaveCount(0);

    const preview = await readPreview(page);
    expect(preview.topics).toEqual(["frontend"]);
  });

  // ── Inline X clears the selection without reverting to undefined ──────
  test("inline X clear button empties the selection in place", async ({ page }) => {
    const frameworksUsed = multiselect(page, "Frameworks");

    // Empty: inline X is not rendered.
    await expect(frameworksUsed.locator(".as-multi-select-clear")).toHaveCount(0);

    const listbox = await openPopup(page, frameworksUsed);
    await pick(listbox, "react");
    await pick(listbox, "vue");
    await page.keyboard.press("Escape");

    const inlineClear = frameworksUsed.locator(".as-multi-select-clear");
    await expect(inlineClear).toBeVisible();

    await inlineClear.click();

    await expect(frameworksUsed.locator(".as-multi-select-chip")).toHaveCount(0);
    await expect(inlineClear).toHaveCount(0);
    const preview = await readPreview(page);
    expect(preview.frameworksUsed).toEqual([]);
  });

  // ── Footer Select all / Clear keep the popup open ─────────────
  test("footer Select all selects every option and keeps the popup open", async ({ page }) => {
    const frameworksUsed = multiselect(page, "Frameworks");

    const listbox = await openPopup(page, frameworksUsed);
    const footer = listbox.locator(".as-multi-select-footer");
    await expect(footer).toBeVisible();

    const selectAll = footer.getByRole("button", { name: "Select all" });
    const clear = footer.getByRole("button", { name: "Clear" });
    // Empty selection → Clear disabled, Select all enabled.
    await expect(clear).toBeDisabled();
    await expect(selectAll).toBeEnabled();

    await selectAll.click();

    // Popup is still open after click.
    await expect(listbox).toBeVisible();
    const preview = await readPreview(page);
    expect(preview.frameworksUsed).toEqual(["react", "vue", "svelte", "angular"]);
    // All chips rendered.
    await expect(frameworksUsed.locator(".as-multi-select-chip")).toHaveCount(4);
    // All-selected → Select all disabled, Clear enabled.
    await expect(selectAll).toBeDisabled();
    await expect(clear).toBeEnabled();
  });

  test("footer Clear empties the selection and keeps the popup open", async ({ page }) => {
    const frameworksUsed = multiselect(page, "Frameworks");

    let listbox = await openPopup(page, frameworksUsed);
    await pick(listbox, "react");
    await pick(listbox, "svelte");
    // Reuse the same popup.
    const footer = listbox.locator(".as-multi-select-footer");
    const clear = footer.getByRole("button", { name: "Clear" });

    await clear.click();
    await expect(listbox).toBeVisible();
    const preview = await readPreview(page);
    expect(preview.frameworksUsed).toEqual([]);
    await expect(frameworksUsed.locator(".as-multi-select-chip")).toHaveCount(0);
    // Clear now disabled (empty), Select all enabled.
    await expect(clear).toBeDisabled();
    await expect(footer.getByRole("button", { name: "Select all" })).toBeEnabled();
    // And reopen still works.
    listbox = page.locator(".as-multi-select-content").last();
    await expect(listbox).toBeVisible();
  });
});
