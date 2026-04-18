import { defineShortcuts } from "@atscript/unocss-preset";

// Color model (vunor):
// - Root stays scope-neutral (vunor default).
// - Elements that paint with the primary palette (hover accent, focus ring,
//   selected/active indicator, primary button, chip) declare `scope-primary`
//   directly on themselves.
// - Elements that paint with the error palette declare `scope-error`.
// - `current-hl`, `current-text` etc. then resolve to the active scope's color.
// - `layer-*` handles bg+text+border auto-flipping for light/dark mode.
// - `border-1` alone reads vunor's preflight neutral border color.
// No `dark:` pairs on utility colors — dark is handled upstream.

const dialogOverlay = "fixed inset-0 bg-black/30 z-[100]";

const dialogBase =
  "layer-1 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] " +
  "rounded-[var(--as-radius-lg)] shadow-[var(--as-shadow-dialog)] " +
  "flex flex-col outline-none border-1";

const smallInputBase =
  "scope-primary flex-1 px-[10px] py-[6px] border-1 " +
  "rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-[120px] " +
  "bg-transparent";

const focusRingHl = "[box-shadow:0_0_0_3px_rgb(var(--current-hl)/0.2)]";

export const asTableShortcuts = defineShortcuts({
  /* ────────── Page-level toolbar (header + search/pill row) ────────── */
  "as-page-header":
    "flex items-start justify-between gap-[16px] px-[24px] pt-[20px] pb-[14px]",
  "as-page-header-titles": "flex flex-col gap-[2px] min-w-0",
  "as-page-header-eyebrow":
    "scope-grey font-mono text-[10px] font-600 tracking-[0.14em] uppercase text-current/70 mb-[6px]",
  "as-page-header-title":
    "m-0 text-[20px] font-600 tracking-[-0.02em] text-scope-dark-0 dark:text-scope-light-0",
  "as-page-header-sub": "text-[length:var(--as-fs-sm)] text-current/70 mt-[2px]",
  "as-page-header-actions": "flex items-center gap-[6px] flex-shrink-0",
  "as-page-toolbar-btn": {
    "":
      "scope-primary inline-flex items-center gap-[6px] h-fingertip-m px-[12px] border-1 rounded-[var(--as-radius)] layer-0 text-[length:var(--as-fs-sm)] font-500 text-current cursor-pointer leading-none transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  "as-page-toolbar":
    "grid grid-cols-[minmax(240px,1fr)_auto] items-center gap-x-[12px] gap-y-[10px] px-[24px] pb-[14px] min-w-0",
  "as-page-search": "relative min-w-0 col-start-1",
  "as-page-search-icon":
    "absolute left-[10px] top-1/2 -translate-y-1/2 text-current/50 pointer-events-none inline-flex text-[14px]",
  "as-page-search-input": {
    "":
      "scope-primary w-full h-fingertip-m pl-[32px] pr-[10px] border-1 rounded-[var(--as-radius)] layer-0 text-current text-[length:var(--as-fs-base)] outline-none transition-[border-color,box-shadow] duration-120 placeholder:text-current/50",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-page-toolbar-right":
    "flex items-center gap-[8px] flex-shrink-0 col-start-2",
  "as-page-pill":
    "scope-grey inline-flex items-center gap-[4px] px-[10px] py-[5px] rounded-[var(--as-radius)] layer-2 text-current/70 text-[length:var(--as-fs-sm)] font-mono whitespace-nowrap",
  "as-page-pill-strong": "text-current font-600",
  "as-page-filters":
    "flex items-center gap-[8px] min-w-0 flex-wrap col-span-2",
  "as-page-clear": {
    "":
      "scope-primary inline-flex items-center gap-[4px] h-fingertip-m px-[10px] border-0 bg-transparent text-current/70 text-[length:var(--as-fs-sm)] cursor-pointer ml-auto transition-colors duration-120",
    "hover:": "text-current-hl",
  },

  /* ────────── Filter pill (label | body | VH) — attached style ────────── */
  "as-fpill": {
    "":
      "scope-primary inline-flex items-stretch h-fingertip-m border-1 rounded-[var(--as-radius)] layer-0 transition-[border-color,box-shadow] duration-120 flex-shrink-0 max-w-[360px] min-w-0 overflow-hidden",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus-within:": `border-current-hl ${focusRingHl}`,
  },
  "as-fpill-active": "scope-primary border-current-hl",
  "as-fpill-label":
    "inline-flex items-center px-[10px] layer-2 text-current/80 text-[length:var(--as-fs-sm)] font-500 border-r-1 whitespace-nowrap flex-shrink-0",
  "as-fpill-label-active":
    "scope-primary bg-current-hl/10 text-current-hl",
  "as-fpill-body":
    "flex items-center gap-[4px] px-[6px] flex-1 min-w-[120px] overflow-hidden cursor-text",
  "as-fpill-input":
    "flex-1 min-w-[40px] border-0 bg-transparent outline-none text-current text-[length:var(--as-fs-base)] p-0 h-full placeholder:text-current/50",
  "as-fpill-chip":
    "scope-primary inline-flex items-center gap-[2px] h-[20px] px-[3px] pl-[6px] bg-current-hl/10 border-1 border-current-hl/40 rounded-[var(--as-radius-sm)] text-[11px] text-current-hl whitespace-nowrap flex-shrink-0",
  "as-fpill-chip-remove": {
    "":
      "cursor-pointer opacity-70 w-[14px] h-[14px] inline-flex items-center justify-center border-0 bg-transparent text-inherit",
    "hover:": "opacity-100",
  },
  "as-fpill-vh": {
    "":
      "scope-primary inline-grid place-items-center w-fingertip-s border-0 border-l-1 bg-transparent text-current/60 cursor-pointer flex-shrink-0 transition-colors duration-120",
    "hover:": "layer-2 text-current-hl",
  },

  /* ────────── Table ────────── */
  "as-table": {
    "": "w-max border-collapse text-[length:var(--as-fs-base)]",
    "[&_thead]:": "layer-2",
    "[&_th]:":
      "px-[12px] py-[8px] text-left font-600 text-[length:var(--as-fs-sm)] text-current/80 border-b-1 whitespace-nowrap overflow-hidden text-ellipsis select-none tracking-[0.01em]",
    "[&_td]:":
      "px-[12px] py-[8px] border-b-1 whitespace-nowrap overflow-hidden text-ellipsis",
    "[&_tbody_tr]:": "transition-colors duration-100",
    "[&_tbody_tr:hover]:": "layer-2",
    "[&_tbody_tr[data-state=checked]]:":
      "scope-primary bg-current-hl/10",
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
      "scope-primary flex items-center justify-between gap-[6px] w-full p-0 m-0 border-0 bg-transparent font-inherit font-600 text-[length:var(--as-fs-sm)] text-current/80 text-left cursor-pointer outline-none whitespace-nowrap",
    "hover:": "text-current-hl",
  },
  "as-th-label": "overflow-hidden text-ellipsis flex-shrink",
  "as-th-indicators": "inline-flex items-center gap-[4px] flex-shrink-0",
  "as-th-sort": "scope-primary text-[length:var(--as-fs-xs)] text-current-hl",
  "as-th-filter-badge":
    "scope-primary inline-flex items-center justify-center min-w-[16px] h-[16px] px-[4px] rounded-full bg-current-hl text-white text-[10px] font-600 leading-none",
  "as-th-chevron": "text-[length:var(--as-fs-xs)] text-current/50",
  "as-cell-number": "text-right tabular-nums font-mono",
  "as-virtual-row": "absolute w-full",
  "as-th-select": "w-[3em] text-center",
  "as-td-select": "w-[3em] text-center",

  "as-table-empty":
    "flex items-center justify-center p-[32px] text-current/60 text-[length:var(--as-fs-md)]",
  "as-table-loading":
    "flex items-center justify-center p-[32px] text-current/60 text-[length:var(--as-fs-md)]",
  "as-table-error":
    "scope-error flex items-center justify-center p-[32px] text-current-hl text-[length:var(--as-fs-md)]",

  /* ────────── Column menu ────────── */
  "as-column-menu-content":
    "layer-1 z-[50] whitespace-nowrap py-[4px] border-1 rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)] min-w-[160px]",
  "as-column-menu-item": {
    "":
      "block w-full px-[12px] py-[6px] border-0 bg-transparent text-current text-left text-[length:var(--as-fs-base)] cursor-pointer outline-none",
    "hover:": "layer-3",
    "data-[highlighted]:": "layer-3",
  },
  "as-column-menu-item-active":
    "scope-primary bg-current-hl/10 text-current-hl font-500",
  "as-column-menu-separator": "h-[1px] bg-layer-3 my-[4px]",

  /* ────────── Filter dialog ────────── */
  "as-filter-dialog-overlay": dialogOverlay,
  "as-filter-dialog-content":
    `${dialogBase} w-[640px] max-w-[92vw] min-h-[520px] max-h-[92vh]`,
  "as-filter-dialog-has-value-help": "w-[900px]",
  "as-filter-dialog-header":
    "flex items-center justify-between gap-[12px] px-[20px] py-[14px] border-b-1",
  "as-filter-dialog-title":
    "m-0 text-[length:var(--as-fs-lg)] font-600 tracking-[-0.01em]",
  "as-filter-dialog-close":
    "c8-flat inline-grid place-items-center w-fingertip-s h-fingertip-s p-0 border-0 rounded-[var(--as-radius-sm)] cursor-pointer leading-none",
  "as-filter-dialog-body":
    "px-[20px] py-[16px] overflow-y-auto flex-1 flex flex-col gap-[12px]",
  "as-filter-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-filter-dialog-tab-content": "flex-1 min-h-0 flex-col overflow-hidden",
  "as-filter-dialog-tab-conditions":
    "px-[20px] py-[16px] overflow-y-auto flex-col gap-[12px]",

  "as-filter-dialog-chips-bar":
    "flex flex-col gap-[6px] px-[20px] py-[8px] border-t-1 flex-shrink-0",
  "as-filter-dialog-chips-header":
    "flex items-center justify-between text-[length:var(--as-fs-sm)] text-current/60",
  "as-filter-dialog-clear-all": {
    "":
      "scope-error c8-flat border-0 bg-transparent text-[length:var(--as-fs-sm)] cursor-pointer p-0",
    "hover:": "underline",
  },
  "as-filter-dialog-chips": "flex flex-wrap gap-[4px]",
  "as-filter-dialog-chip":
    "scope-primary inline-flex items-center gap-[4px] px-[8px] py-[2px] bg-current-hl/10 border-1 border-current-hl/40 rounded-[var(--as-radius-chip)] text-[length:var(--as-fs-sm)] text-current-hl whitespace-nowrap",
  "as-filter-dialog-chip-remove": {
    "":
      "cursor-pointer opacity-70 text-[length:var(--as-fs-md)] leading-none border-0 bg-transparent px-[2px] text-inherit",
    "hover:": "opacity-100",
  },

  /* ────────── Value help tab ──────── */
  "as-filter-value-help": "flex flex-col flex-1 min-h-0",
  "as-filter-value-help-toolbar":
    "flex items-center gap-[8px] px-[16px] py-[8px] border-b-1 flex-shrink-0",
  "as-filter-value-help-search": {
    "": smallInputBase,
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-filter-value-help-count":
    "text-[length:var(--as-fs-sm)] text-current/50 whitespace-nowrap",
  "as-filter-value-help-table": "flex-1 min-h-0 overflow-auto",

  /* ────────── Filter conditions ──────── */
  "as-filter-condition-row": "flex items-start gap-[8px]",
  "as-filter-condition-select": {
    "":
      "scope-primary px-[8px] py-[6px] border-1 rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] min-w-[130px] flex-shrink-0 bg-transparent outline-none cursor-pointer",
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-filter-condition-remove": {
    "":
      "scope-error px-[8px] py-0 border-0 bg-transparent text-[length:var(--as-fs-md)] text-current-hl cursor-pointer leading-none flex-shrink-0",
    "hover:": "opacity-80",
  },
  "as-filter-add-condition": {
    "":
      "scope-primary py-[4px] px-0 border-0 bg-transparent text-[length:var(--as-fs-base)] text-current-hl cursor-pointer text-left",
    "hover:": "underline",
  },

  "as-filter-input": {
    "":
      "scope-primary flex-1 px-[10px] py-[6px] border-1 rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-0 bg-transparent",
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-filter-select": "cursor-pointer",
  "as-filter-input-range": "flex items-center gap-[6px] flex-1",
  "as-filter-input-range-sep": "text-current/50 flex-shrink-0",

  "as-filter-shortcuts":
    "flex flex-wrap items-center gap-[6px] pt-[4px] border-t-1",
  "as-filter-shortcuts-label":
    "text-[length:var(--as-fs-sm)] text-current/50 flex-shrink-0",
  "as-filter-shortcut-btn": {
    "":
      "scope-primary px-[8px] py-[2px] border-1 rounded-[var(--as-radius-sm)] layer-2 text-[length:var(--as-fs-xs)] text-current/70 cursor-pointer whitespace-nowrap transition-all duration-120",
    "hover:": "border-current-hl text-current-hl bg-current-hl/10",
  },

  /* Footer */
  "as-filter-dialog-footer":
    "flex items-center justify-between px-[20px] py-[12px] border-t-1",
  "as-filter-dialog-footer-right": "flex gap-[8px]",
  "as-filter-btn": {
    "":
      "inline-flex items-center justify-center h-fingertip-m px-[16px] border-1 rounded-[var(--as-radius)] bg-transparent text-[length:var(--as-fs-base)] font-500 cursor-pointer transition-all duration-120",
    "hover:": "layer-3",
  },
  "as-filter-btn-apply": "scope-primary c8-filled",
  "as-filter-btn-clear":
    "scope-error c8-flat border-0 bg-transparent px-[8px] py-[6px]",

  /* ────────── Filter field (attached label + body + VH) ──────── */
  "as-filter-field": {
    "":
      "scope-primary inline-flex items-stretch h-fingertip-m border-1 rounded-[var(--as-radius)] layer-0 min-w-[180px] max-w-[360px] flex-shrink-0 overflow-hidden transition-[border-color,box-shadow] duration-120 text-[length:var(--as-fs-base)]",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus-within:": `border-current-hl ${focusRingHl}`,
  },
  "as-filter-field-label":
    "inline-flex items-center px-[10px] layer-2 text-current/80 text-[length:var(--as-fs-sm)] font-500 border-r-1 whitespace-nowrap flex-shrink-0",
  "as-filter-field-body":
    "flex items-center gap-[4px] flex-1 min-w-0 px-[6px]",
  "as-filter-field-input":
    "flex items-center gap-[4px] flex-1 min-w-0 cursor-text flex-wrap h-full",
  "as-filter-field-chip":
    "scope-primary inline-flex items-center gap-[2px] h-[20px] px-[3px] pl-[6px] bg-current-hl/10 border-1 border-current-hl/40 rounded-[var(--as-radius-sm)] text-[11px] text-current-hl whitespace-nowrap flex-shrink-0",
  "as-filter-field-chip-remove": {
    "":
      "cursor-pointer opacity-70 w-[14px] h-[14px] inline-flex items-center justify-center text-[length:var(--as-fs-sm)] leading-none",
    "hover:": "opacity-100",
  },
  "as-filter-field-search":
    "border-0 outline-none flex-1 min-w-[40px] text-[length:var(--as-fs-base)] bg-transparent placeholder:text-current/50 h-full",
  "as-filter-field-f4": {
    "":
      "scope-primary inline-grid place-items-center w-fingertip-s border-0 border-l-1 bg-transparent text-current/60 cursor-pointer flex-shrink-0 transition-colors duration-120 text-[length:var(--as-fs-md)] leading-none",
    "hover:": "layer-2 text-current-hl",
  },
  "as-filter-field-dropdown":
    "layer-1 z-[50] border-1 rounded-[var(--as-radius-lg)] shadow-[var(--as-shadow-dialog)] min-w-[320px] max-w-[560px] flex flex-col outline-none w-[max(var(--reka-popper-anchor-width,320px),320px)]",
  "as-filter-field-dropdown-footer": {
    "":
      "flex gap-[8px] px-[8px] py-[6px] border-t-1 justify-end",
    "[&_button]:":
      "scope-primary px-[10px] py-[4px] border-0 bg-transparent text-[length:var(--as-fs-sm)] text-current-hl cursor-pointer",
    "[&_button]:hover:": "underline",
  },

  /* ────────── Config dialog ──────── */
  "as-config-dialog-overlay": dialogOverlay,
  "as-config-dialog-content":
    `${dialogBase} w-[640px] max-w-[92vw] min-h-[480px] max-h-[85vh]`,
  "as-config-dialog-header":
    "flex items-center gap-[12px] px-[20px] py-[14px] border-b-1 flex-shrink-0",
  "as-config-dialog-title":
    "m-0 text-[length:var(--as-fs-lg)] font-600 whitespace-nowrap tracking-[-0.01em]",
  "as-config-dialog-close":
    "c8-flat inline-grid place-items-center w-fingertip-s h-fingertip-s p-0 ml-auto border-0 rounded-[var(--as-radius-sm)] cursor-pointer leading-none flex-shrink-0",
  "as-config-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-config-tabs-list":
    "flex gap-0 flex-shrink-0 border-b-1 px-[20px]",
  "as-config-tab-trigger": {
    "":
      "scope-primary relative px-[14px] py-[10px] border-0 border-b-2 border-b-transparent bg-transparent text-[length:var(--as-fs-base)] font-500 text-current/60 cursor-pointer whitespace-nowrap outline-none transition-all duration-120",
    "hover:": "text-current",
    "data-[state=active]:":
      "text-current [border-bottom-color:rgb(var(--current-hl))] font-600",
  },
  "as-config-tab-content": "flex-1 min-h-0 flex-col",
  "as-config-dialog-footer":
    "flex items-center justify-end gap-[8px] px-[20px] py-[12px] border-t-1 flex-shrink-0",

  /* ────────── Orderable list (design .clist) ──────── */
  "as-orderable-list-toolbar":
    "flex flex-row-reverse items-center gap-[8px] px-[12px] py-[8px] border-b-1 flex-shrink-0",
  "as-orderable-list-search": {
    "": smallInputBase,
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-orderable-list-toolbar-actions":
    "flex gap-[4px] flex-shrink-0",
  "as-orderable-list-toolbar-btn": {
    "":
      "scope-primary inline-grid place-items-center w-fingertip-s h-fingertip-s p-0 border-1 rounded-[var(--as-radius-sm)] bg-transparent text-[length:var(--as-fs-md)] text-current/60 cursor-pointer leading-none transition-all duration-120",
    "hover:": "border-current-hl text-current-hl",
  },

  "as-orderable-list-items":
    "flex-1 overflow-y-auto flex flex-col",
  "as-orderable-list-item": {
    "":
      "relative cursor-grab outline-none transition-colors duration-120",
    "hover:": "layer-2",
    "data-[highlighted]:": "layer-3",
  },
  "as-orderable-list-item-dragging": "opacity-25",
  "as-orderable-list-item-disabled":
    "pointer-events-none cursor-default",
  "as-orderable-list-item-content":
    "flex items-center gap-[8px] px-[12px] py-[6px] min-h-fingertip-m",
  "as-orderable-list-checkbox":
    "w-[16px] h-[16px] border-1.5 rounded-[4px] flex items-center justify-center flex-shrink-0 cursor-pointer text-[10px] text-white bg-transparent transition-all duration-120",
  "as-orderable-list-checkbox-disabled": "opacity-50",
  "as-orderable-list-check-icon": "flex items-center justify-center",
  "as-orderable-list-item-body":
    "flex items-center gap-[8px] flex-1 min-w-0",
  "as-orderable-list-item-label":
    "flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[length:var(--as-fs-base)]",
  "as-orderable-list-item-actions": {
    "":
      "scope-primary flex gap-[2px] flex-shrink-0 opacity-0 transition-opacity duration-120",
    "[&_button]:":
      "inline-grid place-items-center w-[22px] h-[22px] p-0 border-0 bg-transparent text-[length:var(--as-fs-xs)] cursor-pointer text-current/50 leading-none rounded-[3px] transition-all duration-120",
    "[&_button]:hover:": "bg-current-hl/10 text-current-hl",
    "[&_button:disabled]:": "opacity-35 cursor-not-allowed",
  },

  "as-orderable-list-drop-indicator":
    "scope-primary absolute left-0 right-0 -top-px h-[2px] bg-current-hl pointer-events-none z-[1] before:content-[''] before:absolute before:left-0 before:-top-[2px] before:w-[6px] before:h-[6px] before:bg-current-hl before:rounded-full",

  /* ────────── Sorter ──────── */
  "as-sorter-label":
    "flex items-center gap-[6px] flex-1 min-w-0",
  "as-sorter-direction-btn": {
    "":
      "scope-primary inline-flex items-center justify-center gap-[4px] h-[24px] px-[8px] border-1 rounded-[var(--as-radius-sm)] bg-transparent text-[length:var(--as-fs-xs)] text-current/60 cursor-pointer leading-none transition-all duration-120 flex-shrink-0",
    "hover:": "border-current-hl text-current-hl",
  },
  "as-sorter-direction-disabled": "opacity-50 cursor-default",
  "as-sorter-lock":
    "text-[length:var(--as-fs-sm)] opacity-50 flex-shrink-0",
});
