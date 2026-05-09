import { defineShortcuts } from "vunor/theme";

export const asActionShortcuts = defineShortcuts({
  "as-action-field": {
    "[&>button]:": "as-submit-btn",
  },
  // `self-end` right-aligns the submit on the cross axis of `as-form`'s flex-col.
  "as-submit-btn": "scope-primary c8-filled btn self-end",
});
