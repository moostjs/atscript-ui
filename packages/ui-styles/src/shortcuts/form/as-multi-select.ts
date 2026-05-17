import { defineShortcuts } from "vunor/theme";
import { inputBase } from "./_shared";

/**
 * Multi-select default renderer — combobox popup with chip-style selected
 * values inside the anchor. Mirrors `as-ref`'s reka-ui Combobox structure
 * (single popup, `data-[highlighted]` keyboard focus, `data-[state=checked]`
 * selection) with `:multiple="true"` so the value model is `T[]` and the
 * popup stays open across clicks.
 *
 * The anchor carries `inputBase` chrome (border, layer, height). The inner
 * `<input>` is a seamless leaf: the descendant rules in `as-default-field`
 * paint `inputBase` on every nested `<input>`, so the input itself must
 * neutralize that with `!important` resets (same pattern as the merged
 * AsDecimal/AsNumber shell).
 */
const innerInputReset =
  "!w-auto !bg-transparent !border-0 !outline-0 !ring-0 !shadow-none !h-auto !px-0 !layer-0";

export const asMultiSelectShortcuts = defineShortcuts({
  "as-multi-select-root": "block w-full",
  "as-multi-select-anchor": {
    "": `${inputBase} !h-auto min-h-fingertip-m flex flex-wrap items-center gap-$xs py-$xs cursor-text relative`,
    "focus-within:": "current-border-hl outline i8-apply-outline",
  },
  "as-multi-select-chip":
    "inline-flex items-center gap-$xs c8-chrome rounded-base pl-$s pr-$xs h-[1.5em] text-callout",
  "as-multi-select-chip-label": "leading-none",
  "as-multi-select-chip-remove": {
    "": "inline-flex items-center justify-center w-[1.25em] h-[1.25em] rounded-full p-0 border-0 bg-transparent text-current/60 cursor-pointer leading-none",
    "hover:not-disabled:": "scope-error text-current-hl bg-current-hl/10",
    "disabled:": "cursor-not-allowed opacity-40",
  },
  "as-multi-select-input": `${innerInputReset} flex-1 min-w-[4em] text-scope-dark-0 dark:text-scope-light-0`,
  "as-multi-select-clear": {
    "": "inline-flex items-center justify-center w-[1.4em] h-[1.4em] rounded-full p-0 border-0 bg-transparent text-current/50 cursor-pointer leading-none shrink-0",
    "hover:": "scope-error text-current-hl bg-current-hl/10",
  },
  "as-multi-select-caret": "text-current/50 text-[1.1em] pointer-events-none flex-shrink-0",
  "as-multi-select-content":
    "scope-primary popup-card layer-1 z-[50] w-[var(--reka-combobox-trigger-width)] flex flex-col",
  "as-multi-select-viewport": "max-h-[15em] overflow-y-auto py-$xs",
  "as-multi-select-footer": "flex items-center justify-end gap-$xs border-t-1 px-$s py-$xs",
  "as-multi-select-footer-action": {
    "": "c8-flat btn px-$s py-$xxs text-callout disabled-soft",
    "disabled:": "cursor-not-allowed",
  },
  "as-multi-select-item": {
    "": "flex items-center gap-$s px-$m py-$s cursor-pointer text-current",
    "data-[highlighted]:": "layer-3 outline-none",
    "data-[state=checked]:": "bg-current-hl/10 text-current-hl font-semibold",
  },
  "as-multi-select-item-label": "flex-1",
  "as-multi-select-empty": "flex items-center justify-center px-$m py-$m text-current/50",
});
