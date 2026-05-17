import { defineShortcuts } from "vunor/theme";

// Banner that re-scopes its subtree based on `data-level` so consumers can
// drop a single class and get info / success / warn / error coloring.
export const asWfFinishMessageShortcuts = defineShortcuts({
  "as-wf-finish-message": {
    "": "surface-100 border-1 rounded-base px-$m py-$s text-body",
    '[&[data-level="info"]]:': "scope-primary",
    '[&[data-level="success"]]:': "scope-good",
    '[&[data-level="warn"]]:': "scope-warn",
    '[&[data-level="error"]]:': "scope-error",
  },
});
