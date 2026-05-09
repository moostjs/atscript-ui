import { defineShortcuts } from "vunor/theme";

export const asObjectShortcuts = defineShortcuts({
  // `pb-$m` and `border-b-1` are both suppressed when the next sibling is
  // another section: the grid `gap-$m` between cells already provides the
  // separating space, and the next section's `border-t-1` is the divider.
  // Stacking pb + gap + pt would over-pad the visual gap. Underscore in
  // `+_` is UnoCSS's space-escape inside arbitrary selectors.
  "as-object-section":
    "border-t-1 first:border-t-0 pt-$m [&:not(:has(+_.as-object-section))]:(pb-$m border-b-1) [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden",
  "as-object-island":
    "border-1 rounded-r2 p-$m [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden",
  "as-object-island-even": "layer-0",
  "as-object-island-odd": "layer-1",

  "as-object-summary": "flex items-center gap-$m text-left cursor-pointer group",
  "as-object-header": "flex-1 flex flex-col gap-$xxs min-w-0",
  "as-object-title": "text-body-l font-600 m-0",
  "as-object-title-nested": "text-body font-600 m-0",
  "as-object-description": "text-callout text-current/60 m-0",

  "as-object-chevron":
    "i-as-chevron-down w-[1.1em] h-[1.1em] shrink-0 text-current-muted group-hover:scope-primary group-hover:text-current-hl [transition:transform_150ms_ease]",
  "as-object-chevron-collapsed": "rotate--90",

  "as-object-body": "mt-$m as-form-grid",

  "as-object-error": "scope-error text-callout text-current-hl mb-$xs",

  "as-object-error-badge":
    "scope-error surface-500 inline-flex items-center justify-center min-w-[1.4em] h-[1.4em] px-$xxs rounded-r0 text-callout font-mono font-600 leading-none shrink-0",

  "as-object-empty":
    "layer-0 border-1 border-dashed rounded-r2 p-$m flex flex-col items-start gap-$s",
  "as-object-empty-add":
    "c8-chrome inline-flex items-center gap-$xs h-fingertip-s px-$m rounded-base font-600 text-callout shrink-0",
  "as-object-empty-add-icon": "text-[1.2em] leading-none",
});
