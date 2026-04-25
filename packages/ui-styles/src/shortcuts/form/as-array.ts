import { defineShortcuts } from "vunor/theme";

export const asArrayShortcuts = defineShortcuts({
  "as-array": "flex flex-col gap-0 my-$m",
  "as-array--root": "",
  "as-array--nested":
    "relative pl-$m pt-$m pb-$xs mt-$s mb-$l border-0 border-l-2 border-l-current/20 hover:border-l-current/40",
  "as-array-error": "scope-error text-callout text-current-hl mt-$xs",
  "as-array-add": "mt-$xs",
  "as-array-add-btn": {
    "": "inline-flex items-center gap-$xs h-fingertip-m px-$m border-1 border-dashed rounded-base bg-transparent text-current/60 cursor-pointer transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl bg-current-hl/10",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
});
