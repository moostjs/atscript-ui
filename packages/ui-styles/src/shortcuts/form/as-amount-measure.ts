import { defineShortcuts } from "vunor/theme";
import { inputBase } from "./_shared";

/**
 * Amount + measure default renderers — the "bank UX" shell. Both share the
 * same merged-chrome family: ONE bordered container that paints the
 * border, focus ring, hover, and error state. The inputs inside are
 * seamless leaves with no chrome of their own.
 *
 * Inner inputs must override the descendant rules in `as-default-field`
 * (which paint `inputBase` chrome on every nested `<input>`). The `[&_input]`
 * selectors below carry equal specificity to `as-default-field`'s rules,
 * but `asAmountMeasureShortcuts` is merged AFTER `asFieldShortcuts` in
 * `form/index.ts` so order wins.
 *
 * AsAmount layout: `[ $ | integer | . | decimal ]` — two inputs joined by
 * a separator pill, plus a leading currency-symbol pill.
 *
 * AsMeasure layout: `[ value | unit ]` — single input with a trailing
 * unit pill.
 */
const innerInputReset =
  "bg-transparent border-0 outline-0 ring-0 h-full px-$xxs font-mono text-scope-dark-0 dark:text-scope-light-0";

const shellBase = `flex-1 inline-flex items-center gap-$xs ${inputBase} px-$xs py-0`;

export const asAmountMeasureShortcuts = defineShortcuts({
  // ── AsAmount shell ────────────────────────────────────────
  "as-amount": {
    "": shellBase,
    "hover:": "border-current/30",
    "focus-within:": "current-border-hl outline i8-apply-outline",
    // Inner inputs lose chrome. Layer/hover/focus stays on the SHELL.
    "[&_input]:": `${innerInputReset} layer-0`,
    "[&_input:hover]:": "border-0",
    "[&_input:focus]:": "border-0 outline-0",
    "[&_input:disabled]:": "text-current/40 cursor-not-allowed",
    "[&.error]:": "scope-error current-border-hl border-current",
    "[&.error]:focus-within:":
      "scope-error current-border-hl border-current outline i8-apply-outline",
    "[&.as-amount-negative_.as-amount-symbol]:": "text-current-hl",
  },
  "as-amount-symbol":
    "text-callout text-current/60 select-none whitespace-nowrap font-mono uppercase",
  "as-amount-integer": "flex-1 min-w-0 text-right",
  "as-amount-sep": "text-callout text-current/60 select-none font-mono",
  "as-amount-decimal": "min-w-0 text-left",

  // ── AsMeasure shell ───────────────────────────────────────
  "as-measure": {
    "": shellBase,
    "hover:": "border-current/30",
    "focus-within:": "current-border-hl outline i8-apply-outline",
    "[&_input]:": `${innerInputReset} layer-0`,
    "[&_input:hover]:": "border-0",
    "[&_input:focus]:": "border-0 outline-0",
    "[&_input:disabled]:": "text-current/40 cursor-not-allowed",
    "[&.error]:": "scope-error current-border-hl border-current",
    "[&.error]:focus-within:":
      "scope-error current-border-hl border-current outline i8-apply-outline",
  },
  "as-measure-input": "flex-1 min-w-0",
  "as-measure-unit":
    "text-callout text-current/60 select-none whitespace-nowrap font-mono",
});
