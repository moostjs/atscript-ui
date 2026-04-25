import { defineShortcuts } from "vunor/theme";
import { menuItemIconHl } from "./_shared";

export const asColumnMenuShortcuts = defineShortcuts({
  "as-column-menu-content":
    "scope-primary layer-0 z-[200] whitespace-nowrap py-$xs border-1 rounded-r2 shadow-popup min-w-[14em]",
  "as-column-menu-label":
    "px-$m pt-$s pb-$xs text-callout font-mono font-600 tracking-[0.14em] uppercase text-current/50",
  "as-column-menu-item": {
    "": "flex items-center gap-$s w-full px-$m py-$xs border-0 bg-transparent text-current text-left cursor-pointer outline-none",
    "hover:": "layer-3",
    "data-[highlighted]:": "layer-3",
  },
  "as-column-menu-item-icon": "inline-flex text-[1.25em] text-current/60 shrink-0",
  "as-column-menu-item-label": "flex-1 min-w-0 overflow-hidden text-ellipsis",
  "as-column-menu-item-hint":
    "inline-flex items-center justify-center min-w-[1.5em] h-[1.5em] px-$xs rounded-r0 layer-2 text-callout font-mono font-600 text-current/70 leading-none shrink-0",
  "as-column-menu-item-badge":
    "inline-flex items-center justify-center min-w-[1.5em] h-[1.5em] px-$xs rounded-r0 bg-current-hl/10 text-current-hl text-callout font-mono font-600 leading-none shrink-0",
  "as-column-menu-item-active": `bg-current-hl/10 text-current-hl font-500 ${menuItemIconHl}`,
  "as-column-menu-item-danger": {
    "": `scope-error text-current-hl ${menuItemIconHl}`,
    "hover:": "bg-current-hl/10",
    "data-[highlighted]:": "bg-current-hl/10",
  },
  "as-column-menu-separator": "h-[1px] my-$xs bg-scope-light-2 dark:bg-scope-dark-2",
});
