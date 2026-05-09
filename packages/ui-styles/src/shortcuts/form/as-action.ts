import { defineShortcuts } from "vunor/theme";

export const asActionShortcuts = defineShortcuts({
  "as-action-field": {
    "[&>button]:": "as-submit-btn",
  },
  // `self-end` right-aligns the submit when the parent `as-form` is
  // flex-col. `mt-$m` is no longer needed — `as-form` provides `gap-$m`.
  "as-submit-btn": "scope-primary c8-filled btn self-end",
});
