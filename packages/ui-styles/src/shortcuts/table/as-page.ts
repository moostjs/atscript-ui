import { defineShortcuts } from "vunor/theme";
import { searchIcon, strongText } from "./_shared";

export const asPageShortcuts = defineShortcuts({
  "as-page-header": "flex items-start justify-between gap-$m px-$l pt-$l pb-$m",
  "as-page-header-titles": "flex flex-col gap-[0.15em] min-w-0",
  "as-page-header-eyebrow":
    "font-mono text-callout font-600 tracking-[0.14em] uppercase text-current/70 mb-$xs",
  // Inline row holding the page title plus an optional toggle (e.g. the
  // multi-select switch). The title element keeps its `text-[1.54em]`
  // intrinsic size; the toggle sits beside it as a small adjunct.
  "as-page-header-title-row": "flex items-center gap-$s min-w-0",
  "as-page-header-title": `m-0 text-[1.54em] font-600 tracking-[-0.02em] ${strongText}`,
  "as-page-header-sub": "text-callout text-current/70 mt-[0.15em]",
  "as-page-header-actions": "flex items-center gap-$xs flex-shrink-0",
  // Title-row toggle: `c8-flat` already wires `aria-[pressed=true]` to
  // `c8-flat-selected` so the button paints scope-tinted (icon + bg) when
  // pressed. `scope-primary` gives the pressed state the brand-blue tint.
  "as-page-title-toggle": {
    "": "scope-primary c8-flat inline-grid place-items-center size-fingertip-s",
    "[&_>span]:": "text-[1.25em]",
  },
  // Same chrome as dialog buttons (`as-filter-btn` etc.) — `c8-chrome`
  // handles bg + border + hover (only the bg shifts on hover, text color
  // stays neutral). Layout-only utilities live alongside.
  "as-page-toolbar-btn": {
    "": "scope-neutral c8-chrome inline-flex items-center gap-$xs h-fingertip-m px-$m text-callout font-500 cursor-pointer leading-none",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  // Island wrapper grouping a set of square icon-only toolbar buttons (e.g.
  // Columns / Filters / Sorters config triggers). Single shared border,
  // internal dividers between buttons, rounded outer ends. Children should
  // use `as-page-toolbar-island-btn` so their own border-0 lets the island
  // chrome show through.
  "as-page-toolbar-island":
    "inline-flex items-stretch surface-0 border-1 rounded-base overflow-hidden [&_>button:not(:first-child)]:border-l-1",
  // Square icon-only button living inside `as-page-toolbar-island`. Sized
  // like the rest of the toolbar (`fingertip-m`) but icon-only and
  // border-0 so the parent island's border + dividers show through.
  "as-page-toolbar-island-btn": {
    "": "scope-neutral inline-grid place-items-center size-fingertip-m bg-transparent border-0 text-current cursor-pointer",
    "hover:not-disabled:": "current-bg-scope-light-1 bg-current",
    "dark:hover:not-disabled:": "current-bg-scope-dark-1",
    "disabled:": "opacity-40 cursor-not-allowed",
    "[&_>span]:": "text-[1.25em]",
  },
  "as-page-toolbar":
    "grid grid-cols-[minmax(240px,1fr)_auto] items-center gap-x-$m gap-y-$s px-$l pb-$m min-w-0",
  "as-page-search": "relative min-w-0 col-start-1",
  "as-page-search-icon": searchIcon,
  "as-page-search-input": {
    "": `scope-primary w-full h-fingertip-m pl-[2em] pr-$s border-1 layer-0 rounded-base ${strongText} outline-none current-outline-hl placeholder:text-current/50`,
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus:": "current-border-hl outline i8-apply-outline",
  },
  // Pinned to `min-h-fingertip-m` so the row keeps a stable height when the
  // selection summary (Clear button) appears/disappears — without this, the
  // pill-only state collapses to text height and the row jumps.
  "as-page-toolbar-right": "flex items-center gap-$s flex-shrink-0 col-start-2 min-h-fingertip-m",
  "as-page-pill":
    "inline-flex items-center gap-$xs px-$s py-$xs rounded-r0 layer-2 text-current/70 text-callout font-mono whitespace-nowrap",
  "as-page-pill-strong": "text-current font-600",
  // Row holding active filter chips (`<AsFilters>`) plus, when there's an
  // active selection, the right-aligned `as-page-selection-summary`. Spans
  // both grid columns of `as-page-toolbar`. The selection summary uses
  // `ml-auto` to slide to the right edge regardless of how many chips are
  // present (zero or many).
  "as-page-filters-row": "flex items-center gap-$s flex-wrap min-w-0 col-span-2",
  // Right-aligned selection summary: count badge + Clear button. `ml-auto`
  // pushes to the row's right end so it visually pairs with the count
  // pill above.
  "as-page-selection-summary": "ml-auto flex items-center gap-$s",
  "as-page-selection-count": "scope-primary font-mono text-callout font-600 text-current-hl",
  "as-page-clear": {
    "": "inline-flex items-center gap-$xs h-fingertip-m px-$s border-0 bg-transparent text-current/70 text-callout cursor-pointer ml-auto transition-colors duration-120",
    "hover:": "text-current-hl",
  },
});
