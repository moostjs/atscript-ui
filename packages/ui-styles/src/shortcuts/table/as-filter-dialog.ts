import { defineShortcuts } from "vunor/theme";
import {
  chipBase,
  dialogBase,
  dialogOverlay,
  searchIcon,
  searchWrap,
  smallInputBase,
  strongText,
} from "./_shared";

export const asFilterDialogShortcuts = defineShortcuts({
  "as-filter-dialog-overlay": dialogOverlay,
  // Desktop: fixed height (clamp keeps it readable on 720p and bounded on
  // 4K) so switching tabs or applying chips doesn't resize the popup.
  // Mobile: inherits full-screen from `dialogBase`.
  "as-filter-dialog-content": `${dialogBase} sm:w-[560px] sm:max-w-[92vw] sm:h-[clamp(500px,70vh,600px)]`,
  "as-filter-dialog-has-value-help": "sm:w-[640px]",
  "as-filter-dialog-header": "flex items-center justify-between gap-$m px-$l py-$m border-b-1",
  "as-filter-dialog-title": "m-0 text-body-l font-600 tracking-[-0.01em] flex items-center gap-$s",
  "as-filter-dialog-title-label": "text-current/60 font-500",
  "as-filter-dialog-title-value": "text-current font-600",
  "as-filter-dialog-close": {
    "": "inline-grid place-items-center w-fingertip-s h-fingertip-s p-0 border-0 bg-transparent text-current/80 cursor-pointer leading-none rounded-base transition-colors duration-120 text-[1.25em]",
    "hover:": "layer-2 text-current",
  },
  "as-filter-dialog-body": "px-$l py-$m overflow-y-auto flex-1 flex flex-col gap-$m",
  "as-filter-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-filter-dialog-tab-content":
    "flex flex-col flex-1 min-h-0 overflow-hidden data-[state=inactive]:hidden",
  "as-filter-dialog-tab-conditions": "px-$l py-$m overflow-y-auto flex-col gap-$m",

  "as-filter-dialog-chips-bar":
    "layer-1 flex flex-col gap-$s px-$l py-$m border-t-1 flex-shrink-0 max-h-[10em] overflow-y-auto",
  "as-filter-dialog-chips-header": "flex items-center justify-between text-callout text-current/60",
  "as-filter-dialog-chips-count": "text-current font-600",
  "as-filter-dialog-clear-all": {
    "": "border-0 bg-transparent text-callout font-500 text-current/70 cursor-pointer p-0 whitespace-nowrap",
    "hover:": "underline text-current",
  },
  "as-filter-dialog-chips": "flex flex-wrap gap-$xs",
  "as-filter-dialog-chip": `${chipBase} gap-$xs bg-current-hl/10 border-1 border-current-hl/40 text-current-hl`,
  "as-filter-dialog-chips-more": `${chipBase} text-current/70 font-500 italic`,
  "as-filter-dialog-chip-remove": {
    "": "inline-grid place-items-center w-[18px] h-[18px] cursor-pointer opacity-70 leading-none border-0 bg-transparent text-inherit text-body",
    "hover:": "opacity-100",
  },

  "as-filter-value-help":
    "flex flex-col flex-1 min-h-0 mx-$l my-$m border-1 rounded-r2 overflow-hidden",
  "as-filter-value-help-toolbar":
    "layer-1 flex items-center gap-$s px-$m py-$s border-b-1 flex-shrink-0",
  "as-filter-value-help-filters":
    "layer-1 flex items-center flex-wrap gap-$xs px-$m py-$s border-b-1 flex-shrink-0 empty:hidden",
  "as-filter-value-help-search-wrap": searchWrap,
  "as-filter-value-help-search-icon": searchIcon,
  "as-filter-value-help-search": {
    "": `${smallInputBase} pl-[2em]`,
    "focus:": "current-border-hl outline i8-apply-outline",
  },
  "as-filter-value-help-count":
    "inline-flex items-center gap-$s ml-auto text-callout text-current/50 whitespace-nowrap flex-shrink-0",
  "as-filter-value-help-filters-toggle": {
    "": "inline-grid place-items-center w-fingertip-s h-fingertip-s border-1 rounded-base layer-0 text-current/70 cursor-pointer leading-none transition-colors duration-120",
    "hover:": "layer-2 text-current",
  },
  "as-filter-value-help-filters-toggle-active":
    "bg-current-hl/10 border-current-hl text-current-hl",
  "as-filter-value-help-table": "flex flex-col flex-1 min-h-0 overflow-hidden",

  "as-filter-condition-row": "grid grid-cols-[150px_1fr_28px] gap-$s items-center",
  "as-filter-condition-select": {
    "": `scope-primary h-fingertip-m px-$s pr-[1.75em] border-1 layer-0 rounded-base min-w-0 outline-none current-outline-hl ${strongText} cursor-pointer appearance-none`,
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus:": "current-border-hl outline i8-apply-outline",
  },
  "as-filter-condition-remove": {
    "": "inline-grid place-items-center w-fingertip-xs h-fingertip-xs border-0 bg-transparent text-current/70 cursor-pointer rounded-base leading-none flex-shrink-0 transition-colors duration-120 text-[1em]",
    "hover:": "scope-error layer-2 text-current-hl",
  },
  "as-filter-add-condition": {
    "": "py-$xs px-0 border-0 bg-transparent text-current-hl cursor-pointer text-left",
    "hover:": "underline",
  },

  "as-filter-input": {
    "": `scope-primary flex-1 h-fingertip-m px-$s border-1 layer-0 rounded-base min-w-0 outline-none current-outline-hl ${strongText} placeholder:text-current/50`,
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus:": "current-border-hl outline i8-apply-outline",
  },
  "as-filter-input-disabled": "flex-1 h-fingertip-m layer-1 rounded-base border-1 min-w-0",
  "as-filter-select": "cursor-pointer",
  "as-filter-input-range": "flex items-center gap-$xs flex-1",
  "as-filter-input-range-sep": "text-current/50 flex-shrink-0",

  "as-filter-shortcuts": "flex flex-wrap items-center gap-$xs pt-$xs border-t-1",
  "as-filter-shortcuts-label": "text-callout text-current/50 flex-shrink-0",
  "as-filter-shortcut-btn": {
    "": "px-$s py-[0.15em] border-1 rounded-base layer-2 text-callout text-current/70 cursor-pointer whitespace-nowrap transition-all duration-120",
    "hover:": "border-current-hl text-current-hl bg-current-hl/10",
  },

  "as-filter-dialog-footer": "flex items-center gap-$s px-$l py-$m border-t-1",
  "as-filter-dialog-footer-right": "flex gap-$s ml-auto",
  "as-filter-btn":
    "scope-neutral c8-chrome inline-flex items-center justify-center h-fingertip-m px-$m font-600 cursor-pointer",
  "as-filter-btn-apply":
    "scope-primary c8-filled inline-flex items-center justify-center h-fingertip-m px-$m font-500 cursor-pointer",
  "as-filter-btn-clear": {
    "": "scope-error inline-flex items-center h-fingertip-m px-$s border-0 bg-transparent text-callout font-500 text-current-hl cursor-pointer",
    "hover:": "underline",
  },
  "as-filter-btn-ghost": {
    "": "inline-flex items-center h-fingertip-m px-$s border-0 bg-transparent text-callout text-current/70 font-500 cursor-pointer rounded-base transition-colors duration-120",
    "hover:": "layer-2 text-current",
  },
});
