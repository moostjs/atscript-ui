import { defineShortcuts } from "@atscript/unocss-preset";

const dialogOverlay = "fixed inset-0 bg-[rgba(15,23,42,0.35)] z-[100]";

const dialogBase =
  "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-[var(--as-surface)] rounded-[var(--as-radius-lg)] shadow-[var(--as-shadow-dialog)] flex flex-col outline-none border border-solid border-[var(--as-border)]";

export const asTableShortcuts = defineShortcuts({
  /* ──────── Table structure ──────── */
  "as-table": {
    "": "w-max border-collapse text-[length:var(--as-fs-base)]",
    "[&_thead]:":
      "bg-[var(--as-surface-sunken)] text-[var(--as-text-muted)]",
    "[&_th]:":
      "px-[12px] py-[8px] text-left font-600 text-[length:var(--as-fs-sm)] text-[var(--as-text-muted)] border-b border-solid border-[var(--as-border)] whitespace-nowrap overflow-hidden text-ellipsis select-none tracking-[0.01em]",
    "[&_td]:":
      "px-[12px] py-[8px] text-[var(--as-text)] border-b border-solid border-[var(--as-border-subtle)] whitespace-nowrap overflow-hidden text-ellipsis",
    "[&_tbody_tr]:": "transition-[background] duration-100",
    "[&_tbody_tr]:hover:": "bg-[var(--as-hover)]",
    "[&_tbody_tr[data-state=checked]]:": "bg-[var(--as-accent-soft)]",
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
      "flex items-center justify-between gap-[6px] w-full p-0 m-0 border-0 bg-transparent font-inherit font-600 text-[length:var(--as-fs-sm)] text-[var(--as-text-muted)] text-left cursor-pointer outline-none whitespace-nowrap",
    "hover:": "text-[var(--as-accent)]",
  },
  "as-th-label": "overflow-hidden text-ellipsis flex-shrink",
  "as-th-indicators": "inline-flex items-center gap-[4px] flex-shrink-0",
  "as-th-sort":
    "text-[length:var(--as-fs-xs)] text-[var(--as-accent)]",
  "as-th-filter-badge":
    "inline-flex items-center justify-center min-w-[16px] h-[16px] px-[4px] rounded-full bg-[var(--as-accent)] text-white text-[10px] font-600 leading-none",
  "as-th-chevron":
    "text-[length:var(--as-fs-xs)] text-[var(--as-text-faint)]",
  "as-cell-number": "text-right tabular-nums font-mono",
  "as-virtual-row": "absolute w-full",
  "as-th-select": "w-[3em] text-center",
  "as-td-select": "w-[3em] text-center",

  "as-table-empty":
    "flex items-center justify-center p-[32px] text-[var(--as-text-subtle)] text-[length:var(--as-fs-md)]",
  "as-table-loading":
    "flex items-center justify-center p-[32px] text-[var(--as-text-subtle)] text-[length:var(--as-fs-md)]",
  "as-table-error":
    "flex items-center justify-center p-[32px] text-[var(--as-danger)] text-[length:var(--as-fs-md)]",

  /* ──────── Column menu ──────── */
  "as-column-menu-content":
    "z-[50] whitespace-nowrap py-[4px] bg-[var(--as-surface)] border border-solid border-[var(--as-border)] rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)] min-w-[160px]",
  "as-column-menu-item": {
    "":
      "block w-full px-[12px] py-[6px] border-0 bg-transparent text-left text-[length:var(--as-fs-base)] text-[var(--as-text)] cursor-pointer outline-none",
    "hover:": "bg-[var(--as-hover)]",
    "data-[highlighted]:": "bg-[var(--as-hover)]",
  },
  "as-column-menu-item-active":
    "bg-[var(--as-accent-soft)] text-[var(--as-accent)] font-500",
  "as-column-menu-separator": "h-[1px] bg-[var(--as-border)] my-[4px]",

  /* ──────── Filter dialog ──────── */
  "as-filter-dialog-overlay": dialogOverlay,
  "as-filter-dialog-content":
    `${dialogBase} w-[640px] max-w-[92vw] min-h-[520px] max-h-[92vh]`,
  "as-filter-dialog-has-value-help": "w-[900px]",
  "as-filter-dialog-header":
    "flex items-center justify-between gap-[12px] px-[20px] py-[14px] border-b border-solid border-[var(--as-border-subtle)]",
  "as-filter-dialog-title":
    "m-0 text-[length:var(--as-fs-lg)] font-600 text-[var(--as-text)] tracking-[-0.01em]",
  "as-filter-dialog-close": {
    "":
      "inline-grid place-items-center w-[28px] h-[28px] p-0 border-0 bg-transparent text-[var(--as-text-faint)] rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120",
    "hover:": "bg-[var(--as-hover)] text-[var(--as-text)]",
  },
  "as-filter-dialog-body":
    "px-[20px] py-[16px] overflow-y-auto flex-1 flex flex-col gap-[12px]",
  "as-filter-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-filter-dialog-tab-content":
    "flex-1 min-h-0 flex-col overflow-hidden",
  "as-filter-dialog-tab-conditions":
    "px-[20px] py-[16px] overflow-y-auto flex-col gap-[12px]",

  "as-filter-dialog-chips-bar":
    "flex flex-col gap-[6px] px-[20px] py-[8px] border-t border-solid border-[var(--as-border-subtle)] flex-shrink-0",
  "as-filter-dialog-chips-header":
    "flex items-center justify-between text-[length:var(--as-fs-sm)] text-[var(--as-text-subtle)]",
  "as-filter-dialog-clear-all": {
    "":
      "border-0 bg-transparent text-[var(--as-danger)] text-[length:var(--as-fs-sm)] cursor-pointer p-0",
    "hover:": "underline",
  },
  "as-filter-dialog-chips": "flex flex-wrap gap-[4px]",
  "as-filter-dialog-chip":
    "inline-flex items-center gap-[4px] px-[8px] py-[2px] bg-[var(--as-accent-soft)] border border-solid border-[var(--as-accent-200,rgba(59,130,246,0.3))] rounded-[var(--as-radius-chip)] text-[length:var(--as-fs-sm)] text-[var(--as-accent-700,var(--as-accent))] whitespace-nowrap",
  "as-filter-dialog-chip-remove": {
    "":
      "cursor-pointer opacity-70 text-[length:var(--as-fs-md)] leading-none border-0 bg-transparent px-[2px] text-inherit",
    "hover:": "opacity-100",
  },

  /* ──────── Value help tab ──────── */
  "as-filter-value-help": "flex flex-col flex-1 min-h-0",
  "as-filter-value-help-toolbar":
    "flex items-center gap-[8px] px-[16px] py-[8px] border-b border-solid border-[var(--as-border-subtle)] flex-shrink-0",
  "as-filter-value-help-search": {
    "":
      "flex-1 px-[10px] py-[6px] border border-solid border-[var(--as-border-strong)] rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-[120px] bg-[var(--as-surface)] text-[var(--as-text)]",
    "focus:":
      "border-[var(--as-accent)] shadow-[0_0_0_3px_var(--as-accent-ring)]",
  },
  "as-filter-value-help-count":
    "text-[length:var(--as-fs-sm)] text-[var(--as-text-faint)] whitespace-nowrap",
  "as-filter-value-help-table": "flex-1 min-h-0 overflow-auto",

  /* ──────── Filter conditions ──────── */
  "as-filter-condition-row": "flex items-start gap-[8px]",
  "as-filter-condition-select": {
    "":
      "px-[8px] py-[6px] border border-solid border-[var(--as-border-strong)] rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] min-w-[130px] flex-shrink-0 bg-[var(--as-surface)] text-[var(--as-text)] outline-none cursor-pointer",
    "focus:":
      "border-[var(--as-accent)] shadow-[0_0_0_3px_var(--as-accent-ring)]",
  },
  "as-filter-condition-remove": {
    "":
      "px-[8px] py-0 border-0 bg-transparent text-[length:var(--as-fs-md)] text-[var(--as-danger)] cursor-pointer leading-none flex-shrink-0",
    "hover:": "opacity-80",
  },
  "as-filter-add-condition": {
    "":
      "py-[4px] px-0 border-0 bg-transparent text-[length:var(--as-fs-base)] text-[var(--as-accent)] cursor-pointer text-left",
    "hover:": "underline",
  },

  "as-filter-input": {
    "":
      "flex-1 px-[10px] py-[6px] border border-solid border-[var(--as-border-strong)] rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-0 bg-[var(--as-surface)] text-[var(--as-text)]",
    "focus:":
      "border-[var(--as-accent)] shadow-[0_0_0_3px_var(--as-accent-ring)]",
  },
  "as-filter-select": "cursor-pointer",
  "as-filter-input-range": "flex items-center gap-[6px] flex-1",
  "as-filter-input-range-sep":
    "text-[var(--as-text-faint)] flex-shrink-0",

  /* Date shortcuts */
  "as-filter-shortcuts":
    "flex flex-wrap items-center gap-[6px] pt-[4px] border-t border-solid border-[var(--as-border-subtle)]",
  "as-filter-shortcuts-label":
    "text-[length:var(--as-fs-sm)] text-[var(--as-text-faint)] flex-shrink-0",
  "as-filter-shortcut-btn": {
    "":
      "px-[8px] py-[2px] border border-solid border-[var(--as-border)] rounded-[var(--as-radius-sm)] bg-[var(--as-surface-muted)] text-[length:var(--as-fs-xs)] text-[var(--as-text-subtle)] cursor-pointer whitespace-nowrap transition-all duration-120",
    "hover:":
      "border-[var(--as-accent)] text-[var(--as-accent)] bg-[var(--as-accent-soft)]",
  },

  /* Footer */
  "as-filter-dialog-footer":
    "flex items-center justify-between px-[20px] py-[12px] border-t border-solid border-[var(--as-border-subtle)]",
  "as-filter-dialog-footer-right": "flex gap-[8px]",
  "as-filter-btn": {
    "":
      "inline-flex items-center justify-center h-[32px] px-[16px] border border-solid border-[var(--as-border-strong)] rounded-[var(--as-radius)] bg-[var(--as-surface)] text-[var(--as-text)] text-[length:var(--as-fs-base)] font-500 cursor-pointer transition-all duration-120",
    "hover:": "bg-[var(--as-hover)] border-[var(--as-text-faint)]",
  },
  "as-filter-btn-apply": {
    "": "bg-[var(--as-accent)] border-[var(--as-accent)] text-white",
    "hover:":
      "bg-[var(--as-accent-hover)] border-[var(--as-accent-hover)] text-white",
  },
  "as-filter-btn-clear": {
    "":
      "border-0 text-[var(--as-danger)] bg-transparent px-[8px] py-[6px]",
    "hover:": "underline",
  },

  /* ──────── Filter field (unified search + chips + VH) ──────── */
  "as-filter-field":
    "inline-flex flex-col gap-[2px] min-w-[180px] max-w-[360px] text-[length:var(--as-fs-base)]",
  "as-filter-field-label":
    "text-[length:var(--as-fs-xs)] text-[var(--as-text-subtle)] whitespace-nowrap",
  "as-filter-field-body": {
    "":
      "inline-flex items-center gap-[4px] border border-solid border-[var(--as-border-strong)] rounded-[var(--as-radius)] px-[6px] py-[2px] bg-[var(--as-surface)] min-h-[32px]",
    "focus-within:":
      "border-[var(--as-accent)] shadow-[0_0_0_3px_var(--as-accent-ring)]",
  },
  "as-filter-field-input":
    "flex items-center gap-[4px] flex-1 min-w-0 cursor-text flex-wrap",
  "as-filter-field-chip":
    "inline-flex items-center gap-[2px] px-[6px] py-[1px] bg-[var(--as-accent-soft)] border border-solid border-[var(--as-accent-200,rgba(59,130,246,0.3))] rounded-[var(--as-radius-sm)] text-[length:var(--as-fs-xs)] text-[var(--as-accent-700,var(--as-accent))] whitespace-nowrap flex-shrink-0",
  "as-filter-field-chip-remove": {
    "": "cursor-pointer opacity-70 text-[length:var(--as-fs-sm)]",
    "hover:": "opacity-100",
  },
  "as-filter-field-search":
    "border-0 outline-none flex-1 min-w-[40px] text-[length:var(--as-fs-base)] py-[3px] bg-transparent text-[var(--as-text)] placeholder:text-[var(--as-text-faint)]",
  "as-filter-field-f4": {
    "":
      "cursor-pointer text-[var(--as-text-faint)] text-[length:var(--as-fs-md)] flex-shrink-0 border-0 bg-transparent px-[2px] leading-none",
    "hover:": "text-[var(--as-accent)]",
  },
  "as-filter-field-dropdown":
    "z-[50] bg-[var(--as-surface)] border border-solid border-[var(--as-border)] rounded-[var(--as-radius-lg)] shadow-[var(--as-shadow-dialog)] min-w-[320px] max-w-[560px] flex flex-col outline-none w-[max(var(--reka-popper-anchor-width,320px),320px)]",
  "as-filter-field-dropdown-footer": {
    "":
      "flex gap-[8px] px-[8px] py-[6px] border-t border-solid border-[var(--as-border-subtle)] justify-end",
    "[&_button]:":
      "px-[10px] py-[4px] border-0 bg-transparent text-[length:var(--as-fs-sm)] text-[var(--as-accent)] cursor-pointer",
    "[&_button]:hover:": "underline",
  },

  /* ──────── Config dialog ──────── */
  "as-config-dialog-overlay": dialogOverlay,
  "as-config-dialog-content":
    `${dialogBase} w-[640px] max-w-[92vw] min-h-[480px] max-h-[85vh]`,
  "as-config-dialog-header":
    "flex items-center gap-[12px] px-[20px] py-[14px] border-b border-solid border-[var(--as-border-subtle)] flex-shrink-0",
  "as-config-dialog-title":
    "m-0 text-[length:var(--as-fs-lg)] font-600 text-[var(--as-text)] whitespace-nowrap tracking-[-0.01em]",
  "as-config-dialog-close": {
    "":
      "inline-grid place-items-center w-[28px] h-[28px] p-0 ml-auto border-0 bg-transparent text-[var(--as-text-faint)] rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120 flex-shrink-0",
    "hover:": "bg-[var(--as-hover)] text-[var(--as-text)]",
  },
  "as-config-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-config-tabs-list":
    "flex gap-0 flex-shrink-0 border-b border-solid border-[var(--as-border-subtle)] px-[20px]",
  "as-config-tab-trigger": {
    "":
      "relative px-[14px] py-[10px] border-0 border-b-2 border-solid border-b-transparent bg-transparent text-[length:var(--as-fs-base)] font-500 text-[var(--as-text-subtle)] cursor-pointer whitespace-nowrap outline-none transition-all duration-120",
    "hover:": "text-[var(--as-text)]",
    "data-[state=active]:":
      "text-[var(--as-text)] border-b-[var(--as-accent)] font-600",
  },
  "as-config-tab-content": "flex-1 min-h-0 flex-col",
  "as-config-dialog-footer":
    "flex items-center justify-end gap-[8px] px-[20px] py-[12px] border-t border-solid border-[var(--as-border-subtle)] flex-shrink-0",

  /* ──────── Orderable list (design .clist) ──────── */
  "as-orderable-list-toolbar":
    "flex flex-row-reverse items-center gap-[8px] px-[12px] py-[8px] border-b border-solid border-[var(--as-border-subtle)] flex-shrink-0",
  "as-orderable-list-search": {
    "":
      "flex-1 px-[10px] py-[6px] border border-solid border-[var(--as-border-strong)] rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-[120px] bg-[var(--as-surface)] text-[var(--as-text)]",
    "focus:":
      "border-[var(--as-accent)] shadow-[0_0_0_3px_var(--as-accent-ring)]",
  },
  "as-orderable-list-toolbar-actions":
    "flex gap-[4px] flex-shrink-0",
  "as-orderable-list-toolbar-btn": {
    "":
      "inline-grid place-items-center w-[28px] h-[28px] p-0 border border-solid border-[var(--as-border)] rounded-[var(--as-radius-sm)] bg-[var(--as-surface)] text-[length:var(--as-fs-md)] text-[var(--as-text-muted)] cursor-pointer leading-none transition-all duration-120",
    "hover:": "border-[var(--as-accent)] text-[var(--as-accent)]",
  },

  "as-orderable-list-items":
    "flex-1 overflow-y-auto flex flex-col",
  "as-orderable-list-item": {
    "":
      "relative cursor-grab outline-none transition-[background] duration-120",
    "hover:": "bg-[var(--as-hover)]",
    "data-[highlighted]:": "bg-[var(--as-hover)]",
  },
  "as-orderable-list-item-dragging": "opacity-25",
  "as-orderable-list-item-disabled":
    "pointer-events-none cursor-default",
  "as-orderable-list-item-content":
    "flex items-center gap-[8px] px-[12px] py-[6px] min-h-[32px]",
  "as-orderable-list-checkbox":
    "w-[16px] h-[16px] border-1.5 border-solid border-[var(--as-border-strong)] rounded-[4px] flex items-center justify-center flex-shrink-0 cursor-pointer text-[10px] text-white bg-[var(--as-surface)] transition-all duration-120",
  "as-orderable-list-checkbox-disabled": "opacity-50",
  "as-orderable-list-check-icon":
    "flex items-center justify-center",
  "as-orderable-list-item-body":
    "flex items-center gap-[8px] flex-1 min-w-0",
  "as-orderable-list-item-label":
    "flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[length:var(--as-fs-base)] text-[var(--as-text)]",
  "as-orderable-list-item-actions": {
    "":
      "flex gap-[2px] flex-shrink-0 opacity-0 transition-opacity duration-120",
    "[&_button]:":
      "inline-grid place-items-center w-[22px] h-[22px] p-0 border-0 bg-transparent text-[length:var(--as-fs-xs)] cursor-pointer text-[var(--as-text-faint)] leading-none rounded-[3px] transition-all duration-120",
    "[&_button]:hover:":
      "bg-[var(--as-accent-soft)] text-[var(--as-accent)]",
    "[&_button:disabled]:": "opacity-35 cursor-not-allowed",
  },

  "as-orderable-list-drop-indicator":
    "absolute left-0 right-0 -top-px h-[2px] bg-[var(--as-accent)] pointer-events-none z-[1] before:content-[''] before:absolute before:left-0 before:-top-[2px] before:w-[6px] before:h-[6px] before:bg-[var(--as-accent)] before:rounded-full",

  /* ──────── Sorter ──────── */
  "as-sorter-label":
    "flex items-center gap-[6px] flex-1 min-w-0",
  "as-sorter-direction-btn": {
    "":
      "inline-flex items-center justify-center gap-[4px] h-[24px] px-[8px] border border-solid border-[var(--as-border)] rounded-[var(--as-radius-sm)] bg-[var(--as-surface)] text-[length:var(--as-fs-xs)] text-[var(--as-text-muted)] cursor-pointer leading-none transition-all duration-120 flex-shrink-0",
    "hover:":
      "border-[var(--as-accent)] text-[var(--as-accent)]",
  },
  "as-sorter-direction-disabled": "opacity-50 cursor-default",
  "as-sorter-lock":
    "text-[length:var(--as-fs-sm)] opacity-50 flex-shrink-0",
});
