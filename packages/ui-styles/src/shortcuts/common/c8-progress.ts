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
// - The fill is `absolute inset-0` (out of flow) BEHIND the label, which
//   stays `relative` and IN FLOW. Source order alone resolves stacking:
//   relative-positioned elements paint after absolutely-positioned siblings
//   within the same stacking context when both have `z-index: auto`. No
//   `isolate`, no `z-[-1]`.
//
//   Why the label MUST stay in flow: absolute children don't contribute to
//   the host's intrinsic size. If both fill and label are absolute, the
//   button collapses to its minimum padding box (≈ 2em wide on a single-
//   char button), and the label wraps char-by-char inside a tiny square.
//   Keeping the label `relative` lets the host size from the label's
//   natural content width.
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
  // In-flow label. Sits on top of the absolute fill via source order, and
  // contributes its natural content width to the host so the button sizes
  // to "Go now" (not 2em). Padding, height, and centering are owned by
  // the host button (`px-$m`, `h-fingertip-m`, `btn` or inline-flex).
  "c8-progress-label": "relative",
});
