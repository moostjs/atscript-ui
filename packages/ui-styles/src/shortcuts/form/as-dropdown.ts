import { defineShortcuts } from "vunor/theme";

export const asDropdownShortcuts = defineShortcuts({
  "as-dropdown": "relative inline-flex items-center",
  "as-dropdown-anchor": "relative",
  "as-dropdown-trigger": {
    "": "inline-flex items-center gap-$xs h-[1.5em] px-$s border-1 bg-transparent text-callout text-current/60 rounded-base cursor-pointer leading-none transition-all duration-120 disabled-soft",
    "hover:not-disabled:": "border-current-hl text-current-hl",
  },
  "as-dropdown-menu":
    "scope-primary popup-card layer-1 absolute top-full left-0 z-[50] min-w-[10em] mt-$xs py-$xs",
  "as-dropdown-item": {
    "": "block w-full px-$m py-$xs border-0 bg-transparent text-current text-left cursor-pointer",
    "hover:": "layer-3 text-current-hl",
  },
  "as-dropdown-item--active": "bg-current-hl/10 text-current-hl font-500",

  "as-variant-trigger": {
    "": "inline-flex items-center h-[1.5em] px-$s text-callout font-mono leading-none border-1 layer-0 text-current/60 rounded-base cursor-pointer transition-all duration-120 disabled-soft flex-shrink-0",
    "hover:not-disabled:": "scope-primary bg-current-hl/10 text-current-hl",
    // Hide the picker when its host collapsible is closed — variant is only
    // switchable while the body is expanded. Array/leaf-context triggers
    // (no `<details>` ancestor) are unaffected.
    "[details:not([open])_&]:": "hidden",
  },
});
