import { defineShortcuts } from "vunor/theme";

/**
 * Adorned numeric inputs — `<AsAmount>` puts the currency symbol as a
 * leading text pill, `<AsMeasure>` puts the unit as a trailing text pill.
 *
 * The wrappers don't paint border / focus chrome themselves — the
 * surrounding `as-default-field [&_input]:` rules already cover it. Each
 * wrapper is just flex glue plus an adornment slot styled as muted
 * callout text.
 */
export const asAmountMeasureShortcuts = defineShortcuts({
  "as-amount-wrap": {
    "": "flex-1 flex items-center gap-$xs min-w-0",
    "[&>.as-amount-input]:": "flex-1 min-w-0",
  },
  "as-amount-prefix":
    "text-callout text-current/60 select-none whitespace-nowrap font-mono uppercase",

  "as-measure-wrap": {
    "": "flex-1 flex items-center gap-$xs min-w-0",
    "[&>.as-measure-input]:": "flex-1 min-w-0",
  },
  "as-measure-suffix": "text-callout text-current/60 select-none whitespace-nowrap font-mono",
});
