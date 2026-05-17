import { defineShortcuts } from "vunor/theme";

// Skip / cancel button on auto-redirect countdown. Lower priority than option.
export const asWfFinishSkipShortcuts = defineShortcuts({
  "as-wf-finish-skip": "c8-flat btn h-fingertip-s px-$s text-callout cursor-pointer",
});
