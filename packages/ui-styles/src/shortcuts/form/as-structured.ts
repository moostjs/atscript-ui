import { defineShortcuts } from "vunor/theme";
import { strongText } from "./_shared";

export const asStructuredShortcuts = defineShortcuts({
  "as-structured-header": "flex items-center justify-between gap-$s mb-$s",
  "as-structured-header-content": "flex items-center gap-$xs flex-1 min-w-0",
  "as-structured-title": `m-0 font-600 ${strongText} tracking-[-0.005em]`,
  "as-structured-remove-btn": {
    "": "inline-flex items-center h-fingertip-s px-$s border-1 bg-transparent text-current/60 rounded-base cursor-pointer text-callout flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:": "scope-error bg-current-hl/10 text-current-hl border-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
});
