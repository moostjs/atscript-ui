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
// - `isolate` creates a new stacking context so `c8-progress-fill` (z-[-1])
//   stays inside the button but reliably sits behind any other child content.
// - `overflow-hidden` clips the fill to the button's rounded corners.
// - The fill is tinted with `bg-current/20` so it darkens the parent button
//   uniformly across `c8-filled` / `c8-flat` / `c8-light` — same darkening
//   pattern as `c8-*-active`.
// - The `progress-fill` keyframes are registered as a preset preflight in
//   `ui-styles/src/preset.ts` so the rule emits exactly once.
export const c8ProgressShortcuts = defineShortcuts({
  "c8-progress": "relative overflow-hidden isolate",
  "c8-progress-fill":
    "absolute inset-0 z-[-1] origin-left w-0 bg-current/20 animate-[progress-fill_var(--progress-duration,4s)_linear_forwards]",
  // Wrap the button's text content so it sits above `c8-progress-fill`
  // regardless of the fill's stacking-context tricks. Keeps consumers from
  // having to inline raw `relative` in templates.
  "c8-progress-label": "relative",
});
