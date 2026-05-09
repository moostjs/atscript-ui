import { defineShortcuts } from "vunor/theme";

export const asArrayShortcuts = defineShortcuts({
  // Body lives inside `as-collapsible-body` (a 12-col grid) — must
  // claim the whole row before laying its rows out as a flex stack.
  "as-array-body": "as-grid-item flex flex-col gap-$xs",

  "as-array-row-bare":
    "as-grid-item flex items-end gap-$xs [&>:first-child]:flex-1 [&>:first-child]:min-w-0",

  "as-array-row-island":
    "as-grid-item layer-0 border-1 rounded-r2 p-$m flex flex-col gap-$xs",
  "as-array-row-header": "flex items-center justify-between gap-$xs",
  "as-array-row-label": "font-600 text-body",
  "as-array-row-label-suffix": "text-current/60 text-callout font-mono ml-$xxs",

  // Calm grey badge; `scope-grey` keeps it from competing with the error badge.
  "as-array-items-chip":
    "scope-grey surface-500 inline-flex items-center gap-$xxs px-$xs h-[1.4em] rounded-r0 text-callout font-mono font-600 leading-none shrink-0",
  "as-array-items-chip-icon": "text-[1.1em] leading-none",

  "as-array-remove-btn": {
    "": "inline-grid place-items-center h-fingertip-s w-fingertip-s text-current/50 rounded-base cursor-pointer transition-colors duration-120 disabled-soft",
    "hover:not-disabled:": "scope-error bg-current-hl/10 text-current-hl",
  },
  "as-array-remove-btn-icon": "i-as-close text-[1.1em]",

  "as-array-clear-btn": {
    "": "inline-flex items-center h-[1.5em] px-$s border-1 layer-0 text-current/60 rounded-base cursor-pointer text-callout leading-none transition-all duration-120 disabled-soft",
    "hover:not-disabled:": "scope-error bg-current-hl/10 text-current-hl",
  },

  "as-array-add-row": "flex justify-start mt-$xs",
  "as-array-add-btn": {
    "": "inline-flex items-center gap-$xs h-fingertip-s px-$m border-1 border-dashed rounded-base bg-transparent text-current/60 cursor-pointer transition-all duration-120 disabled-soft",
    "hover:not-disabled:": "border-current-hl text-current-hl bg-current-hl/10",
  },

  "as-array-error": "scope-error text-callout text-current-hl",
});
