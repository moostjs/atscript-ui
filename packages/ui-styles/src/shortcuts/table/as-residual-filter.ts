import { defineShortcuts } from "vunor/theme";

/**
 * `<AsResidualFilter>` — a residual filter condition (one the per-field
 * filters cannot hold) as a chip in the filter row. Field-shaped like
 * `as-filter-field` (label segment + body) so it sits in the same row, with
 * the condition in words and a remove button.
 */
export const asResidualFilterShortcuts = defineShortcuts({
  "as-residual-filter":
    "scope-primary inline-flex items-stretch h-fingertip-m border-1 rounded-base layer-0 min-w-0 max-w-[32em] flex-shrink-0 overflow-hidden",
  "as-residual-filter-label":
    "inline-flex items-center px-$s layer-2 text-current/80 text-callout font-500 border-r-1 whitespace-nowrap flex-shrink-0",
  "as-residual-filter-text":
    "block self-center px-$s min-w-0 text-callout text-current-hl truncate",
  "as-residual-filter-remove": {
    "": "inline-grid place-items-center w-fingertip-s border-0 border-l-1 bg-transparent text-current/70 cursor-pointer flex-shrink-0 transition-colors duration-120 text-[1.25em] leading-none",
    "hover:": "layer-2 text-current-hl",
    "focus-visible:": "outline-none text-current-hl",
  },
});
