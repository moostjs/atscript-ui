import { defineShortcuts } from "vunor/theme";

export const asDropdownShortcuts = defineShortcuts({
  "as-dropdown": "relative inline-block",
  "as-dropdown-anchor": "relative",
  "as-dropdown-trigger": {
    "": "inline-flex items-center gap-$xs h-[1.5em] px-$s border-1 bg-transparent text-callout text-current/60 rounded-base cursor-pointer leading-none transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  "as-dropdown-menu":
    "scope-primary layer-1 absolute top-full left-0 z-[50] min-w-[10em] mt-$xs py-$xs border-1 rounded-r2 shadow-popup",
  "as-dropdown-item": {
    "": "block w-full px-$m py-$xs border-0 bg-transparent text-current text-left cursor-pointer",
    "hover:": "layer-3 text-current-hl",
  },
  "as-dropdown-item--active": "bg-current-hl/10 text-current-hl font-500",

  "as-variant-trigger": {
    "": "inline-flex items-center justify-center w-[1.5em] h-[1.5em] p-0 border-1 rounded-base bg-transparent text-current/50 cursor-pointer flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
});
