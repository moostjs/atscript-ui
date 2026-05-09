import { defineShortcuts } from "vunor/theme";

export const asArrayShortcuts = defineShortcuts({
  // Footer Add button — only the array-specific control. Item rendering
  // reuses AsField / AsObject / AsArray chrome (label + X Remove).
  "as-array-add-row": "as-grid-item flex justify-start mt-$xs",
  "as-array-add-btn": {
    "": "inline-flex items-center gap-$xs h-fingertip-s px-$m border-1 border-dashed rounded-base bg-transparent text-current/60 cursor-pointer transition-all duration-120 disabled-soft",
    "hover:not-disabled:": "border-current-hl text-current-hl bg-current-hl/10",
  },

  // Items count chip — rendered inside AsCollapsible's #badges slot.
  // Same height as Clear / Remove so the three header controls align.
  "as-array-items-chip":
    "inline-flex items-center h-[1.5em] px-$s rounded-base text-callout font-600 leading-none shrink-0 layer-2 text-current",

  "as-array-error": "scope-error text-callout text-current-hl",
});
