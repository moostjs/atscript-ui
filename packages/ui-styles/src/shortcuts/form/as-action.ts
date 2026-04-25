import { defineShortcuts } from "vunor/theme";

export const asActionShortcuts = defineShortcuts({
  "as-action-field": {
    "[&>button]:": "as-submit-btn",
  },
  "as-submit-btn": {
    "": "scope-primary c8-filled inline-flex items-center justify-center gap-$xs h-fingertip-m px-$m font-500 cursor-pointer mt-$m",
    "disabled:": "opacity-60 cursor-not-allowed",
  },
});
