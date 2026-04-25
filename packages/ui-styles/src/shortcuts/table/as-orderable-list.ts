import { defineShortcuts } from "vunor/theme";
import { searchIcon, searchWrap, smallInputBase } from "./_shared";

export const asOrderableListShortcuts = defineShortcuts({
  "as-orderable-list-box":
    "flex flex-col flex-1 min-h-0 mx-$l my-$m border-1 rounded-r2 overflow-hidden",
  "as-orderable-list-toolbar":
    "layer-1 flex items-center gap-$s px-$m py-$s border-b-1 flex-shrink-0",
  "as-orderable-list-search-wrap": searchWrap,
  "as-orderable-list-search-icon": searchIcon,
  "as-orderable-list-search": {
    "": `${smallInputBase} pl-[2em]`,
    "focus:": "current-border-hl outline i8-apply-outline",
  },
  "as-orderable-list-toolbar-actions": "flex gap-$xs flex-shrink-0",
  "as-orderable-list-toolbar-btn": {
    "": "scope-neutral c8-chrome inline-flex items-center justify-center h-fingertip-s px-$m text-callout font-600 cursor-pointer leading-none whitespace-nowrap",
  },

  "as-orderable-list-items": "flex-1 overflow-y-auto flex flex-col",
  "as-orderable-list-item": {
    "": "relative cursor-pointer outline-none transition-colors duration-120 border-b-1 last:border-b-0",
    "hover:": "layer-1",
    "data-[highlighted]:": "layer-1",
  },
  "as-orderable-list-item-dragging": "opacity-25",
  "as-orderable-list-item-disabled": "pointer-events-none cursor-default",
  "as-orderable-list-item-content": "flex items-center gap-$s px-$s py-[0.15em] min-h-fingertip-s",
  "as-orderable-list-grip":
    "inline-grid place-items-center w-[0.8em] h-[0.8em] text-current/40 cursor-grab active:cursor-grabbing shrink-0 text-[1.25em] hover:text-current/70",
  "as-orderable-list-grip-disabled": "opacity-40 cursor-default pointer-events-none",
  "as-orderable-list-checkbox": {
    "": "scope-primary text-body w-[1.25em] h-[1.25em] border-1 border-scope-light-3 dark:border-scope-dark-3 rounded-[0.2em] flex items-center justify-center flex-shrink-0 cursor-pointer layer-0 transition-all duration-120",
    "group-data-[state=checked]:": "bg-current-hl border-current-hl text-white",
    "group-aria-selected:": "bg-current-hl border-current-hl text-white",
  },
  "as-orderable-list-checkbox-disabled": "opacity-50",
  "as-orderable-list-check-icon": "i-as-check w-[0.9em] h-[0.9em] text-white",
  "as-orderable-list-item-body": "flex items-center gap-$s flex-1 min-w-0",
  "as-orderable-list-item-label": "flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
  "as-orderable-list-item-actions": {
    "": "inline-flex items-center gap-[0.15em] p-[0.15em] border-1 rounded-r2 layer-0 flex-shrink-0 opacity-0 pointer-events-none transition-opacity duration-120 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto shadow-popup",
    "[&_button]:":
      "inline-grid place-items-center w-fingertip-xs h-fingertip-xs p-0 border-0 bg-transparent cursor-pointer text-current/60 leading-none rounded-base transition-colors duration-120 text-callout",
    "[&_button:hover:not(:disabled)]:": "bg-current-hl/10 text-current-hl",
    "[&_button:disabled]:": "opacity-35 cursor-not-allowed",
  },

  "as-orderable-list-drop-indicator":
    "absolute left-0 right-0 -top-px h-[2px] bg-current-hl pointer-events-none z-[1] before:content-[''] before:absolute before:left-0 before:-top-[0.15em] before:w-[6px] before:h-[6px] before:bg-current-hl before:rounded-full",
});
