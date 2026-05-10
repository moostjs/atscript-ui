import { defineShortcuts } from "vunor/theme";

export const asCollapsibleShortcuts = defineShortcuts({
  // `pb-$m` and `border-b-1` are both suppressed when the next sibling is
  // another section: the grid `gap-$m` between cells already provides the
  // separating space, and the next section's `border-t-1` is the divider.
  // Stacking pb + gap + pt would over-pad the visual gap. Underscore in
  // `+_` is UnoCSS's space-escape inside arbitrary selectors.
  "as-collapsible-section":
    "border-t-1 first:border-t-0 pt-$m [&:not(:has(+_.as-collapsible-section))]:(pb-$m border-b-1) [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden",
  "as-collapsible-island":
    "border-1 rounded-r2 p-$m [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden",
  "as-collapsible-island-even": "layer-0",
  "as-collapsible-island-odd": "layer-1",

  "as-collapsible-summary": "flex items-center gap-$m text-left cursor-pointer group",
  "as-collapsible-header": "flex-1 flex flex-col gap-$xxs min-w-0",
  "as-collapsible-title-row": "flex items-center gap-$s min-w-0",
  "as-collapsible-title": "text-body-l font-600 m-0",
  "as-collapsible-title-nested": "text-body font-600 m-0",
  "as-collapsible-title-index": "text-current/60 font-400 font-mono normal-case",
  "as-collapsible-description": "as-description",

  "as-collapsible-chevron":
    "i-as-chevron-down w-[1.1em] h-[1.1em] shrink-0 text-current-muted group-hover:scope-primary group-hover:text-current-hl [transition:transform_150ms_ease]",
  "as-collapsible-chevron-collapsed": "rotate--90",

  "as-collapsible-body": "mt-$m as-form-grid",

  // `as-grid-item` claims the whole row so the message wraps naturally
  // instead of getting squeezed into a single grid column.
  "as-collapsible-error": "as-grid-item scope-error text-callout text-current-hl mb-$xs",

  "as-collapsible-error-badge":
    "scope-error surface-500 inline-flex items-center justify-center min-w-[1.4em] h-[1.4em] px-$xxs rounded-r0 text-callout font-mono font-600 leading-none shrink-0",
});
