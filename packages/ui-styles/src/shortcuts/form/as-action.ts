import { defineShortcuts } from "vunor/theme";

export const asActionShortcuts = defineShortcuts({
  "as-action-field": {
    "[&>button]:": "as-submit-btn",
  },
  "as-submit-btn": "scope-primary c8-filled btn mt-$m",
});
