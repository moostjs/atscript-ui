import { defineShortcuts } from "vunor/theme";

// c8-progress — button-with-progress-bar primitive.
//
// Composes on top of any c8-* base (typically `c8-flat` or `c8-filled`) to
// turn a clickable surface into a self-filling progress button: the inner
// `c8-progress-fill` element animates from 0% → 100% width over the duration
// supplied via the `--progress-duration` CSS custom property (inline style on
// the host). Natural fit for "I'll fire on my own when the bar reaches the
// end, but you can also click me now" controls — auto-redirect skip buttons,
// hold-to-confirm, timed CTAs.
//
// Usage:
//   <button class="c8-flat c8-progress" :style="{ '--progress-duration': `${ms}ms` }">
//     <span class="c8-progress-fill" />
//     <span class="c8-progress-label">Label</span>
//   </button>
//
// Notes:
// - `overflow-hidden` clips the fill to the button's rounded corners.
// - The fill is absolutely positioned (out of flow) behind the label, which
//   stays `relative` and in flow so it contributes its natural content
//   width to the host (otherwise the button collapses to its minimum
//   padding box). Source order alone resolves stacking — relative paints
//   after absolute when both have `z-index: auto`.
// - `bg-black/20` produces a uniform darken overlay on top of any
//   underlying button surface in both themes. `bg-current/20` would resolve
//   to the foreground text color and lighten on filled buttons.
// - The `as-progress-fill` keyframes are registered as a preset preflight in
//   `ui-styles/src/preset.ts` so the rule emits exactly once.
export const c8ProgressShortcuts = defineShortcuts({
  "c8-progress": "relative overflow-hidden",
  "c8-progress-fill":
    "absolute inset-y-0 left-0 w-0 bg-black/20 animate-[as-progress-fill_var(--progress-duration,4s)_linear_forwards]",
  "c8-progress-label": "relative",
});
