import { defineShortcuts } from "vunor/theme";
import { dialogBase, dialogOverlay } from "./_shared";

/**
 * `<AsValueHelpDialog>` (since 0.1.190): a form field's picker dialog — the
 * dictionary as a table (`as-filter-value-help-*` inside), one row picked.
 * Fixed desktop size like the filter dialog; full screen on mobile.
 */
export const asValueHelpDialogShortcuts = defineShortcuts({
  "as-value-help-dialog-overlay": dialogOverlay,
  "as-value-help-dialog-content": `${dialogBase} sm:w-[640px] sm:max-w-[92vw] sm:h-[clamp(500px,70vh,600px)]`,
  "as-value-help-dialog-header": "flex items-center justify-between gap-$m px-$l py-$m border-b-1",
  "as-value-help-dialog-title": "m-0 text-body-l font-600 tracking-[-0.01em]",
  "as-value-help-dialog-close": "as-close-btn",
});
