import { defineShortcuts } from "vunor/theme";

export const asConfigTabShortcuts = defineShortcuts({
  "as-config-tabs-list": "flex gap-0 flex-shrink-0 border-b-1 px-$l",
  "as-config-tab-trigger": {
    "": "scope-primary relative inline-flex items-center gap-$s px-$m py-$s border-0 border-b-2 border-b-transparent bg-transparent font-500 text-current/60 cursor-pointer whitespace-nowrap outline-none transition-all duration-120",
    "hover:": "text-current",
    "data-[state=active]:": "text-current [border-bottom-color:rgb(var(--current-hl))] font-600",
  },
  "as-config-tab-icon": "inline-block w-[1em] h-[1em] text-[1.25em] shrink-0",

  "as-config-tab-summary": "flex flex-col gap-[0.15em] px-$l py-$s border-t-1 flex-shrink-0",
  "as-config-tab-summary-count": "text-callout text-current font-500",
  "as-config-tab-summary-count-num": "font-600",
  "as-config-tab-summary-hint": "text-callout text-current/60",

  "as-config-tab-content": "flex flex-col flex-1 min-h-0 data-[state=inactive]:hidden",

  "as-config-tab-count": {
    "": "inline-flex items-center justify-center min-w-[18px] h-[18px] px-$xs rounded-full layer-2 text-callout text-current/70 font-500 leading-none",
  },
  "as-config-tab-count-active": "bg-current-hl/10 text-current-hl",

  "as-config-field-count": {
    "": "scope-primary inline-flex items-center justify-center min-w-[18px] h-[18px] px-$xs rounded-full bg-current-hl/10 text-current-hl text-callout font-500 leading-none flex-shrink-0",
  },
  "as-config-field-label-wrap": "flex items-center gap-$xs flex-1 min-w-0",
  "as-config-field-label-text": "overflow-hidden text-ellipsis whitespace-nowrap min-w-0",
});
