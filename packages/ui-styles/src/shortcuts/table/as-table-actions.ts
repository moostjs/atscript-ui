import { defineShortcuts } from "vunor/theme";
import { buildActionMenuItemShortcuts, buildActionsIntentVariants } from "./_shared";

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
  // with the primary action. `decoration-none`: navigate actions render as
  // real `<a href>` with this same class — kill the UA underline (no-op on
  // buttons); `c8-filled` already sets text color, beating UA link/visited.
  //
  // Disabled-with-reason (`aria-disabled="true"`, kept focusable so the reason
  // stays reachable): `disabled-soft` dims it; the c8 hover / press gate
  // already skips `aria-disabled`.
  "as-table-actions-btn": "scope-primary c8-filled btn shrink-0 decoration-none disabled-soft",
  "as-table-actions-btn-icon": "text-[1.25em] shrink-0",
  "as-table-actions-btn-label": "text-body",
  "as-table-actions-more": "scope-neutral c8-chrome btn btn-square font-600 shrink-0",
  "as-table-actions-menu": "scope-primary popup-card whitespace-nowrap py-$xs min-w-[14em]",
  ...buildActionMenuItemShortcuts("as-table-actions"),
  ...buildActionsIntentVariants("as-table-actions"),
});
