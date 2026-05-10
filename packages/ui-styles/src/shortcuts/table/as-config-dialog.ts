import { defineShortcuts } from "vunor/theme";
import { dialogBase, dialogOverlay } from "./_shared";

export const asConfigDialogShortcuts = defineShortcuts({
  "as-config-dialog-overlay": dialogOverlay,
  // Desktop: fixed height so tab switches don't resize. Mobile: full-screen
  // via `dialogBase`.
  "as-config-dialog-content": `${dialogBase} sm:w-[640px] sm:max-w-[92vw] sm:h-[clamp(500px,70vh,600px)]`,
  "as-config-dialog-header": "flex items-center gap-$m px-$l py-$m border-b-1 flex-shrink-0",
  "as-config-dialog-title": "m-0 text-body-l font-600 whitespace-nowrap tracking-[-0.01em]",
  "as-config-dialog-close": "as-dialog-close",
  "as-config-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-config-dialog-footer": "flex items-center gap-$s px-$l py-$m border-t-1 flex-shrink-0",
});
