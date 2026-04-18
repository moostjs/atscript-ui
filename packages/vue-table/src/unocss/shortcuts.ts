import { defineShortcuts } from "@atscript/unocss-preset";

// See vue-form/src/unocss/shortcuts.ts for the color-system rationale.
// primary / grey / error palettes come from presetVunor; `layer-1` is used for
// dialogs/popovers so dark mode flips surfaces automatically.

const dialogOverlay = "fixed inset-0 bg-black/30 dark:bg-black/60 z-[100]";

const dialogBase =
  "layer-1 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] " +
  "rounded-[var(--as-radius-lg)] shadow-[var(--as-shadow-dialog)] " +
  "flex flex-col outline-none border border-solid border-grey-200 dark:border-grey-700";

const focusRingPrimary =
  "focus:border-primary-500 focus:shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]";

const smallInputBase =
  "flex-1 px-[10px] py-[6px] border border-solid border-grey-300 dark:border-grey-700 " +
  "rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-[120px] " +
  "bg-transparent text-grey-900 dark:text-grey-50";

export const asTableShortcuts = defineShortcuts({
  /* ────────── Table ────────── */
  "as-table": {
    "": "w-max border-collapse text-[length:var(--as-fs-base)]",
    "[&_thead]:": "bg-grey-50 dark:bg-grey-800",
    "[&_th]:":
      "px-[12px] py-[8px] text-left font-600 text-[length:var(--as-fs-sm)] text-grey-600 dark:text-grey-300 border-b border-solid border-grey-200 dark:border-grey-700 whitespace-nowrap overflow-hidden text-ellipsis select-none tracking-[0.01em]",
    "[&_td]:":
      "px-[12px] py-[8px] border-b border-solid border-grey-100 dark:border-grey-800 whitespace-nowrap overflow-hidden text-ellipsis",
    "[&_tbody_tr]:": "transition-colors duration-100",
    "[&_tbody_tr]:hover:": "bg-grey-50 dark:bg-grey-800/70",
    "[&_tbody_tr[data-state=checked]]:":
      "bg-primary-50 dark:bg-primary-900/30",
  },
  "as-table-stretch": "min-w-full",
  "as-table-sticky": {
    "[&_thead]:": "sticky top-0 z-[1]",
  },
  "as-table-scroll-container": "overflow-auto",
  "as-th-filler": "p-0 w-auto",
  "as-td-filler": "p-0 w-auto",

  "as-th-btn": {
    "":
      "flex items-center justify-between gap-[6px] w-full p-0 m-0 border-0 bg-transparent font-inherit font-600 text-[length:var(--as-fs-sm)] text-grey-600 dark:text-grey-300 text-left cursor-pointer outline-none whitespace-nowrap",
    "hover:": "text-primary-500",
  },
  "as-th-label": "overflow-hidden text-ellipsis flex-shrink",
  "as-th-indicators": "inline-flex items-center gap-[4px] flex-shrink-0",
  "as-th-sort": "text-[length:var(--as-fs-xs)] text-primary-500",
  "as-th-filter-badge":
    "inline-flex items-center justify-center min-w-[16px] h-[16px] px-[4px] rounded-full bg-primary-500 text-white text-[10px] font-600 leading-none",
  "as-th-chevron":
    "text-[length:var(--as-fs-xs)] text-grey-400",
  "as-cell-number": "text-right tabular-nums font-mono",
  "as-virtual-row": "absolute w-full",
  "as-th-select": "w-[3em] text-center",
  "as-td-select": "w-[3em] text-center",

  "as-table-empty":
    "flex items-center justify-center p-[32px] text-grey-500 text-[length:var(--as-fs-md)]",
  "as-table-loading":
    "flex items-center justify-center p-[32px] text-grey-500 text-[length:var(--as-fs-md)]",
  "as-table-error":
    "flex items-center justify-center p-[32px] text-error-500 text-[length:var(--as-fs-md)]",

  /* ────────── Column menu ────────── */
  "as-column-menu-content":
    "layer-1 z-[50] whitespace-nowrap py-[4px] border border-solid border-grey-200 dark:border-grey-700 rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)] min-w-[160px]",
  "as-column-menu-item": {
    "":
      "block w-full px-[12px] py-[6px] border-0 bg-transparent text-left text-[length:var(--as-fs-base)] cursor-pointer outline-none",
    "hover:": "bg-grey-100 dark:bg-grey-800",
    "data-[highlighted]:": "bg-grey-100 dark:bg-grey-800",
  },
  "as-column-menu-item-active":
    "bg-primary-50 dark:bg-primary-900/30 text-primary-500 font-500",
  "as-column-menu-separator":
    "h-[1px] bg-grey-200 dark:bg-grey-700 my-[4px]",

  /* ────────── Filter dialog ────────── */
  "as-filter-dialog-overlay": dialogOverlay,
  "as-filter-dialog-content":
    `${dialogBase} w-[640px] max-w-[92vw] min-h-[520px] max-h-[92vh]`,
  "as-filter-dialog-has-value-help": "w-[900px]",
  "as-filter-dialog-header":
    "flex items-center justify-between gap-[12px] px-[20px] py-[14px] border-b border-solid border-grey-100 dark:border-grey-800",
  "as-filter-dialog-title":
    "m-0 text-[length:var(--as-fs-lg)] font-600 tracking-[-0.01em]",
  "as-filter-dialog-close": {
    "":
      "inline-grid place-items-center w-[28px] h-[28px] p-0 border-0 bg-transparent text-grey-400 rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120",
    "hover:": "bg-grey-100 dark:bg-grey-800",
  },
  "as-filter-dialog-body":
    "px-[20px] py-[16px] overflow-y-auto flex-1 flex flex-col gap-[12px]",
  "as-filter-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-filter-dialog-tab-content":
    "flex-1 min-h-0 flex-col overflow-hidden",
  "as-filter-dialog-tab-conditions":
    "px-[20px] py-[16px] overflow-y-auto flex-col gap-[12px]",

  "as-filter-dialog-chips-bar":
    "flex flex-col gap-[6px] px-[20px] py-[8px] border-t border-solid border-grey-100 dark:border-grey-800 flex-shrink-0",
  "as-filter-dialog-chips-header":
    "flex items-center justify-between text-[length:var(--as-fs-sm)] text-grey-500",
  "as-filter-dialog-clear-all": {
    "":
      "border-0 bg-transparent text-error-500 text-[length:var(--as-fs-sm)] cursor-pointer p-0",
    "hover:": "underline",
  },
  "as-filter-dialog-chips": "flex flex-wrap gap-[4px]",
  "as-filter-dialog-chip":
    "inline-flex items-center gap-[4px] px-[8px] py-[2px] bg-primary-50 dark:bg-primary-900/40 border border-solid border-primary-200 dark:border-primary-700 rounded-[var(--as-radius-chip)] text-[length:var(--as-fs-sm)] text-primary-700 dark:text-primary-200 whitespace-nowrap",
  "as-filter-dialog-chip-remove": {
    "":
      "cursor-pointer opacity-70 text-[length:var(--as-fs-md)] leading-none border-0 bg-transparent px-[2px] text-inherit",
    "hover:": "opacity-100",
  },

  /* ────────── Value help tab ──────── */
  "as-filter-value-help": "flex flex-col flex-1 min-h-0",
  "as-filter-value-help-toolbar":
    "flex items-center gap-[8px] px-[16px] py-[8px] border-b border-solid border-grey-100 dark:border-grey-800 flex-shrink-0",
  "as-filter-value-help-search": {
    "": smallInputBase,
    "focus:":
      "border-primary-500 shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]",
  },
  "as-filter-value-help-count":
    "text-[length:var(--as-fs-sm)] text-grey-400 whitespace-nowrap",
  "as-filter-value-help-table": "flex-1 min-h-0 overflow-auto",

  /* ────────── Filter conditions ──────── */
  "as-filter-condition-row": "flex items-start gap-[8px]",
  "as-filter-condition-select": {
    "":
      "px-[8px] py-[6px] border border-solid border-grey-300 dark:border-grey-700 rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] min-w-[130px] flex-shrink-0 bg-transparent outline-none cursor-pointer",
    "focus:":
      "border-primary-500 shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]",
  },
  "as-filter-condition-remove": {
    "":
      "px-[8px] py-0 border-0 bg-transparent text-[length:var(--as-fs-md)] text-error-500 cursor-pointer leading-none flex-shrink-0",
    "hover:": "opacity-80",
  },
  "as-filter-add-condition": {
    "":
      "py-[4px] px-0 border-0 bg-transparent text-[length:var(--as-fs-base)] text-primary-500 cursor-pointer text-left",
    "hover:": "underline",
  },

  "as-filter-input": {
    "":
      "flex-1 px-[10px] py-[6px] border border-solid border-grey-300 dark:border-grey-700 rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-0 bg-transparent",
    "focus:":
      "border-primary-500 shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]",
  },
  "as-filter-select": "cursor-pointer",
  "as-filter-input-range": "flex items-center gap-[6px] flex-1",
  "as-filter-input-range-sep":
    "text-grey-400 flex-shrink-0",

  "as-filter-shortcuts":
    "flex flex-wrap items-center gap-[6px] pt-[4px] border-t border-solid border-grey-100 dark:border-grey-800",
  "as-filter-shortcuts-label":
    "text-[length:var(--as-fs-sm)] text-grey-400 flex-shrink-0",
  "as-filter-shortcut-btn": {
    "":
      "px-[8px] py-[2px] border border-solid border-grey-200 dark:border-grey-700 rounded-[var(--as-radius-sm)] bg-grey-50 dark:bg-grey-800 text-[length:var(--as-fs-xs)] text-grey-500 cursor-pointer whitespace-nowrap transition-all duration-120",
    "hover:":
      "border-primary-500 text-primary-500 bg-primary-50 dark:bg-primary-900/30",
  },

  /* Footer */
  "as-filter-dialog-footer":
    "flex items-center justify-between px-[20px] py-[12px] border-t border-solid border-grey-100 dark:border-grey-800",
  "as-filter-dialog-footer-right": "flex gap-[8px]",
  "as-filter-btn": {
    "":
      "inline-flex items-center justify-center h-[32px] px-[16px] border border-solid border-grey-300 dark:border-grey-700 rounded-[var(--as-radius)] bg-transparent text-[length:var(--as-fs-base)] font-500 cursor-pointer transition-all duration-120",
    "hover:": "bg-grey-100 dark:bg-grey-800",
  },
  "as-filter-btn-apply": {
    "": "bg-primary-500 border-primary-500 text-white",
    "hover:": "bg-primary-600 border-primary-600",
  },
  "as-filter-btn-clear": {
    "":
      "border-0 text-error-500 bg-transparent px-[8px] py-[6px]",
    "hover:": "underline",
  },

  /* ────────── Filter field (unified) ──────── */
  "as-filter-field":
    "inline-flex flex-col gap-[2px] min-w-[180px] max-w-[360px] text-[length:var(--as-fs-base)]",
  "as-filter-field-label":
    "text-[length:var(--as-fs-xs)] text-grey-500 whitespace-nowrap",
  "as-filter-field-body": {
    "":
      "inline-flex items-center gap-[4px] border border-solid border-grey-300 dark:border-grey-700 rounded-[var(--as-radius)] px-[6px] py-[2px] bg-transparent min-h-[32px]",
    "focus-within:":
      "border-primary-500 shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]",
  },
  "as-filter-field-input":
    "flex items-center gap-[4px] flex-1 min-w-0 cursor-text flex-wrap",
  "as-filter-field-chip":
    "inline-flex items-center gap-[2px] px-[6px] py-[1px] bg-primary-50 dark:bg-primary-900/40 border border-solid border-primary-200 dark:border-primary-700 rounded-[var(--as-radius-sm)] text-[length:var(--as-fs-xs)] text-primary-700 dark:text-primary-200 whitespace-nowrap flex-shrink-0",
  "as-filter-field-chip-remove": {
    "": "cursor-pointer opacity-70 text-[length:var(--as-fs-sm)]",
    "hover:": "opacity-100",
  },
  "as-filter-field-search":
    "border-0 outline-none flex-1 min-w-[40px] text-[length:var(--as-fs-base)] py-[3px] bg-transparent placeholder:text-grey-400",
  "as-filter-field-f4": {
    "":
      "cursor-pointer text-grey-400 text-[length:var(--as-fs-md)] flex-shrink-0 border-0 bg-transparent px-[2px] leading-none",
    "hover:": "text-primary-500",
  },
  "as-filter-field-dropdown":
    "layer-1 z-[50] border border-solid border-grey-200 dark:border-grey-700 rounded-[var(--as-radius-lg)] shadow-[var(--as-shadow-dialog)] min-w-[320px] max-w-[560px] flex flex-col outline-none w-[max(var(--reka-popper-anchor-width,320px),320px)]",
  "as-filter-field-dropdown-footer": {
    "":
      "flex gap-[8px] px-[8px] py-[6px] border-t border-solid border-grey-100 dark:border-grey-800 justify-end",
    "[&_button]:":
      "px-[10px] py-[4px] border-0 bg-transparent text-[length:var(--as-fs-sm)] text-primary-500 cursor-pointer",
    "[&_button]:hover:": "underline",
  },

  /* ────────── Config dialog ──────── */
  "as-config-dialog-overlay": dialogOverlay,
  "as-config-dialog-content":
    `${dialogBase} w-[640px] max-w-[92vw] min-h-[480px] max-h-[85vh]`,
  "as-config-dialog-header":
    "flex items-center gap-[12px] px-[20px] py-[14px] border-b border-solid border-grey-100 dark:border-grey-800 flex-shrink-0",
  "as-config-dialog-title":
    "m-0 text-[length:var(--as-fs-lg)] font-600 whitespace-nowrap tracking-[-0.01em]",
  "as-config-dialog-close": {
    "":
      "inline-grid place-items-center w-[28px] h-[28px] p-0 ml-auto border-0 bg-transparent text-grey-400 rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120 flex-shrink-0",
    "hover:": "bg-grey-100 dark:bg-grey-800",
  },
  "as-config-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-config-tabs-list":
    "flex gap-0 flex-shrink-0 border-b border-solid border-grey-100 dark:border-grey-800 px-[20px]",
  "as-config-tab-trigger": {
    "":
      "relative px-[14px] py-[10px] border-0 border-b-2 border-solid border-b-transparent bg-transparent text-[length:var(--as-fs-base)] font-500 text-grey-500 cursor-pointer whitespace-nowrap outline-none transition-all duration-120",
    "hover:": "text-grey-700 dark:text-grey-200",
    "data-[state=active]:":
      "text-grey-900 dark:text-grey-50 border-b-primary-500 font-600",
  },
  "as-config-tab-content": "flex-1 min-h-0 flex-col",
  "as-config-dialog-footer":
    "flex items-center justify-end gap-[8px] px-[20px] py-[12px] border-t border-solid border-grey-100 dark:border-grey-800 flex-shrink-0",

  /* ────────── Orderable list (design .clist) ──────── */
  "as-orderable-list-toolbar":
    "flex flex-row-reverse items-center gap-[8px] px-[12px] py-[8px] border-b border-solid border-grey-100 dark:border-grey-800 flex-shrink-0",
  "as-orderable-list-search": {
    "": smallInputBase,
    "focus:":
      "border-primary-500 shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]",
  },
  "as-orderable-list-toolbar-actions":
    "flex gap-[4px] flex-shrink-0",
  "as-orderable-list-toolbar-btn": {
    "":
      "inline-grid place-items-center w-[28px] h-[28px] p-0 border border-solid border-grey-200 dark:border-grey-700 rounded-[var(--as-radius-sm)] bg-transparent text-[length:var(--as-fs-md)] text-grey-500 cursor-pointer leading-none transition-all duration-120",
    "hover:": "border-primary-500 text-primary-500",
  },

  "as-orderable-list-items":
    "flex-1 overflow-y-auto flex flex-col",
  "as-orderable-list-item": {
    "":
      "relative cursor-grab outline-none transition-colors duration-120",
    "hover:": "bg-grey-50 dark:bg-grey-800/70",
    "data-[highlighted]:": "bg-grey-100 dark:bg-grey-800",
  },
  "as-orderable-list-item-dragging": "opacity-25",
  "as-orderable-list-item-disabled":
    "pointer-events-none cursor-default",
  "as-orderable-list-item-content":
    "flex items-center gap-[8px] px-[12px] py-[6px] min-h-[32px]",
  "as-orderable-list-checkbox":
    "w-[16px] h-[16px] border-1.5 border-solid border-grey-300 dark:border-grey-600 rounded-[4px] flex items-center justify-center flex-shrink-0 cursor-pointer text-[10px] text-white bg-transparent transition-all duration-120",
  "as-orderable-list-checkbox-disabled": "opacity-50",
  "as-orderable-list-check-icon":
    "flex items-center justify-center",
  "as-orderable-list-item-body":
    "flex items-center gap-[8px] flex-1 min-w-0",
  "as-orderable-list-item-label":
    "flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[length:var(--as-fs-base)]",
  "as-orderable-list-item-actions": {
    "":
      "flex gap-[2px] flex-shrink-0 opacity-0 transition-opacity duration-120",
    "[&_button]:":
      "inline-grid place-items-center w-[22px] h-[22px] p-0 border-0 bg-transparent text-[length:var(--as-fs-xs)] cursor-pointer text-grey-400 leading-none rounded-[3px] transition-all duration-120",
    "[&_button]:hover:":
      "bg-primary-50 dark:bg-primary-900/40 text-primary-500",
    "[&_button:disabled]:": "opacity-35 cursor-not-allowed",
  },

  "as-orderable-list-drop-indicator":
    "absolute left-0 right-0 -top-px h-[2px] bg-primary-500 pointer-events-none z-[1] before:content-[''] before:absolute before:left-0 before:-top-[2px] before:w-[6px] before:h-[6px] before:bg-primary-500 before:rounded-full",

  /* ────────── Sorter ──────── */
  "as-sorter-label":
    "flex items-center gap-[6px] flex-1 min-w-0",
  "as-sorter-direction-btn": {
    "":
      "inline-flex items-center justify-center gap-[4px] h-[24px] px-[8px] border border-solid border-grey-200 dark:border-grey-700 rounded-[var(--as-radius-sm)] bg-transparent text-[length:var(--as-fs-xs)] text-grey-500 cursor-pointer leading-none transition-all duration-120 flex-shrink-0",
    "hover:":
      "border-primary-500 text-primary-500",
  },
  "as-sorter-direction-disabled": "opacity-50 cursor-default",
  "as-sorter-lock":
    "text-[length:var(--as-fs-sm)] opacity-50 flex-shrink-0",
});
