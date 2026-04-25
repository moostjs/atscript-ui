import { defineShortcuts } from "vunor/theme";
import { dialogBase, dialogOverlay } from "./_shared";

export const asConfigDialogShortcuts = defineShortcuts({
  "as-config-dialog-overlay": dialogOverlay,
  "as-config-dialog-content": `${dialogBase} w-[640px] max-w-[92vw] min-h-[480px] max-h-[85vh]`,
  "as-config-dialog-header": "flex items-center gap-$m px-$l py-$m border-b-1 flex-shrink-0",
  "as-config-dialog-title": "m-0 text-body-l font-600 whitespace-nowrap tracking-[-0.01em]",
  "as-config-dialog-close": {
    "": "inline-grid place-items-center w-fingertip-s h-fingertip-s p-0 ml-auto border-0 bg-transparent text-current/80 cursor-pointer leading-none rounded-base flex-shrink-0 transition-colors duration-120 text-[1.25em]",
    "hover:": "layer-2 text-current",
  },
  "as-config-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-config-dialog-footer": "flex items-center gap-$s px-$l py-$m border-t-1 flex-shrink-0",
});
