import { defineShortcuts } from "vunor/theme";

export const asNoDataShortcuts = defineShortcuts({
  "as-no-data": {
    "": "flex items-center justify-center gap-$s h-fingertip-m px-$m w-full border-1 border-dashed rounded-base bg-transparent text-current/60 text-callout cursor-pointer transition-all duration-140",
    "hover:": "border-current-hl text-current-hl bg-current-hl/10",
  },
  "as-no-data-textarea": {
    "": "flex items-center justify-center gap-$s min-h-[5rem] py-$s px-$m w-full border-1 border-dashed rounded-base bg-transparent text-current/60 text-callout cursor-pointer transition-all duration-140",
    "hover:": "border-current-hl text-current-hl bg-current-hl/10",
  },
  "as-no-data-text": "font-mono text-callout tracking-wide min-w-[8em]",
  "as-no-data-icon":
    "inline-flex items-center justify-center leading-none flex-shrink-0 [&>span]:text-[1.4em]",
});
