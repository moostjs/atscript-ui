import { defineShortcuts } from "vunor/theme";
import { strongText } from "./_shared";

export const asFilterFieldShortcuts = defineShortcuts({
  "as-filter-field": {
    "": "scope-primary inline-flex items-stretch h-fingertip-m border-1 rounded-base layer-0 current-outline-hl min-w-[12em] max-w-[24em] flex-shrink-0 overflow-hidden",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus-within:": "current-border-hl outline i8-apply-outline",
    "aria-disabled:": "pointer-events-none cursor-wait",
  },
  "as-filter-field-loading":
    "flex items-center justify-center flex-1 min-w-0 h-full text-current-hl text-[1.25em] opacity-70",
  "as-filter-field-loading-icon": "i-as-loading",
  "as-filter-field-label": {
    "": "inline-flex items-center px-$s layer-2 text-current/80 text-callout font-500 border-r-1 whitespace-nowrap flex-shrink-0 cursor-pointer transition-colors duration-120",
    "[.as-filter-field:focus-within_&]:": "bg-current-hl/10 text-current-hl font-600",
  },
  "as-filter-field-body": "flex items-stretch flex-1 min-w-0",
  "as-filter-field-input": "flex items-stretch flex-1 min-w-0 h-full cursor-text",
  "as-filter-field-chips":
    "flex items-center gap-$xs min-w-0 h-full px-$xs flex-nowrap overflow-x-auto overflow-y-hidden select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  "as-filter-field-chip":
    "inline-flex items-center gap-[0.15em] h-[1.5em] px-[0.2em] pl-$xs bg-current-hl/10 border-1 border-current-hl/40 rounded-r0 text-callout text-current-hl whitespace-nowrap flex-shrink-0",
  "as-filter-field-chip-remove": {
    "": "cursor-pointer opacity-70 w-[14px] h-[14px] inline-grid place-items-center text-callout leading-none",
    "hover:": "opacity-100",
  },
  "as-filter-field-search": `border-0 outline-none flex-1 min-w-[64px] p-0 m-0 bg-transparent ${strongText} placeholder:text-current/50`,
  "as-filter-field-f4": {
    "": "inline-grid place-items-center w-fingertip-s border-0 border-l-1 bg-transparent text-current/70 cursor-pointer flex-shrink-0 transition-colors duration-120 text-[1.25em] leading-none",
    "hover:": "layer-2 text-current-hl",
    "[.as-filter-field:focus-within_&]:": "text-current-hl",
  },
  "as-filter-field-dropdown":
    "scope-primary layer-0 z-[200] border-1 rounded-r2 shadow-popup min-w-[20em] max-w-[36em] flex flex-col outline-none w-[max(var(--reka-popper-anchor-width,320px),320px)]",
  "as-filter-field-dropdown-body": "relative flex flex-col min-w-0 min-h-[12em]",
  "as-filter-field-dropdown-footer": {
    "": "flex gap-$s px-$s py-$xs border-t-1 justify-end",
    "[&_button]:":
      "px-$s py-$xs border-0 bg-transparent text-callout text-current-hl cursor-pointer",
    "[&_button:hover]:": "underline",
  },
});
