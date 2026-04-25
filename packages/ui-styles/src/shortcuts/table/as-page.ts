import { defineShortcuts } from "vunor/theme";
import { searchIcon, strongText } from "./_shared";

export const asPageShortcuts = defineShortcuts({
  "as-page-header": "flex items-start justify-between gap-$m px-$l pt-$l pb-$m",
  "as-page-header-titles": "flex flex-col gap-[0.15em] min-w-0",
  "as-page-header-eyebrow":
    "font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/70 mb-$xs",
  "as-page-header-title": `m-0 text-[1.54em] font-600 tracking-[-0.02em] ${strongText}`,
  "as-page-header-sub": "text-callout text-current/70 mt-[0.15em]",
  "as-page-header-actions": "flex items-center gap-$xs flex-shrink-0",
  "as-page-toolbar-btn": {
    "": "inline-flex items-center gap-$xs h-fingertip-m px-$m border-1 rounded-base layer-0 text-callout font-500 text-current cursor-pointer leading-none transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  "as-page-toolbar":
    "grid grid-cols-[minmax(240px,1fr)_auto] items-center gap-x-$m gap-y-$s px-$l pb-$m min-w-0",
  "as-page-search": "relative min-w-0 col-start-1",
  "as-page-search-icon": searchIcon,
  "as-page-search-input": {
    "": `scope-primary w-full h-fingertip-m pl-[2em] pr-$s border-1 layer-0 rounded-base ${strongText} outline-none current-outline-hl placeholder:text-current/50`,
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus:": "current-border-hl outline i8-apply-outline",
  },
  "as-page-toolbar-right": "flex items-center gap-$s flex-shrink-0 col-start-2",
  "as-page-pill":
    "inline-flex items-center gap-$xs px-$s py-$xs rounded-r0 layer-2 text-current/70 text-callout font-mono whitespace-nowrap",
  "as-page-pill-strong": "text-current font-600",
  "as-page-filters": "flex items-center gap-$s min-w-0 flex-wrap col-span-2",
  "as-page-clear": {
    "": "inline-flex items-center gap-$xs h-fingertip-m px-$s border-0 bg-transparent text-current/70 text-callout cursor-pointer ml-auto transition-colors duration-120",
    "hover:": "text-current-hl",
  },
});
