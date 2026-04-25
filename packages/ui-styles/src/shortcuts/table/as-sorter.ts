import { defineShortcuts } from "vunor/theme";

export const asSorterShortcuts = defineShortcuts({
  "as-sorter-label": "flex items-center gap-$s flex-1 min-w-0",
  "as-sorter-index":
    "inline-grid place-items-center w-[1.5em] h-[1.5em] rounded-r0 layer-2 text-callout text-current/70 font-mono font-500 flex-shrink-0",
  "as-sorter-segment": {
    "": "inline-flex items-stretch gap-0 p-[0.15em] border-1 rounded-base layer-0 flex-shrink-0",
  },
  "as-sorter-segment-btn": {
    "": "inline-flex items-center gap-$xs h-fingertip-xs px-$s border-0 bg-transparent text-callout text-current/60 font-500 leading-none cursor-pointer rounded-base transition-colors duration-120",
    "hover:not-disabled:": "text-current",
  },
  "as-sorter-segment-btn-active": "layer-2 text-current",
  "as-sorter-direction-disabled": "opacity-50 cursor-not-allowed",
  "as-sorter-lock": "text-callout opacity-50 flex-shrink-0",
});
