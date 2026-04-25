import { defineShortcuts } from "vunor/theme";

export const asNoDataShortcuts = defineShortcuts({
  "as-no-data": {
    "": "flex items-center justify-center gap-$s h-fingertip-l px-$m w-full border-1 border-dashed rounded-base bg-transparent text-current/60 text-callout cursor-pointer transition-all duration-140",
    "hover:": "border-current-hl text-current-hl bg-current-hl/10",
  },
  "as-no-data-text": "font-mono text-callout tracking-wide",
  "as-no-data-plus":
    "inline-grid place-items-center w-[1em] h-[1em] rounded-full border-1 border-current opacity-70 leading-none flex-shrink-0 [&>span]:text-callout",
});
