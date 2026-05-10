import { defineShortcuts } from "vunor/theme";

export const asFormShortcuts = defineShortcuts({
  // Vertical rhythm for the form's top-level slots (header / before / fields
  // grid / after / error / submit / footer). The fields grid handles its own
  // children via grid `gap-$m`; this keeps the SAME `gap-$m` between the grid
  // and its sibling slots so the submit button doesn't sit flush against the
  // last field.
  // `relative` anchors the absolutely-positioned `as-form-overlay` (loading
  // state). Harmless on a flex column — overlay is the only absolute child.
  "as-form": "relative flex flex-col gap-$m",
  "as-form-title": "text-[1.54em] font-700 tracking-[-0.02em]",
  "as-form-description": "as-description",
  // `__form` (form-level) errors — rendered above submit by `<AsForm>`.
  // Dismissable banner: message text + labeled "Dismiss" button on the
  // right, vertically centered. `surface-100` (within `scope-error`)
  // bundles bg + text + border tone; `border-1` renders the line.
  "as-form-error":
    "scope-error surface-50 border-1 rounded-r2 px-$m py-$s mb-$s text-callout text-current-hl flex items-center gap-$s",
  "as-form-error-message": "flex-1 min-w-0",
  // Banner dismiss button — labeled, neutral outlined button so it doesn't
  // compete with the error message. `inline-flex` + no `flex-grow` so it
  // sizes to its "Dismiss" content; compact `h-fingertip-s` to fit the row.
  "as-form-error-dismiss":
    "c8-light inline-flex items-center h-fingertip-s px-$s rounded-r1 cursor-pointer text-callout font-600",
  // In-flight server round-trip overlay. Extends `as-overlay` so the
  // visual stays in lockstep with `as-table-query-overlay`.
  "as-form-overlay": "as-overlay",
  "as-form-overlay-icon": "as-overlay-icon",
});
