import { defineShortcuts } from "vunor/theme";

export const asWindowTableShortcuts = defineShortcuts({
  "as-window-table-scroll-area": "relative flex flex-row flex-1 min-h-0 w-full",
  "as-window-table-wrapper": "flex-1 min-w-0 overflow-x-auto overflow-y-hidden",
  // Shimmer lives on the tbody (not per-row) so every skeleton stripe stays
  // in lockstep regardless of mount time. MUST NOT override `display`:
  // switching to block detaches tbody from the parent <table>'s column layout.
  // Skeleton rows are transparent so the gradient shows through; loaded/errored
  // rows paint opaque to hide it. Keyframe `@keyframes as-shimmer` lives in
  // the preset preflight.
  "as-window-row-pool": {
    "":
      "bg-[linear-gradient(90deg,rgb(var(--scope-dark-0)/0.05)_0%,rgb(var(--scope-dark-0)/0.05)_40%,rgb(var(--scope-dark-0)/0.12)_50%,rgb(var(--scope-dark-0)/0.05)_60%,rgb(var(--scope-dark-0)/0.05)_100%)] " +
      "bg-[length:200%_100%] " +
      "animate-[as-shimmer_4.2s_linear_infinite]",
    "dark:":
      "bg-[linear-gradient(90deg,rgb(var(--scope-light-0)/0.05)_0%,rgb(var(--scope-light-0)/0.05)_40%,rgb(var(--scope-light-0)/0.12)_50%,rgb(var(--scope-light-0)/0.05)_60%,rgb(var(--scope-light-0)/0.05)_100%)]",
  },
  // Opaque background hides the tbody shimmer so loaded text reads cleanly.
  "as-window-data-row": "bg-current-bg",
});
