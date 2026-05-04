import { defineShortcuts } from "vunor/theme";
import { buildActionsIntentVariants } from "./_shared";

/**
 * `<AsTableActions>` Tier-1 toolbar bar shortcuts. Renders a single default
 * button + a `…` more-menu. Intent maps to vunor scope via
 * {@link buildActionsIntentVariants} — see _shared.ts for the dual-context
 * (filled-button + menu-item) intent rules.
 */
export const asTableActionsShortcuts = defineShortcuts({
  "as-table-actions": "inline-flex items-center gap-$xs",
  // Mirrors the dialog Apply/Cancel pair (`as-filter-btn-apply` /
  // `as-filter-btn`). Default CTA → `scope-primary c8-filled`; the `…`
  // trigger stays neutral (`scope-neutral c8-chrome`) so it doesn't compete
  // with the primary action.
  "as-table-actions-btn": "scope-primary c8-filled btn shrink-0",
  "as-table-actions-btn-icon": "text-[1.25em] shrink-0",
  "as-table-actions-btn-label": "text-body",
  "as-table-actions-more": "scope-neutral c8-chrome btn btn-square font-600 shrink-0",
  "as-table-actions-menu": "scope-primary popup-card whitespace-nowrap py-$xs min-w-[14em]",
  // Menu item base. Default-marked items get bold font so the primary CTA
  // is visually distinct in the dropdown list (e.g. when the `…` menu shows
  // both default + non-default rows-level actions).
  "as-table-actions-menu-item": {
    "": "flex items-center gap-$s w-full px-$m py-$xs border-0 bg-transparent text-current text-left cursor-pointer outline-none",
    "hover:": "layer-3",
    "data-[highlighted]:": "layer-3",
    "[&[data-default]]:": "font-700",
  },
  "as-table-actions-menu-item-icon": "inline-flex text-[1.25em] text-current/60 shrink-0",
  "as-table-actions-menu-item-label": "flex-1 min-w-0 overflow-hidden text-ellipsis",
  "as-table-actions-menu-separator": "h-0 my-$xs border-t-1",
  ...buildActionsIntentVariants("as-table-actions"),
});
