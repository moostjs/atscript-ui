import { defineShortcuts } from "vunor/theme";

// Skeleton + errored row classes. The actual shimmer animation lives on the
// parent `<tbody class="as-window-row-pool">` (see `as-window-table.ts`) so
// every visible skeleton stripe stays perfectly in sync — there's only ONE
// animated element regardless of how many rows are pending. Each skeleton
// `<tr>` is just a transparent placeholder that lets the tbody gradient
// show through.
//
// Errored rows paint an opaque grey background that covers the moving
// gradient — a failed loadRange shouldn't pretend to be still in flight.
export const asWindowSkeletonShortcuts = defineShortcuts({
  "as-window-skeleton-row": "select-none cursor-default",
  // Cells stay transparent so the tbody gradient (or the empty-row's own bg)
  // is what the user sees.
  "as-window-skeleton-cell":
    "relative align-middle px-$m py-$s text-callout text-transparent bg-transparent",
  // Errored slot — fully opaque scope background, same as a loaded data
  // row, so the moving tbody shimmer is completely hidden. The slot reads
  // as a plain blank line; the user understands "this row didn't load"
  // from the absence of content + (eventually) the cell-level error
  // affordance, NOT from any pulsing animation.
  "as-window-empty-row": "select-none cursor-default bg-current-bg",
});
