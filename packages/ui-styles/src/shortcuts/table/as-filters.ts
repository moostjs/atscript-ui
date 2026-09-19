import { defineShortcuts } from "vunor/theme";
import { popperCapped } from "./_shared";

/**
 * `<AsFilters>` — the inline filter-field row's overflow affordance.
 *
 * `<AsFilters>` renders a bare fragment of `<AsFilterField>`s plus the
 * overflow trigger, with no wrapper element of its own: hosts style the row
 * itself (`as-page-filters-row` is `flex … gap-$s flex-wrap`) and the fields
 * stay direct flex children of it.
 */
export const asFiltersShortcuts = defineShortcuts({
  // Neutral chrome, deliberately quieter than a filter field: it is a
  // disclosure, not a control. `relative` anchors the count badge.
  "as-filters-overflow-trigger": {
    "": "relative scope-neutral c8-chrome btn h-fingertip-s px-$s gap-$xxs shrink-0",
    "[&[data-state=open]]:": "scope-primary c8-light",
  },
  "as-filters-overflow-trigger-icon": "text-[1.25em] shrink-0",
  "as-filters-overflow-chevron": "text-[1em] text-current/60 shrink-0",

  // Count of ACTIVE filters hidden inside the popover. Mirrors
  // `as-collapsible-error-badge`'s geometry (the other "n things you can't see
  // right now" badge in the system) in the primary scope instead of error.
  "as-filters-overflow-badge":
    "scope-primary surface-500 inline-flex items-center justify-center min-w-[1.4em] h-[1.4em] px-$xxs rounded-r0 text-callout font-mono font-600 leading-none shrink-0",

  // Vertical stack — the popover is narrow, so the fields go one per row
  // rather than trying to reproduce the toolbar's wrapping flow.
  "as-filters-overflow": `scope-primary popup-card flex flex-col gap-$s p-$s min-w-[18em] max-w-[28em] outline-none ${popperCapped}`,
});
