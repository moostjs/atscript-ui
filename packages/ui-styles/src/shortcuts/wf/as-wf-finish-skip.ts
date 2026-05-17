import { defineShortcuts } from "vunor/theme";

// Skip / cancel button on auto-redirect countdown. Composes `c8-progress`
// on top of the `c8-flat` base so the button background fills L→R from 0%
// to 100% over the auto-fire duration — visually communicates "I'll fire on
// my own when the bar reaches the end, but you can also click me now".
//
// The fill is rendered by a `<span class="as-wf-finish-skip-fill" />` child
// (aliases `c8-progress-fill`) and the label by an
// `<span class="as-wf-finish-skip-label">` (aliases `c8-progress-label`).
// `as-*` aliases keep the prebuilt `dist/css/wf.css` safelist self-contained
// — the bare `c8-progress-fill` class would be filtered out by the component
// class extractor since it's not `as-*` / `i-as-*` prefixed.
export const asWfFinishSkipShortcuts = defineShortcuts({
  "as-wf-finish-skip": "c8-flat c8-progress btn h-fingertip-s px-$s text-callout cursor-pointer",
  "as-wf-finish-skip-fill": "c8-progress-fill",
  "as-wf-finish-skip-label": "c8-progress-label",
});
