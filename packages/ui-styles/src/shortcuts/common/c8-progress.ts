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
// - Both the fill and the label are `absolute inset-0` siblings inside the
//   `relative` host. With both at auto z-index, the later-painted element
//   wins — the label comes after the fill in source order, so it naturally
//   sits on top without any stacking-context tricks. Avoid `isolate` on the
//   host and `z-[-1]` on the fill: combined, they place the fill BEHIND the
//   button's own solid background (`c8-filled` paints `--current-bg`),
//   making it invisible.
// - The fill is tinted with `bg-black/20` so it produces a uniform darken
//   overlay on top of any underlying button surface (`c8-filled`,
//   `c8-flat`, `c8-light`) in both light and dark themes. `bg-current/20`
//   would resolve to `currentColor` (the foreground text color — white on
//   filled-primary) and lighten rather than darken.
// - The `progress-fill` keyframes are registered as a preset preflight in
//   `ui-styles/src/preset.ts` so the rule emits exactly once.
export const c8ProgressShortcuts = defineShortcuts({
  "c8-progress": "relative overflow-hidden",
  "c8-progress-fill":
    "absolute inset-0 origin-left w-0 bg-black/20 animate-[progress-fill_var(--progress-duration,4s)_linear_forwards]",
  // Absolute overlay that fills the host bounds and centers its content.
  // Paints over `c8-progress-fill` purely by source order (the label comes
  // after the fill in template). `px-$m` is structural so consumers can
  // wrap labels of varying length without inlining utilities — the host
  // button's `h-*` and any explicit `min-w-*` define the box, and this
  // overlay centers within it.
  "c8-progress-label": "absolute inset-0 flex items-center justify-center px-$m",
});
