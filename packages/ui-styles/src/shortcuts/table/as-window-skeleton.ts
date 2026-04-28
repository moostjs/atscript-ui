import { defineShortcuts } from "vunor/theme";

// Skeleton + errored row classes. Shimmer lives per-row (not on the tbody)
// so it can't bleed through translucent selected/highlighted data rows.
// `<AsWindowSkeletonRow>` phase-locks every visible row by setting an inline
// `animation-delay` against a wall-clock epoch. Keyframe `@keyframes
// as-shimmer` lives in the preset preflight.
export const asWindowSkeletonShortcuts = defineShortcuts({
  "as-window-skeleton-row": {
    "":
      "select-none cursor-default " +
      "bg-[linear-gradient(90deg,rgb(var(--scope-dark-0)/0.05)_0%,rgb(var(--scope-dark-0)/0.05)_40%,rgb(var(--scope-dark-0)/0.12)_50%,rgb(var(--scope-dark-0)/0.05)_60%,rgb(var(--scope-dark-0)/0.05)_100%)] " +
      "bg-[length:200%_100%] " +
      "animate-[as-shimmer_4.2s_linear_infinite]",
    "dark:":
      "bg-[linear-gradient(90deg,rgb(var(--scope-light-0)/0.05)_0%,rgb(var(--scope-light-0)/0.05)_40%,rgb(var(--scope-light-0)/0.12)_50%,rgb(var(--scope-light-0)/0.05)_60%,rgb(var(--scope-light-0)/0.05)_100%)]",
  },
  // Cells stay transparent so the row's gradient (or the empty-row's own bg)
  // is what the user sees.
  "as-window-skeleton-cell":
    "relative align-middle px-$m py-$s text-callout text-transparent bg-transparent",
  // Errored slot — opaque scope background, no shimmer. Reads as a plain
  // blank line; the cell-level error affordance carries the "didn't load"
  // signal, not a pulsing animation.
  "as-window-empty-row": "select-none cursor-default bg-current-bg",
});
