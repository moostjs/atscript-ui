import { defineShortcuts } from "vunor/theme";
import { inputBase } from "./_shared";

export const asRefShortcuts = defineShortcuts({
  "as-ref-root": "block w-full",
  "as-ref-anchor": "flex items-center relative [&>input]:flex-1",
  "as-ref-input": inputBase,
  "as-ref-clear": {
    "": "absolute right-$s top-1/2 -translate-y-1/2 p-0 border-0 bg-transparent text-current/50 cursor-pointer leading-none",
    "hover:": "scope-error text-current-hl",
  },
  "as-ref-loading":
    "flex items-center justify-center h-fingertip-m w-full box-border border-1 layer-0 rounded-base",
  "as-ref-spinner": "i-as-loading text-current-hl text-[1.25em] opacity-70",
  "as-ref-content":
    "scope-primary layer-1 z-[50] border-1 rounded-r2 shadow-popup w-[var(--reka-combobox-trigger-width)] overflow-hidden",
  "as-ref-viewport": "max-h-[15em] overflow-y-auto py-$xs",
  "as-ref-item": {
    "": "flex items-baseline gap-$m px-$m py-$s cursor-pointer",
    "data-[highlighted]:": "layer-3",
    "data-[state=checked]:": "bg-current-hl/10 text-current-hl",
  },
  "as-ref-item-id": "font-mono text-callout text-current/50 flex-shrink-0 min-w-[2em] text-right",
  "as-ref-item-label": "text-current flex-1",
  "as-ref-item-descr": "text-callout text-current/60",
  "as-ref-status": "flex items-center justify-center px-$m py-$m text-current/50",
});
