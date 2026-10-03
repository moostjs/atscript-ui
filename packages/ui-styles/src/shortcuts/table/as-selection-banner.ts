import { defineShortcuts } from "vunor/theme";

/**
 * `<AsSelectionBanner>` — the strip `<AsTable>` / `<AsWindowTable>` render
 * above their body while every loaded row is selected ("Select all N
 * matching") or a query selection is held ("Clear selection"). A quiet
 * primary-tinted bar; the action is a flat in-line button.
 */
export const asSelectionBannerShortcuts = defineShortcuts({
  "as-selection-banner":
    "scope-primary flex items-center justify-center flex-wrap gap-x-$s gap-y-$xxs px-$m py-$xxs layer-1 border-b-1 text-callout text-current flex-shrink-0",
  "as-selection-banner-text": "min-w-0",
  "as-selection-banner-btn": "scope-primary c8-flat btn h-fingertip-xs px-$s font-600 shrink-0",
});
