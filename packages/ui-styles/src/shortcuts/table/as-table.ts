import { defineShortcuts } from "vunor/theme";
import { chipBase } from "./_shared";

export const asTableShortcuts = defineShortcuts({
  "as-spacer": "grow",
  "as-status-badge":
    "inline-flex items-center px-$s py-[0.15em] rounded-full text-callout font-500 bg-current-hl/15 text-current-hl",
  "as-tag-chip": `${chipBase} bg-current-hl/10 text-current-hl`,

  // Always table-layout: fixed. Every column has an explicit width all the
  // time (seeded from @ui.field.width annotation or computed defaults). The filler
  // <th> (no width) absorbs leftover space; `min-w-full` (`as-table-stretch`)
  // forces the table to span its container.
  "as-table": {
    "": "scope-primary table-fixed w-fit border-collapse",
    "[&_thead]:": "layer-1",
    "[&_th]:":
      "relative px-$m py-$s text-left font-600 text-current/80 border-b-1 whitespace-nowrap overflow-hidden text-ellipsis select-none tracking-[0.01em]",
    "[&_td]:": "px-$m py-$s border-b-1 whitespace-nowrap overflow-hidden text-ellipsis",
    "[&_tbody_tr]:": "transition-colors duration-100",
    "[&_tbody_tr:hover]:": "layer-1",
    // Active cursor (combobox `data-highlighted`, standalone `as-table-row-active`)
    // uses `layer-1` — same opaque depth highlight as the orderable-list items
    // in the table-config dialog. Selected state (combobox `data-state=checked`,
    // standalone `aria-selected`) uses a translucent scope tint. The compound
    // rule (both active AND selected) bumps to /30 so a selected row stays
    // distinguishable when the keyboard cursor lands on it — without that the
    // two states overlap and the active row vanishes into the selected tint.
    "[&_tbody_tr:is([data-highlighted=''])]:": "layer-1",
    "[&_tbody_tr:is(.as-table-row-active)]:": "layer-1",
    "[&_tbody_tr:is([data-state=checked])]:": "bg-current-hl/15",
    "[&_tbody_tr:is([aria-selected=true])]:": "bg-current-hl/15",
    "[&_tbody_tr:is([data-highlighted='']):is([data-state=checked])]:": "bg-current-hl/30",
    "[&_tbody_tr:is(.as-table-row-active):is([aria-selected=true])]:": "bg-current-hl/30",
  },
  "as-table-stretch": "min-w-full",
  "as-table-sticky": {
    "[&_thead]:": "sticky top-0 z-[1]",
  },
  "as-table-scroll-container": "flex-1 min-h-0 overflow-auto",
  "as-table-outer-wrap": "relative flex flex-col flex-1 min-h-0",
  "as-th-filler": "p-0 w-auto",
  "as-td-filler": "p-0 w-auto",

  "as-th-reorderable": "cursor-grab",
  "as-th-dragging": "opacity-50 cursor-grabbing",
  "as-th-resizing": "bg-current-hl/10",
  "as-th-resize-handle":
    "absolute right-0 top-0 bottom-0 w-$xs cursor-col-resize select-none z-[1] bg-current-hl/0 hover:bg-current-hl/40 active:bg-current-hl",
  "as-th-drop-indicator-before":
    "relative before:content-[''] before:absolute before:left-0 before:inset-y-0 before:w-$xxs before:bg-current-hl before:pointer-events-none before:z-[1]",
  "as-th-drop-indicator-after":
    "relative before:content-[''] before:absolute before:right-0 before:inset-y-0 before:w-$xxs before:bg-current-hl before:pointer-events-none before:z-[1]",

  "as-th-btn": {
    "": "flex items-center justify-between gap-$xs w-full p-0 m-0 border-0 bg-transparent font-inherit font-600 text-current/80 text-left cursor-pointer outline-none whitespace-nowrap",
    "hover:": "text-current-hl",
  },
  "as-th-label": "overflow-hidden text-ellipsis flex-shrink",
  "as-th-indicators": "inline-flex items-center gap-$xs flex-shrink-0",
  "as-th-sort": "inline-flex text-body text-current-hl",
  "as-th-filter-badge": "inline-flex text-body text-current-hl",
  "as-th-chevron": "inline-flex text-body text-current/50",
  "as-cell-number": "text-right tabular-nums font-mono",
  "as-virtual-row": "absolute w-full",
  // `!text-center` overrides the descendant `.as-table th { text-align: left }`
  // rule (specificity 0,1,1). Without `!`, the header checkbox shifts left
  // while body checkboxes stay centered, breaking column alignment.
  "as-th-select": "w-[4em] !text-center",
  "as-td-select": "w-[4em] text-center",
  "as-table-checkbox": {
    "": "scope-primary inline-flex align-middle text-body w-[1.25em] h-[1.25em] border-1 border-scope-light-3 dark:border-scope-dark-3 rounded-[0.2em] items-center justify-center layer-0 cursor-pointer transition-all duration-120",
    "[tr[data-state=checked]_&]:": "bg-current-hl border-current-hl",
    "[tr[aria-selected=true]_&]:": "bg-current-hl border-current-hl",
  },
  // Active-row highlight class — applied to data rows in standalone /
  // window-mode rendering. Mirrors the orderable-list `data-[highlighted]` style
  // (opaque `layer-1`). The descendant rule on `.as-table` covers plain tables;
  // this base shortcut covers any row that wears the class outside that wrapper.
  "as-table-row-active": "layer-1",
  "as-table-checkbox-checked": "bg-current-hl border-current-hl",
  "as-table-checkbox-indeterminate": "bg-current-hl border-current-hl",
  "as-table-checkbox-tick": "i-as-check w-[0.9em] h-[0.9em] text-white",
  "as-table-checkbox-dash": "w-[0.6em] h-[0.125em] bg-white block",

  "as-table-empty": "flex items-center justify-center p-$xl text-current/60 whitespace-normal",
  "as-table-loading": "flex items-center justify-center p-$xl text-current/60 whitespace-normal",
  "as-table-error":
    "scope-error flex items-center justify-center p-$xl text-current-hl whitespace-normal",
  "as-table-query-overlay": "inner-loading rounded-r2 text-current-hl pointer-events-none",
  "as-table-query-overlay-icon": "i-as-loading text-[3em]",

  "as-vh-empty": "flex flex-col items-center justify-center gap-$m py-$l px-$m text-center min-w-0",
  "as-vh-empty-icon":
    "inline-grid place-items-center w-[48px] h-[48px] rounded-full bg-current-hl/50 text-current-hl text-[1.54em] flex-shrink-0",
  "as-vh-error-icon": "as-vh-empty-icon scope-error",
  "as-vh-empty-title": "font-600 text-current m-0",
  "as-vh-empty-body":
    "text-callout text-current/60 max-w-[44ch] leading-[1.5] m-0 whitespace-normal break-words",
  "as-vh-empty-code": "font-mono text-current bg-current-hl/10 rounded-r0 px-$xs",
  "as-vh-empty-clear":
    "scope-neutral c8-chrome inline-flex items-center gap-$xs h-fingertip-s px-$m text-callout font-600 cursor-pointer rounded-base",
});
