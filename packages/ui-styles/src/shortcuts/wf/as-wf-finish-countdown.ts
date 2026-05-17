import { defineShortcuts } from "vunor/theme";

export const asWfFinishCountdownShortcuts = defineShortcuts({
  // "Continuing in N…" countdown text. The visual progress indication lives
  // on the skip button (`as-wf-finish-skip` via `c8-progress`), so this slot
  // is just muted body text — no stacked progress bar underneath.
  "as-wf-finish-countdown": "text-body text-current-muted",
});
