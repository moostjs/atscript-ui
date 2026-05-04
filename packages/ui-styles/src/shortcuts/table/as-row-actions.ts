import { defineShortcuts } from "vunor/theme";
import { buildActionsIntentVariants } from "./_shared";

/**
 * Per-row actions cell shortcuts. Renders inside a `<td>`. Always exactly
 * one button (icon, label-text, or `…` dropdown trigger). Intent maps to
 * vunor scope via {@link buildActionsIntentVariants} — see _shared.ts for
 * the dual-context (filled-button + menu-item) intent rules.
 */
export const asRowActionsShortcuts = defineShortcuts({
  // `<td>` cell: stays in normal table-cell flow so borders align with sibling
  // cells. `!p-0` is `!` so the inherited `[&_td]: px-$m py-$s` doesn't add
  // extra horizontal padding around the icon button.
  "as-row-actions": "!p-0 text-center",
  // Row-context buttons are ALWAYS `c8-flat` — transparent bg, no border,
  // calmest of the c8 variants. Three states differ only by which scope
  // colors c8-flat resolves against:
  //   - no intent + no default → `scope-neutral` (grey icon at rest)
  //   - `[data-default]` → `scope-primary` (brand-tinted icon)
  //   - intent class → `!scope-{intent}` (intent-tinted icon, beats primary)
  //
  // Sizing: `min-w-fingertip-s` (28px floor) + `h-fingertip-s` keeps
  // icon-only buttons square but lets label-only buttons grow horizontally
  // to fit text.
  "as-row-actions-btn": {
    "": "scope-neutral c8-flat inline-flex items-center justify-center min-w-fingertip-s h-fingertip-s px-$s font-600 cursor-pointer shrink-0 leading-none whitespace-nowrap",
    "[&[data-default]]:": "scope-primary font-500",
  },
  // Modifier applied by `<AsRowActions>` when the single row action has
  // only a label (no icon). Upgrades the button from flat to `c8-chrome`
  // for a more prominent appearance — fits the Customers "View orders"
  // pattern. Composed alongside the base class so intent variants still apply.
  "as-row-actions-btn-labelled": {
    "[&.as-row-actions-btn]:": "!c8-chrome !px-$m",
  },
  "as-row-actions-btn-icon": "text-[1.25em] shrink-0",
  "as-row-actions-btn-label": "text-callout",
  "as-row-actions-more": "",
  "as-row-actions-menu": "scope-primary popup-card whitespace-nowrap py-$xs min-w-[12em]",
  "as-row-actions-menu-separator": "h-0 my-$xs border-t-1",
  // Menu item base. Default-marked items get bold font so the primary CTA
  // is visually distinct in the dropdown list.
  "as-row-actions-menu-item": {
    "": "flex items-center gap-$s w-full px-$m py-$xs border-0 bg-transparent text-current text-left cursor-pointer outline-none",
    "hover:": "layer-3",
    "data-[highlighted]:": "layer-3",
    "[&[data-default]]:": "font-700",
  },
  "as-row-actions-menu-item-icon": "inline-flex text-[1.25em] text-current/60 shrink-0",
  "as-row-actions-menu-item-label": "flex-1 min-w-0 overflow-hidden text-ellipsis",
  ...buildActionsIntentVariants("as-row-actions"),
});
