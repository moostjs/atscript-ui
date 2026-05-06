import { expect, type Locator, type Page } from "@playwright/test";

const PICKER_TRIGGER = ".as-preset-picker-trigger";
const PICKER_MENU = ".as-preset-picker-menu";
const PICKER_POPOVER = ".as-preset-picker-popover";
const PICKER_ACTION = ".as-preset-picker-action";
const PICKER_ITEM = ".as-preset-picker-item";
const DIALOG_CONTENT = ".as-preset-dialog-content";
const DIALOG_ROW = ".as-preset-dialog-row";

/**
 * Click the preset-picker trigger and wait for the dropdown menu portal.
 * Returns the menu Locator (use it to scope subsequent
 * `menu.locator(...)` queries instead of fishing through the whole DOM).
 */
export async function openPresetPicker(page: Page): Promise<Locator> {
  await page.locator(PICKER_TRIGGER).click();
  const menu = page.locator(PICKER_MENU);
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * From an open picker menu, click `Save as` and wait for the popover to
 * mount. Returns the popover Locator.
 */
export async function openSaveAsPopover(page: Page, menu: Locator): Promise<Locator> {
  await menu.locator(PICKER_ACTION).filter({ hasText: "Save as" }).click();
  const popover = page.locator(PICKER_POPOVER);
  await expect(popover).toBeVisible();
  return popover;
}

/**
 * From an open picker menu, click `Manage presets` and wait for the
 * manager dialog to mount. Returns the dialog Locator.
 */
export async function openManageDialog(page: Page, menu: Locator): Promise<Locator> {
  await menu.locator(PICKER_ACTION).filter({ hasText: "Manage presets" }).click();
  const dialog = page.locator(DIALOG_CONTENT);
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Locator for a manager-dialog row whose `.as-preset-dialog-row-label-text`
 * exactly equals `label`. Returns the row container so callers can
 * `row.locator(...)` for action icons (pin / star / public / trash) without
 * an extra ancestor walk.
 */
export function dialogRow(dialog: Locator, label: string): Locator {
  return dialog
    .locator(DIALOG_ROW)
    .filter({ has: dialog.page().locator(`.as-preset-dialog-row-label-text:text-is("${label}")`) });
}

/**
 * Click a picker row by its label, wait for the menu to close, then
 * optionally wait for a `/pages` GET refetch driven by the snapshot-state
 * watcher. Pass `{ table }` whenever the apply will trigger a server hit.
 */
export async function applyPickerItem(
  page: Page,
  label: string,
  opts: { table?: string } = {},
): Promise<void> {
  const menu = await openPresetPicker(page);
  await menu.locator(PICKER_ITEM).filter({ hasText: label }).click();
  await expect(menu).toHaveCount(0);
  if (opts.table) {
    await page.waitForResponse(
      (r) =>
        r.url().includes(`/api/db/tables/${opts.table}/pages`) &&
        r.request().method() === "GET" &&
        r.status() === 200,
    );
  }
}
