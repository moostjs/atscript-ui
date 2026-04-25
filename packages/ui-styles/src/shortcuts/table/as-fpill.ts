import { defineShortcuts } from "vunor/theme";
import { strongText } from "./_shared";

export const asFpillShortcuts = defineShortcuts({
  "as-fpill": {
    "": "scope-primary inline-flex items-stretch h-fingertip-m border-1 rounded-base layer-0 current-outline-hl flex-shrink-0 max-w-[24em] min-w-0 overflow-hidden",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus-within:": "current-border-hl outline i8-apply-outline",
  },
  "as-fpill-active": "border-current-hl",
  "as-fpill-label":
    "inline-flex items-center px-$s layer-2 text-current/80 text-callout font-500 border-r-1 whitespace-nowrap flex-shrink-0",
  "as-fpill-label-active": "bg-current-hl/10 text-current-hl",
  "as-fpill-body": "flex items-stretch flex-1 min-w-[8em] cursor-text",
  "as-fpill-chips":
    "flex items-center gap-$xs px-$xs min-w-0 h-full flex-nowrap overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  "as-fpill-input": `flex-1 min-w-[64px] border-0 bg-transparent outline-none ${strongText} p-0 h-full placeholder:text-current/50`,
  "as-fpill-chip":
    "inline-flex items-center gap-[0.15em] h-[1.5em] px-[0.2em] pl-$xs bg-current-hl/10 border-1 border-current-hl/40 rounded-r0 text-callout text-current-hl whitespace-nowrap flex-shrink-0",
  "as-fpill-chip-remove": {
    "": "cursor-pointer opacity-70 w-[14px] h-[14px] inline-flex items-center justify-center border-0 bg-transparent text-inherit",
    "hover:": "opacity-100",
  },
  "as-fpill-vh": {
    "": "inline-grid place-items-center w-fingertip-s border-0 border-l-1 bg-transparent text-current/60 cursor-pointer flex-shrink-0 transition-colors duration-120",
    "hover:": "layer-2 text-current-hl",
  },
});
