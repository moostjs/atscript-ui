import { defineShortcuts } from "vunor/theme";

export const asWfFinishCountdownShortcuts = defineShortcuts({
  // "Continuing in N…" countdown text. Renders BELOW the skip button as a
  // smaller, muted caption. `text-callout` (≈0.89em) is the next typography
  // step down from `text-body`, paired with `text-current-muted` for the
  // de-emphasized treatment. `text-center` centers the text under the
  // (centered) actions row inside the `flex-col items-stretch` host.
  "as-wf-finish-countdown": "text-callout text-current-muted text-center",
});
