import { defineShortcuts } from "vunor/theme";

// Filled primary CTA on auto-redirect countdown. The progress fill darkens
// the button background L→R from 0% to 100% over the auto-fire duration —
// visually communicates "I'll fire on my own when the bar reaches the end,
// but you can also click me now". `scope-primary` promotes this to the
// page's brand accent regardless of the surrounding scope.
//
// The fill is rendered by a `<span class="as-wf-finish-skip-fill" />` child
// (aliases `c8-progress-fill`) and the label by an
// `<span class="as-wf-finish-skip-label">` (aliases `c8-progress-label`).
// `as-*` aliases keep the prebuilt `dist/css/wf.css` safelist self-contained
// — the bare `c8-progress-fill` class would be filtered out by the component
// class extractor since it's not `as-*` / `i-as-*` prefixed.
export const asWfFinishSkipShortcuts = defineShortcuts({
  "as-wf-finish-skip": "c8-filled scope-primary c8-progress btn h-fingertip-m px-$m cursor-pointer",
  "as-wf-finish-skip-fill": "c8-progress-fill",
  "as-wf-finish-skip-label": "c8-progress-label",
});
