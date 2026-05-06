import { expect, type Locator, type Page } from "@playwright/test";

/** The three tabs in the toolbar's `<AsConfigDialog>`. */
export type ConfigTab = "columns" | "filters" | "sorters";

const TAB_TITLES: Record<ConfigTab, string> = {
  columns: "Columns",
  filters: "Filters",
  sorters: "Sorters",
};

/** Root locator for the toolbar's `<AsConfigDialog>`. */
export function configDialog(page: Page): Locator {
  return page.locator(".as-config-dialog-content");
}

/**
 * Tab trigger for the named tab. The dialog renders triggers in canonical
 * order (`columns`, `filters`, `sorters`) — match by index for stability
 * against label-text drift.
 */
export function configTabTrigger(dialog: Locator, tab: ConfigTab): Locator {
  const order: ConfigTab[] = ["columns", "filters", "sorters"];
  return dialog.locator(".as-config-tab-trigger").nth(order.indexOf(tab));
}

/** Active tabpanel inside an open config dialog. */
export function configActivePanel(dialog: Locator): Locator {
  return dialog.locator("[role='tabpanel'][data-state='active']");
}

/**
 * Row in the active config tabpanel by visible label. Handles both label
 * variants — Columns/Sorters use `.as-orderable-list-item-label`, Filters
 * uses `.as-config-field-label-text` (custom slot in `<AsFieldsSelector>`).
 */
export function configListRow(dialog: Locator, label: string): Locator {
  return configActivePanel(dialog).locator(
    `.as-orderable-list-item:has(.as-orderable-list-item-label:text-is("${label}")),` +
      `.as-orderable-list-item:has(.as-config-field-label-text:text-is("${label}"))`,
  );
}

/**
 * Open the toolbar config dialog at the named tab via its toolbar entry
 * button (`title="Columns" | "Filters" | "Sorters"`). Returns the dialog
 * locator with the tab pre-active.
 */
export async function openConfigDialog(page: Page, tab: ConfigTab): Promise<Locator> {
  await page.getByTitle(TAB_TITLES[tab], { exact: true }).click();
  const dialog = configDialog(page);
  await expect(dialog).toBeVisible();
  await expect(configTabTrigger(dialog, tab)).toHaveAttribute("data-state", "active");
  return dialog;
}

/** Click Apply, assert the dialog dismissed. */
export async function applyConfig(dialog: Locator): Promise<void> {
  await dialog.locator(".as-filter-btn-apply").click();
  await expect(dialog).toHaveCount(0);
}

/** Click Cancel, assert the dialog dismissed. */
export async function cancelConfig(dialog: Locator): Promise<void> {
  await dialog.locator(".as-filter-btn", { hasText: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
}

/** Toggle a config-list row's checkbox via row click. */
export async function toggleConfigListRow(dialog: Locator, label: string): Promise<void> {
  await configListRow(dialog, label).click();
}

/**
 * Move a config-list row down one slot via its hover-revealed Move-down
 * arrow. Hovers the row first since `.as-orderable-list-item-actions` is
 * `opacity-0 pointer-events-none` until group-hover.
 */
export async function moveConfigListRowDown(dialog: Locator, label: string): Promise<void> {
  const row = configListRow(dialog, label);
  await row.hover();
  await row.getByTitle("Move down", { exact: true }).click();
}
