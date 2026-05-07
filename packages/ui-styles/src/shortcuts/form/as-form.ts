import { defineShortcuts } from "vunor/theme";

export const asFormShortcuts = defineShortcuts({
  "as-form-title": "text-[1.54em] font-700 tracking-[-0.02em]",
  // `__form` (form-level) errors — rendered above submit by `<AsForm>`.
  "as-form-error":
    "scope-error layer-1 border-1 current-border-hl rounded-base px-$m py-$s mb-$s text-callout text-current-hl",
});
