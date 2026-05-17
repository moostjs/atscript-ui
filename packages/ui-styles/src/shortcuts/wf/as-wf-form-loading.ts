import { defineShortcuts } from "vunor/theme";

export const asWfFormLoadingShortcuts = defineShortcuts({
  // Wrapper for the initial-load state (before `formDef` exists). Provides
  // the positioning anchor + minimum height floor; visual treatment comes
  // from `as-form-overlay` (same overlay paints over the form on
  // subsequent round-trips) for visual consistency across both loading
  // states.
  "as-wf-form-loading": "relative min-h-[100px]",
});
