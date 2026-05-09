import { defineShortcuts } from "vunor/theme";

export const asFormShortcuts = defineShortcuts({
  // Vertical rhythm for the form's top-level slots (header / before / fields
  // grid / after / error / submit / footer). The fields grid handles its own
  // children via grid `gap-$m`; this keeps the SAME `gap-$m` between the grid
  // and its sibling slots so the submit button doesn't sit flush against the
  // last field.
  "as-form": "flex flex-col gap-$m",
  "as-form-title": "text-[1.54em] font-700 tracking-[-0.02em]",
  // `__form` (form-level) errors — rendered above submit by `<AsForm>`.
  "as-form-error":
    "scope-error layer-1 border-1 current-border-hl rounded-base px-$m py-$s mb-$s text-callout text-current-hl",
});
