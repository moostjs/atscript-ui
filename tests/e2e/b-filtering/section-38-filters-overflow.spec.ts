// Section 38 — `<AsFilters>` overflow popover controls (0.1.142).
//
// Read-only batch — filters are client state; no mutation, no `resetSeed()`.
//
// Demo surface: `/orders-filters` (`packages/vue-demo/src/client/domain/tables.ts`)
// renders `<AsFilters :max-visible="1" v-model:overflow-open="moreOpen">` —
// Customer inline, Status + Total in the popover — with a custom
// `#overflow-trigger` (`.demo-more-filters`, text `More (<activeCount>)`,
// `data-open` = the slot's `open`). A strip under the toolbar
// (`TableToolbar.vue`) exposes:
//   - `.demo-overflow-open` / `.demo-overflow-close` — write the bound model;
//     `.demo-overflow-state` reads it back (`open` / `closed`).
//   - `.demo-open-focus-count` / `.demo-close-focus-count` — how many
//     `overflow-open-auto-focus` / `overflow-close-auto-focus` events fired.
//   - `.demo-keep-focus-open` / `.demo-keep-focus-close` — `preventDefault()`
//     on the matching event.
//   - `.demo-custom-overflow` — swaps in an `#overflow` body
//     (`.demo-overflow-title` "<n> more filters", one `<AsFilterField>` per
//     column, `.demo-overflow-done` calling `close()`).
//   - `.demo-close-on-dialog` — the documented recipe: close the popover
//     when `state.filterDialogColumn` is set.
//
// `.demo-overflow-close` is fired with `dispatchEvent("click")`: a real
// pointer press outside the (non-modal) popover dismisses it on
// `pointerdown` by itself, which would pass the test without the model
// doing anything.

import { type Locator, type Page, expect, test } from "../fixtures";

import { gotoTable, pillByLabel } from "../helpers";

// ---------------------------------------------------------------------
// File-local helpers.

const POPOVER = ".as-filters-overflow";
const TRIGGER = ".demo-more-filters";
const FILTER_DIALOG = ".as-filter-dialog-content";

async function gotoOverflow(page: Page): Promise<void> {
  await gotoTable(page, "orders-filters", { apiPath: "orders" });
  await expect(page.locator(TRIGGER)).toBeVisible();
}

function popover(page: Page): Locator {
  return page.locator(POPOVER);
}

async function openViaTrigger(page: Page): Promise<Locator> {
  await page.locator(TRIGGER).click();
  const pop = popover(page);
  await expect(pop).toBeVisible();
  return pop;
}

/**
 * Opening the popover auto-focuses its first field — Status, a combobox
 * whose input opens its value dropdown on focus, covering the fields below.
 * Escape closes that dropdown only (it is the top dismissable layer).
 */
async function closeAutoFocusedDropdown(page: Page): Promise<void> {
  const dropdown = page.locator(".as-filter-field-dropdown");
  await expect(dropdown).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dropdown).toHaveCount(0);
  await expect(popover(page)).toBeVisible();
}

/** `document.activeElement` is inside the popover content. */
async function focusInsidePopover(page: Page): Promise<boolean> {
  return page.evaluate((sel) => !!document.activeElement?.closest(sel), POPOVER);
}

/** A popover field's search input, by column label. */
function popoverInput(page: Page, label: string): Locator {
  return popover(page)
    .locator(".as-filter-field")
    .filter({ has: page.locator(`label.as-filter-field-label:text-is("${label}")`) })
    .locator(".as-filter-field-search");
}

// ---------------------------------------------------------------------

test.describe("Section 38.1 — v-model:overflow-open", () => {
  test("the host opens and closes the popover through the model, and observes the user's toggles", async ({
    page,
  }) => {
    await gotoOverflow(page);
    const state = page.locator(".demo-overflow-state");
    const trigger = page.locator(TRIGGER);

    // Only Customer renders inline; Status + Total overflow.
    await expect(pillByLabel(page, "Customer")).toHaveCount(1);
    await expect(pillByLabel(page, "Status")).toHaveCount(0);
    await expect(state).toHaveText("closed");
    await expect(popover(page)).toHaveCount(0);

    // Host → open.
    await page.locator(".demo-overflow-open").click();
    await expect(popover(page)).toBeVisible();
    await expect(state).toHaveText("open");
    await expect(trigger).toHaveAttribute("data-open", "true");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Host → close (model write only — see the file header).
    await page.locator(".demo-overflow-close").dispatchEvent("click");
    await expect(popover(page)).toHaveCount(0);
    await expect(state).toHaveText("closed");
    await expect(trigger).toHaveAttribute("data-open", "false");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // User → open via the trigger, close via Escape; the model follows.
    await openViaTrigger(page);
    await expect(state).toHaveText("open");
    await closeAutoFocusedDropdown(page);
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    await expect(state).toHaveText("closed");
  });
});

test.describe("Section 38.2 — #overflow-trigger and #overflow slots", () => {
  test("custom trigger replaces the default one, carries the popover ARIA and the active count", async ({
    page,
  }) => {
    await gotoOverflow(page);
    const trigger = page.locator(TRIGGER);
    await expect(page.locator(".as-filters-overflow-trigger")).toHaveCount(0);
    await expect(trigger).toHaveText("More (0)");
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    // Filter Total from inside the popover → the hidden filter is counted.
    const pop = await openViaTrigger(page);
    await closeAutoFocusedDropdown(page);
    const pagesResp = page.waitForResponse(
      (r) => r.url().includes("/api/db/tables/orders/pages") && r.status() === 200,
    );
    const total = popoverInput(page, "Total");
    await total.click();
    await total.fill(">10");
    await total.press("Enter");
    await pagesResp;
    await expect(pop.locator(".as-filter-field-chip")).toHaveCount(1);
    await expect(trigger).toHaveText("More (1)");
  });

  test("custom body renders the overflowed columns and its close() closes the popover", async ({
    page,
  }) => {
    await gotoOverflow(page);
    await page.locator(".demo-custom-overflow").check();

    const pop = await openViaTrigger(page);
    await closeAutoFocusedDropdown(page);
    await expect(pop.locator(".demo-overflow-title")).toHaveText("2 more filters");
    const labels = await pop.locator(".as-filter-field-label").allTextContents();
    expect(labels.map((l) => l.trim())).toEqual(["Status", "Total"]);

    await pop.locator(".demo-overflow-done").click();
    await expect(popover(page)).toHaveCount(0);
    await expect(page.locator(".demo-overflow-state")).toHaveText("closed");
  });
});

test.describe("Section 38.3 — auto-focus events", () => {
  test("open focuses the first field, close returns focus to the trigger; each event fires once", async ({
    page,
  }) => {
    await gotoOverflow(page);
    const openCount = page.locator(".demo-open-focus-count");
    const closeCount = page.locator(".demo-close-focus-count");
    await expect(openCount).toHaveText("0");
    await expect(closeCount).toHaveText("0");

    await openViaTrigger(page);
    await expect(openCount).toHaveText("1");
    await expect.poll(() => focusInsidePopover(page)).toBe(true);

    // Close from a plain field (Total) so Escape reaches the popover.
    await popoverInput(page, "Total").focus();
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    await expect(closeCount).toHaveText("1");
    await expect(page.locator(TRIGGER)).toBeFocused();
  });

  test("preventDefault on close keeps focus off the trigger", async ({ page }) => {
    await gotoOverflow(page);
    await page.locator(".demo-keep-focus-close").check();

    await openViaTrigger(page);
    await popoverInput(page, "Total").focus();
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    await expect(page.locator(".demo-close-focus-count")).toHaveText("1");
    await expect(page.locator(TRIGGER)).not.toBeFocused();
  });

  test("preventDefault on open keeps focus where it was", async ({ page }) => {
    await gotoOverflow(page);
    await page.locator(".demo-keep-focus-open").check();

    await openViaTrigger(page);
    await expect(page.locator(".demo-open-focus-count")).toHaveText("1");
    expect(await focusInsidePopover(page)).toBe(false);
    await expect(page.locator(TRIGGER)).toBeFocused();
  });
});

test.describe("Section 38.4 — F4 inside the popover", () => {
  test("F4 opens the filter dialog, the popover stays open, and closing the dialog refocuses the input", async ({
    page,
  }) => {
    await gotoOverflow(page);
    await openViaTrigger(page);
    const total = popoverInput(page, "Total");
    await total.focus();
    await total.press("F4");

    const dialog = page.locator(FILTER_DIALOG);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".as-filter-dialog-title-value")).toHaveText("Total");
    await expect(popover(page)).toBeVisible();
    await expect(page.locator(".demo-overflow-state")).toHaveText("open");

    await dialog.locator(".as-filter-dialog-close").click();
    await expect(dialog).toHaveCount(0);
    await expect(popover(page)).toBeVisible();
    await expect(page.locator(".demo-overflow-state")).toHaveText("open");
    await expect(popoverInput(page, "Total")).toBeFocused();
  });

  test("same from the Status combobox: the popover outlives its dropdown and the dialog", async ({
    page,
  }) => {
    await gotoOverflow(page);
    await openViaTrigger(page);
    // Auto-focus landed in Status and opened its value dropdown.
    const status = popoverInput(page, "Status");
    await expect(status).toBeFocused();
    await status.press("F4");

    const dialog = page.locator(FILTER_DIALOG);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".as-filter-dialog-title-value")).toHaveText("Status");
    await expect(popover(page)).toBeVisible();

    await dialog.locator(".as-filter-dialog-close").click();
    await expect(dialog).toHaveCount(0);
    await expect(popover(page)).toBeVisible();
    await expect(page.locator(".demo-overflow-state")).toHaveText("open");
    await expect(popoverInput(page, "Status")).toBeFocused();
  });

  test("Escape closes the dialog first; the popover and the input focus survive", async ({
    page,
  }) => {
    await gotoOverflow(page);
    await openViaTrigger(page);
    const total = popoverInput(page, "Total");
    await total.focus();
    await total.press("F4");
    const dialog = page.locator(FILTER_DIALOG);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(popover(page)).toBeVisible();
    await expect(popoverInput(page, "Total")).toBeFocused();
  });

  test("host recipe: closing the popover when filterDialogColumn is set", async ({ page }) => {
    await gotoOverflow(page);
    await page.locator(".demo-close-on-dialog").check();
    await openViaTrigger(page);
    const total = popoverInput(page, "Total");
    await total.focus();
    await total.press("F4");

    const dialog = page.locator(FILTER_DIALOG);
    await expect(dialog).toBeVisible();
    await expect(popover(page)).toHaveCount(0);
    await expect(page.locator(".demo-overflow-state")).toHaveText("closed");

    // The dialog is usable on its own: close it, nothing reopens.
    await dialog.locator(".as-filter-dialog-close").click();
    await expect(dialog).toHaveCount(0);
    await expect(popover(page)).toHaveCount(0);
  });
});
