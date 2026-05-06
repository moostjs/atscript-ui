import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Click the `…` trigger inside `row` and wait for the portalled menu to
 * become visible. Returns the `.as-row-actions-menu` Locator.
 *
 * Assumes the row's actions cell renders the dropdown variant (≥ 2 actions
 * survive per-row gating). For 1-action / no-action variants, click
 * `.as-row-actions-btn` directly in the spec.
 */
export async function openRowActionsMenu(page: Page, row: Locator): Promise<Locator> {
  await row.locator(".as-row-actions-more").click();
  const menu = page.locator(".as-row-actions-menu");
  await expect(menu).toBeVisible();
  return menu;
}

/** Click a row-actions menu item by exact label match (text contains). */
export async function clickRowMenuItem(menu: Locator, label: string): Promise<void> {
  await menu.locator(".as-row-actions-menu-item").filter({ hasText: label }).first().click();
}

/**
 * Click a toolbar `.as-table-actions-btn` whose label contains `label`.
 * Use for toolbar default-action buttons (`Suspend`, `Activate`, etc.) and
 * collapsed-single-button promotions.
 */
export async function clickToolbarAction(page: Page, label: string): Promise<void> {
  await page.locator(".as-table-actions-btn").filter({ hasText: label }).first().click();
}

/**
 * Wait for the `<AsActionFormDialog>` to be visible AND for at least one
 * form input to be in the DOM (the form schema fetch is async — a fast
 * test could click submit before AsForm hydrates). Returns the
 * `.as-action-form-content` Locator.
 *
 * **Specs that need a specific named field** (e.g. `input[name="reason"]`)
 * should add their own `await expect(...).toHaveCount(1)` after this
 * helper resolves — the helper guarantees the dialog is mounted, not
 * which fields it carries.
 */
export async function awaitActionFormReady(page: Page): Promise<Locator> {
  const form = page.locator(".as-action-form-content");
  await expect(form).toBeVisible();
  await expect(form.locator("input, textarea, select")).not.toHaveCount(0);
  return form;
}

/** Cancel the action-form dialog and wait for it to dismount. */
export async function dismissActionForm(page: Page): Promise<void> {
  await page.locator(".as-action-form-cancel").click();
  await expect(page.locator(".as-action-form-content")).toHaveCount(0);
}

/** Cancel the confirm-dialog (`<AsConfirmDialog>`) and wait for it to dismount. */
export async function dismissConfirm(page: Page): Promise<void> {
  await page.locator(".as-confirm-dialog-cancel").click();
  await expect(page.locator(".as-confirm-dialog-content")).toHaveCount(0);
}

/**
 * Find the toast (TablePage's `<ToastStack>` mounts each toast as a direct
 * child of `.fixed.bottom-4.right-4`) whose text contains `contains`.
 * Asserts visible before returning.
 *
 * **Does not** dismiss the toast — toasts auto-dismiss after a timer; tests
 * that need to assert dismissal should `await expect(toast).toHaveCount(0)`
 * with a generous timeout.
 */
export async function findToast(page: Page, contains: string): Promise<Locator> {
  const toast = page.locator(".fixed.bottom-4.right-4 > div").filter({ hasText: contains });
  await expect(toast).toBeVisible();
  return toast;
}
