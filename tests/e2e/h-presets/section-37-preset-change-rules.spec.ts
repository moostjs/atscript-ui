// Section 37 — Presets: what counts as a change (0.1.142).
//
// `state.preset.activeSnapshot` is canonical since 0.1.142: a width equal to
// the column default, and a filter field with nothing filled, are the same as
// no entry. The picker's unsaved marker (`.as-preset-picker-trigger-dirty`)
// is the observable.
//
// Demo surface: `/orders-presets` (`packages/vue-demo/src/client/domain/tables.ts`)
// — the orders API under its own `tableKey`, so presets saved here never
// reach Section 11's `/orders` picker. System presets:
//   - `Default widths` — columnWidths `{ id: "96px", status: "128px" }`, both
//     the columns' computed defaults (`computeDefaultColumnWidth`: number →
//     96px; the status enum's longest label "processing" → 10·8+48 = 128px),
//     plus `notAColumn: "50px"` on a path that is not a column.
//   - `Wide status`    — columnWidths `{ status: "240px" }` (not the default).
//   - `Empty status filter` — filterOps `{ status: [] }`.
//   - `Shipped only`   — filterOps `{ status: [eq shipped] }`.
//
// Mutating (Save as / Save write `_presets` rows): `resetSeed()` once in
// `beforeAll`, serial.

import type { Page } from "@playwright/test";

import { type Locator, expect, test } from "../fixtures";

import {
  applyPickerItem,
  clickColumnHeader,
  gotoTable,
  newRequestContext,
  openPresetPicker,
  openSaveAsPopover,
  pickPillEnumValue,
  pillByLabel,
  resetSeed,
} from "../helpers";

// ---------------------------------------------------------------------
// Inline helpers.

const SLUG = "orders-presets";
const PICKER_TRIGGER_LABEL = ".as-preset-picker-trigger-label";
const DIRTY = ".as-preset-picker-trigger-dirty";
const POPOVER_NAME_INPUT = ".as-preset-picker-popover-input";
const POPOVER_SAVE_BTN = ".as-preset-picker-popover-save";
const PRESET_COLUMNS = ["id", "customerId", "status", "total", "createdAt"];

function th(page: Page, path: string): Locator {
  return page.locator(`table[data-as-main-table] thead th[data-column-path="${path}"]`);
}

async function thWidth(page: Page, path: string): Promise<number> {
  return th(page, path).evaluate((el) =>
    Math.round((el as HTMLElement).getBoundingClientRect().width),
  );
}

/** Drag `path`'s resize handle by `dx` px (pointer events, see Section 16.6). */
async function dragResize(page: Page, path: string, dx: number): Promise<void> {
  const handle = th(page, path).locator(".as-th-resize-handle");
  const box = await handle.boundingBox();
  if (!box) throw new Error(`No bounding box for ${path} resize handle`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 4; step++) {
    await page.mouse.move(x + (dx * step) / 4, y, { steps: 4 });
  }
  await page.mouse.up();
}

/** Column menu → `Reset width`. */
async function resetWidth(page: Page, path: string): Promise<void> {
  await clickColumnHeader(page, path);
  const menu = page.locator(".as-column-menu-content");
  await expect(menu).toBeVisible();
  await menu.locator(".as-column-menu-item", { hasText: "Reset width" }).click();
  await expect(menu).toHaveCount(0);
}

async function gotoPresets(page: Page): Promise<void> {
  await gotoTable(page, SLUG, { apiPath: "orders" });
  await expect(page.locator(PICKER_TRIGGER_LABEL)).toHaveText("Standard");
}

async function applyPreset(page: Page, label: string): Promise<void> {
  await applyPickerItem(page, label);
  await expect(page.locator(PICKER_TRIGGER_LABEL)).toHaveText(label);
}

async function removeStatusChip(page: Page): Promise<void> {
  const pill = pillByLabel(page, "Status");
  await pill.locator(".as-filter-field-chip .as-filter-field-chip-remove").first().click();
  await expect(pill.locator(".as-filter-field-chip")).toHaveCount(0);
}

type WireContent = {
  columns?: { columnNames?: string[]; columnWidths?: Array<{ field: string; width: string }> };
};

/** `data.content` of a captured preset insert / update body. */
function contentOf(body: unknown): WireContent | undefined {
  return (body as { data?: { content?: WireContent } } | undefined)?.data?.content;
}

// ---------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Section 37 — Presets: what counts as a change", () => {
  test.beforeAll(async () => {
    await resetSeed();
  });

  test("37.1 — a preset spelling out the default widths (and a non-column width) applies clean", async ({
    page,
  }) => {
    await gotoPresets(page);
    await applyPreset(page, "Default widths");
    await expect(page.locator(DIRTY)).toHaveCount(0);
    // The preset really names the defaults (a changed default would make
    // this file test something else).
    expect(await thWidth(page, "id")).toBe(96);
    expect(await thWidth(page, "status")).toBe(128);
    await expect(th(page, "shippedAt")).toHaveCount(0);
  });

  test("37.2 — a genuine resize is a change; resetting the width back clears it", async ({
    page,
  }) => {
    await gotoPresets(page);
    await applyPreset(page, "Default widths");

    await dragResize(page, "status", 60);
    await expect.poll(() => thWidth(page, "status")).toBeGreaterThan(160);
    await expect(page.locator(DIRTY)).toBeVisible();

    await resetWidth(page, "status");
    expect(await thWidth(page, "status")).toBe(128);
    await expect(page.locator(DIRTY)).toHaveCount(0);
  });

  test("37.3 — a preset width that differs from the default still counts", async ({ page }) => {
    await gotoPresets(page);
    await applyPreset(page, "Wide status");
    expect(await thWidth(page, "status")).toBe(240);
    await expect(page.locator(DIRTY)).toHaveCount(0);

    // Back to the column default = away from the preset → modified.
    await resetWidth(page, "status");
    expect(await thWidth(page, "status")).toBe(128);
    await expect(page.locator(DIRTY)).toBeVisible();
  });

  test("37.4 — an empty preset filter stays clean after the user fills and clears the field", async ({
    page,
  }) => {
    await gotoPresets(page);
    await applyPreset(page, "Empty status filter");
    await expect(page.locator(DIRTY)).toHaveCount(0);
    const pill = pillByLabel(page, "Status");
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(0);

    await pickPillEnumValue(page, pill, "shipped");
    await expect(pill.locator(".as-filter-field-chip")).toHaveCount(1);
    await expect(page.locator(DIRTY)).toBeVisible();

    await removeStatusChip(page);
    await expect(page.locator(DIRTY)).toHaveCount(0);
  });

  test("37.5 — clearing a field the preset filled is a change", async ({ page }) => {
    await gotoPresets(page);
    await applyPreset(page, "Shipped only");
    await expect(pillByLabel(page, "Status").locator(".as-filter-field-chip")).toHaveCount(1);
    await expect(page.locator(DIRTY)).toHaveCount(0);

    await removeStatusChip(page);
    await expect(page.locator(DIRTY)).toBeVisible();
  });

  test("37.6 — Save as never stores a default-equal width; a real resize is stored as an override", async ({
    page,
  }) => {
    await gotoPresets(page);
    await applyPreset(page, "Default widths");

    // Save as straight after applying: no width overrides at all.
    let popover = await openSaveAsPopover(page, await openPresetPicker(page));
    await popover.locator(POPOVER_NAME_INPUT).fill("Defaults copy");
    let post = page.waitForRequest(
      (r) => r.url().includes("/api/db/_presets") && r.method() === "POST",
    );
    await popover.locator(POPOVER_SAVE_BTN).click();
    let body = (await post).postDataJSON();
    await expect(popover).toHaveCount(0);
    expect(contentOf(body)?.columns?.columnNames).toEqual(PRESET_COLUMNS);
    expect(contentOf(body)?.columns?.columnWidths).toBeUndefined();
    await expect(page.locator(PICKER_TRIGGER_LABEL)).toHaveText("Defaults copy");
    await expect(page.locator(DIRTY)).toHaveCount(0);

    // Resize → Save as: only the resized column is written.
    await dragResize(page, "total", 60);
    await expect(page.locator(DIRTY)).toBeVisible();
    const width = await thWidth(page, "total");
    popover = await openSaveAsPopover(page, await openPresetPicker(page));
    await popover.locator(POPOVER_NAME_INPUT).fill("Wide total");
    post = page.waitForRequest(
      (r) => r.url().includes("/api/db/_presets") && r.method() === "POST",
    );
    await popover.locator(POPOVER_SAVE_BTN).click();
    body = (await post).postDataJSON();
    await expect(popover).toHaveCount(0);
    const widths = contentOf(body)?.columns?.columnWidths ?? [];
    expect(widths.map((w) => w.field)).toEqual(["total"]);
    expect(Math.round(Number.parseFloat(widths[0]!.width))).toBe(width);
    await expect(page.locator(DIRTY)).toHaveCount(0);
  });

  test("37.7 — a stored preset with a default-equal width applies clean; Save writes overrides only", async ({
    page,
  }) => {
    const label = "Stored default id width";
    const ctx = await newRequestContext("admin");
    try {
      const res = await ctx.post("/api/db/_presets", {
        data: {
          type: "preset",
          app: "vuedemo",
          tableKey: SLUG,
          public: false,
          data: {
            label,
            content: {
              columns: {
                columnNames: PRESET_COLUMNS,
                columnWidths: [{ field: "id", width: "96px" }],
              },
              filters: ["customerId", "status"],
              filterOps: [{ field: "status", conditions: [] }],
            },
          },
        },
      });
      expect(res.ok(), `insert failed: ${res.status()}`).toBeTruthy();
    } finally {
      await ctx.dispose();
    }

    await gotoPresets(page);
    await applyPreset(page, label);
    await expect(page.locator(DIRTY)).toHaveCount(0);

    await dragResize(page, "total", 60);
    await expect(page.locator(DIRTY)).toBeVisible();

    const menu = await openPresetPicker(page);
    const patch = page.waitForRequest(
      (r) =>
        r.url().includes("/api/db/_presets") && (r.method() === "PATCH" || r.method() === "PUT"),
    );
    await menu.locator(".as-preset-picker-action-primary", { hasText: "Save" }).click();
    const body = (await patch).postDataJSON();
    const content = contentOf(body);
    expect(content?.columns?.columnNames).toEqual(PRESET_COLUMNS);
    expect((content?.columns?.columnWidths ?? []).map((w) => w.field)).toEqual(["total"]);
    await expect(page.locator(DIRTY)).toHaveCount(0);
  });
});
