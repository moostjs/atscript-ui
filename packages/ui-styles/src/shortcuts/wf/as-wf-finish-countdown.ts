import { defineShortcuts } from "vunor/theme";

export const asWfFinishCountdownShortcuts = defineShortcuts({
  // Stacked: "Continuing in 3…" text on top, smooth CSS-animated progress bar
  // below. Bar is independent of the integer seconds counter — it runs purely
  // off the `progress-fill` keyframes timed by the host element's
  // `--progress-duration` custom property, so consumers see a seamless 0→100%
  // fill instead of the 1-second discrete jumps the previous slot exposed.
  "as-wf-finish-countdown": "flex flex-col items-stretch gap-$xs text-body text-current-muted",
  // Thin track behind the fill — uses `layer-1` for the recessed look against
  // a `layer-0` page chrome. `--progress-duration` is read by the inner fill.
  "as-wf-finish-countdown-progress": "h-1 layer-1 rounded-r1 overflow-hidden",
  // Accent fill. `bg-current-hl` reads the active scope's highlight color
  // (scope-color-500), so the bar inherits whatever scope the page sits in
  // (primary/secondary/error/…). Animation duration is inherited via the
  // `--progress-duration` variable set on `as-wf-finish-countdown-progress`.
  "as-wf-finish-countdown-progress-fill":
    "h-full w-0 bg-current-hl animate-[progress-fill_var(--progress-duration,4s)_linear_forwards]",
});
