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
  "layer-0 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] " +
  "rounded-[var(--as-radius-lg)] shadow-[var(--as-shadow-dialog)] " +
  "flex flex-col outline-none border-1";

const smallInputBase =
  "scope-primary flex-1 h-fingertip-s px-[10px] border-1 " +
  "rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-[120px] " +
  "layer-0";

const chipBase =
  "inline-flex items-center px-[8px] py-[2px] rounded-[var(--as-radius-chip)] " +
  "text-[length:var(--as-fs-sm)] whitespace-nowrap";

const focusRingHl = "[box-shadow:0_0_0_3px_rgb(var(--current-hl)/0.2)]";

const menuItemIconHl = "[&_.as-column-menu-item-icon]:text-current-hl";

export const asTableShortcuts = defineShortcuts({
  /* ────────── Generic utilities ────────── */
  "as-spacer": "grow",

  /* ────────── Page-level toolbar (header + search/pill row) ────────── */
  "as-page-header": "flex items-start justify-between gap-[16px] px-[24px] pt-[20px] pb-[14px]",
  "as-page-header-titles": "flex flex-col gap-[2px] min-w-0",
  "as-page-header-eyebrow":
    "scope-grey font-mono text-[10px] font-600 tracking-[0.14em] uppercase text-current/70 mb-[6px]",
  "as-page-header-title":
    "m-0 text-[20px] font-600 tracking-[-0.02em] text-scope-dark-0 dark:text-scope-light-0",
  "as-page-header-sub": "text-[length:var(--as-fs-sm)] text-current/70 mt-[2px]",
  "as-page-header-actions": "flex items-center gap-[6px] flex-shrink-0",
  "as-page-toolbar-btn": {
    "": "scope-primary inline-flex items-center gap-[6px] h-fingertip-m px-[12px] border-1 rounded-[var(--as-radius)] layer-0 text-[length:var(--as-fs-sm)] font-500 text-current cursor-pointer leading-none transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  "as-page-toolbar":
    "grid grid-cols-[minmax(240px,1fr)_auto] items-center gap-x-[12px] gap-y-[10px] px-[24px] pb-[14px] min-w-0",
  "as-page-search": "relative min-w-0 col-start-1",
  "as-page-search-icon":
    "absolute left-[10px] top-1/2 -translate-y-1/2 text-current/50 pointer-events-none inline-flex text-[14px]",
  "as-page-search-input": {
    "": "scope-primary w-full h-fingertip-m pl-[32px] pr-[10px] border-1 rounded-[var(--as-radius)] layer-0 text-current text-[length:var(--as-fs-base)] outline-none transition-[border-color,box-shadow] duration-120 placeholder:text-current/50",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-page-toolbar-right": "flex items-center gap-[8px] flex-shrink-0 col-start-2",
  "as-page-pill":
    "scope-grey inline-flex items-center gap-[4px] px-[10px] py-[5px] rounded-[var(--as-radius)] layer-2 text-current/70 text-[length:var(--as-fs-sm)] font-mono whitespace-nowrap",
  "as-page-pill-strong": "text-current font-600",
  "as-page-filters": "flex items-center gap-[8px] min-w-0 flex-wrap col-span-2",
  "as-page-clear": {
    "": "scope-primary inline-flex items-center gap-[4px] h-fingertip-m px-[10px] border-0 bg-transparent text-current/70 text-[length:var(--as-fs-sm)] cursor-pointer ml-auto transition-colors duration-120",
    "hover:": "text-current-hl",
  },

  /* ────────── Filter pill (label | body | VH) — attached style ────────── */
  "as-fpill": {
    "": "scope-primary inline-flex items-stretch h-fingertip-m border-1 rounded-[var(--as-radius)] layer-0 transition-[border-color,box-shadow] duration-120 flex-shrink-0 max-w-[360px] min-w-0 overflow-hidden",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus-within:": `border-current-hl ${focusRingHl}`,
  },
  "as-fpill-active": "scope-primary border-current-hl",
  "as-fpill-label":
    "inline-flex items-center px-[10px] layer-2 text-current/80 text-[length:var(--as-fs-sm)] font-500 border-r-1 whitespace-nowrap flex-shrink-0",
  "as-fpill-label-active": "scope-primary bg-current-hl/10 text-current-hl",
  "as-fpill-body":
    "flex items-center gap-[4px] px-[6px] flex-1 min-w-[120px] overflow-hidden cursor-text",
  "as-fpill-input":
    "flex-1 min-w-[40px] border-0 bg-transparent outline-none text-current text-[length:var(--as-fs-base)] p-0 h-full placeholder:text-current/50",
  "as-fpill-chip":
    "scope-primary inline-flex items-center gap-[2px] h-[20px] px-[3px] pl-[6px] bg-current-hl/10 border-1 border-current-hl/40 rounded-[var(--as-radius-sm)] text-[11px] text-current-hl whitespace-nowrap flex-shrink-0",
  "as-fpill-chip-remove": {
    "": "cursor-pointer opacity-70 w-[14px] h-[14px] inline-flex items-center justify-center border-0 bg-transparent text-inherit",
    "hover:": "opacity-100",
  },
  "as-fpill-vh": {
    "": "scope-primary inline-grid place-items-center w-fingertip-s border-0 border-l-1 bg-transparent text-current/60 cursor-pointer flex-shrink-0 transition-colors duration-120",
    "hover:": "layer-2 text-current-hl",
  },

  /* ────────── Table ────────── */
  "as-table": {
    "": "w-max border-collapse text-[length:var(--as-fs-base)]",
    "[&_thead]:": "layer-1",
    "[&_th]:":
      "px-[12px] py-[8px] text-left font-600 text-[length:var(--as-fs-sm)] text-current/80 border-b-1 whitespace-nowrap overflow-hidden text-ellipsis select-none tracking-[0.01em]",
    "[&_td]:": "px-[12px] py-[8px] border-b-1 whitespace-nowrap overflow-hidden text-ellipsis",
    "[&_tbody_tr]:": "transition-colors duration-100",
    "[&_tbody_tr:hover]:": "layer-1",
    "[&_tbody_tr[data-state=checked]]:": "scope-primary bg-current-hl/10",
  },
  "as-table-stretch": "min-w-full",
  "as-table-sticky": {
    "[&_thead]:": "sticky top-0 z-[1]",
  },
  "as-table-scroll-container": "flex-1 min-h-0 overflow-auto",
  // Outer wrapper used by AsTable (around AsTableBase). Provides flex sizing
  // but NO overflow — the inner as-table-scroll-container is the sole scroller,
  // so horizontal scrollbars stay at the bottom of the viewport rather than the
  // bottom of the full content height.
  "as-table-outer-wrap": "flex flex-col flex-1 min-h-0",
  "as-th-filler": "p-0 w-auto",
  "as-td-filler": "p-0 w-auto",

  "as-th-btn": {
    "": "scope-primary flex items-center justify-between gap-[6px] w-full p-0 m-0 border-0 bg-transparent font-inherit font-600 text-[length:var(--as-fs-sm)] text-current/80 text-left cursor-pointer outline-none whitespace-nowrap",
    "hover:": "text-current-hl",
  },
  "as-th-label": "overflow-hidden text-ellipsis flex-shrink",
  "as-th-indicators": "inline-flex items-center gap-[4px] flex-shrink-0",
  "as-th-sort": "scope-primary inline-flex text-[14px] text-current-hl",
  "as-th-filter-badge":
    "scope-primary inline-flex items-center justify-center min-w-[16px] h-[16px] px-[4px] rounded-full bg-current-hl text-white text-[10px] font-600 leading-none",
  "as-th-chevron": "inline-flex text-[14px] text-current/50",
  "as-cell-number": "text-right tabular-nums font-mono",
  "as-virtual-row": "absolute w-full",
  "as-th-select": "w-[3em] text-center",
  "as-td-select": "w-[3em] text-center",
  "as-table-checkbox": {
    "": "scope-primary inline-flex align-middle w-[16px] h-[16px] border-1.5 border-scope-light-3 dark:border-scope-dark-3 rounded-[4px] items-center justify-center layer-0 cursor-pointer transition-all duration-120",
    "[tr[data-state=checked]_&]:": "bg-current-hl border-current-hl",
    "[tr[aria-selected=true]_&]:": "bg-current-hl border-current-hl",
  },
  "as-table-checkbox-checked": "scope-primary bg-current-hl border-current-hl",
  "as-table-checkbox-indeterminate": "scope-primary bg-current-hl border-current-hl",
  "as-table-checkbox-tick": "text-white text-[10px] leading-none",
  "as-table-checkbox-dash": "w-[8px] h-[1.75px] bg-white rounded-[1px] block",

  "as-table-empty":
    "flex items-center justify-center p-[32px] text-current/60 text-[length:var(--as-fs-md)]",
  "as-table-loading":
    "flex items-center justify-center p-[32px] text-current/60 text-[length:var(--as-fs-md)]",
  "as-table-error":
    "scope-error flex items-center justify-center p-[32px] text-current-hl text-[length:var(--as-fs-md)]",

  /* ────────── Column menu ────────── */
  "as-column-menu-content":
    "layer-0 z-[200] whitespace-nowrap py-[4px] border-1 rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)] min-w-[220px]",
  "as-column-menu-label":
    "scope-grey px-[12px] pt-[8px] pb-[4px] text-[10px] font-mono font-600 tracking-[0.14em] uppercase text-current/50",
  "as-column-menu-item": {
    "": "flex items-center gap-[10px] w-full px-[12px] py-[6px] border-0 bg-transparent text-current text-left text-[length:var(--as-fs-base)] cursor-pointer outline-none",
    "hover:": "layer-3",
    "data-[highlighted]:": "layer-3",
  },
  "as-column-menu-item-icon": "inline-flex text-[16px] text-current/60 shrink-0",
  "as-column-menu-item-label": "flex-1 min-w-0 overflow-hidden text-ellipsis",
  "as-column-menu-item-hint":
    "scope-grey inline-flex items-center justify-center min-w-[20px] h-[20px] px-[5px] rounded-[var(--as-radius-sm)] layer-2 text-[10px] font-mono font-600 text-current/70 leading-none shrink-0",
  "as-column-menu-item-badge":
    "scope-primary inline-flex items-center justify-center min-w-[20px] h-[20px] px-[5px] rounded-[var(--as-radius-sm)] bg-current-hl/10 text-current-hl text-[10px] font-mono font-600 leading-none shrink-0",
  "as-column-menu-item-active":
    `scope-primary bg-current-hl/10 text-current-hl font-500 ${menuItemIconHl}`,
  "as-column-menu-item-danger": {
    "": `scope-error text-current-hl ${menuItemIconHl}`,
    "hover:": "bg-current-hl/10",
    "data-[highlighted]:": "bg-current-hl/10",
  },
  "as-column-menu-separator": "h-[1px] my-[4px] bg-scope-light-2 dark:bg-scope-dark-2",

  /* ────────── Filter dialog ────────── */
  "as-filter-dialog-overlay": dialogOverlay,
  "as-filter-dialog-content": `${dialogBase} w-[560px] max-w-[92vw] min-h-[480px] max-h-[92vh]`,
  "as-filter-dialog-has-value-help": "w-[640px]",
  "as-filter-dialog-header":
    "flex items-center justify-between gap-[12px] px-[20px] py-[14px] border-b-1",
  "as-filter-dialog-title":
    "m-0 text-[length:var(--as-fs-lg)] font-600 tracking-[-0.01em] flex items-center gap-[8px]",
  "as-filter-dialog-title-label": "text-current/60 font-500",
  "as-filter-dialog-title-value": "text-current font-600",
  "as-filter-dialog-close": {
    "": "inline-grid place-items-center w-fingertip-m h-fingertip-m p-0 border-0 bg-transparent text-current/80 cursor-pointer leading-none rounded-[var(--as-radius-sm)] transition-colors duration-120 text-[20px]",
    "hover:": "layer-2 text-current",
  },
  "as-filter-dialog-body": "px-[20px] py-[16px] overflow-y-auto flex-1 flex flex-col gap-[12px]",
  "as-filter-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-filter-dialog-tab-content":
    "flex flex-col flex-1 min-h-0 overflow-hidden data-[state=inactive]:hidden",
  "as-filter-dialog-tab-conditions": "px-[20px] py-[16px] overflow-y-auto flex-col gap-[12px]",

  "as-filter-dialog-chips-bar":
    "layer-1 flex flex-col gap-[8px] px-[20px] py-[12px] border-t-1 flex-shrink-0 max-h-[160px] overflow-y-auto",
  "as-filter-dialog-chips-header":
    "flex items-center justify-between text-[length:var(--as-fs-sm)] text-current/60",
  "as-filter-dialog-chips-count": "text-current font-600",
  "as-filter-dialog-clear-all": {
    "": "border-0 bg-transparent text-[length:var(--as-fs-sm)] font-500 text-current/70 cursor-pointer p-0 whitespace-nowrap",
    "hover:": "underline text-current",
  },
  "as-filter-dialog-chips": "flex flex-wrap gap-[4px]",
  "as-filter-dialog-chip": `scope-primary ${chipBase} gap-[4px] bg-current-hl/10 border-1 border-current-hl/40 text-current-hl`,
  "as-filter-dialog-chips-more": `scope-grey ${chipBase} text-current/70 font-500 italic`,
  "as-filter-dialog-chip-remove": {
    "": "inline-grid place-items-center w-[18px] h-[18px] cursor-pointer opacity-70 leading-none border-0 bg-transparent text-inherit text-[13px]",
    "hover:": "opacity-100",
  },

  /* ────────── Value help tab ──────── */
  "as-filter-value-help":
    "flex flex-col flex-1 min-h-0 mx-[20px] my-[16px] border-1 rounded-[var(--as-radius)] overflow-hidden",
  "as-filter-value-help-toolbar":
    "layer-1 flex items-center gap-[8px] px-[12px] py-[10px] border-b-1 flex-shrink-0",
  "as-filter-value-help-filters":
    "layer-1 flex items-center flex-wrap gap-[6px] px-[12px] py-[8px] border-b-1 flex-shrink-0 empty:hidden",
  "as-filter-value-help-search": {
    "": smallInputBase,
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-filter-value-help-count":
    "inline-flex items-center gap-[8px] ml-auto text-[length:var(--as-fs-sm)] text-current/50 whitespace-nowrap flex-shrink-0",
  "as-filter-value-help-filters-toggle": {
    "": "inline-grid place-items-center w-fingertip-s h-fingertip-s border-1 rounded-[var(--as-radius-sm)] layer-0 text-current/70 cursor-pointer text-[length:var(--as-fs-md)] leading-none transition-colors duration-120",
    "hover:": "layer-2 text-current",
  },
  "as-filter-value-help-filters-toggle-active":
    "scope-primary bg-current-hl/10 border-current-hl text-current-hl",
  "as-filter-value-help-table": "flex flex-col flex-1 min-h-0 overflow-hidden",

  /* ────────── Filter conditions ──────── */
  "as-filter-condition-row": "grid grid-cols-[150px_1fr_28px] gap-[8px] items-center",
  "as-filter-condition-select": {
    "": "scope-primary h-fingertip-m px-[10px] pr-[28px] border-1 rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] min-w-0 layer-0 outline-none cursor-pointer appearance-none",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-filter-condition-remove": {
    "": "inline-grid place-items-center w-fingertip-s h-fingertip-s border-0 bg-transparent text-current/70 cursor-pointer rounded-[var(--as-radius-sm)] leading-none flex-shrink-0 transition-colors duration-120 text-[16px]",
    "hover:": "scope-error layer-2 text-current-hl",
  },
  "as-filter-add-condition": {
    "": "scope-primary py-[4px] px-0 border-0 bg-transparent text-[length:var(--as-fs-base)] text-current-hl cursor-pointer text-left",
    "hover:": "underline",
  },

  "as-filter-input": {
    "": "scope-primary flex-1 h-fingertip-m px-[10px] border-1 rounded-[var(--as-radius)] text-[length:var(--as-fs-base)] outline-none min-w-0 layer-0",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-filter-input-disabled":
    "flex-1 h-fingertip-m layer-1 rounded-[var(--as-radius)] border-1 min-w-0",
  "as-filter-select": "cursor-pointer",
  "as-filter-input-range": "flex items-center gap-[6px] flex-1",
  "as-filter-input-range-sep": "text-current/50 flex-shrink-0",

  "as-filter-shortcuts": "flex flex-wrap items-center gap-[6px] pt-[4px] border-t-1",
  "as-filter-shortcuts-label": "text-[length:var(--as-fs-sm)] text-current/50 flex-shrink-0",
  "as-filter-shortcut-btn": {
    "": "scope-primary px-[8px] py-[2px] border-1 rounded-[var(--as-radius-sm)] layer-2 text-[length:var(--as-fs-xs)] text-current/70 cursor-pointer whitespace-nowrap transition-all duration-120",
    "hover:": "border-current-hl text-current-hl bg-current-hl/10",
  },

  /* Footer */
  "as-filter-dialog-footer": "flex items-center gap-[8px] px-[20px] py-[12px] border-t-1",
  "as-filter-dialog-footer-right": "flex gap-[8px] ml-auto",
  "as-filter-btn":
    "scope-neutral c8-chrome inline-flex items-center justify-center h-fingertip-m px-[14px] text-[length:var(--as-fs-base)] font-600 cursor-pointer",
  "as-filter-btn-apply":
    "scope-primary c8-filled inline-flex items-center justify-center h-fingertip-m px-[14px] text-[length:var(--as-fs-base)] font-500 cursor-pointer",
  "as-filter-btn-clear": {
    "": "scope-error inline-flex items-center h-fingertip-m px-[8px] border-0 bg-transparent text-[length:var(--as-fs-sm)] font-500 text-current-hl cursor-pointer",
    "hover:": "underline",
  },
  "as-filter-btn-ghost": {
    "": "inline-flex items-center h-fingertip-m px-[10px] border-0 bg-transparent text-[length:var(--as-fs-sm)] text-current/70 font-500 cursor-pointer rounded-[var(--as-radius)] transition-colors duration-120",
    "hover:": "layer-2 text-current",
  },

  /* ────────── Filter field (attached label + body + VH) ──────── */
  "as-filter-field": {
    "": "scope-primary inline-flex items-stretch h-fingertip-m border-1 rounded-[var(--as-radius)] layer-0 min-w-[180px] max-w-[360px] flex-shrink-0 overflow-hidden transition-[border-color,box-shadow] duration-120 text-[length:var(--as-fs-base)]",
    "hover:": "border-scope-light-3 dark:border-scope-dark-3",
    "focus-within:": `border-current-hl ${focusRingHl}`,
  },
  "as-filter-field-label": {
    "": "inline-flex items-center px-[10px] layer-2 text-current/80 text-[length:var(--as-fs-sm)] font-500 border-r-1 whitespace-nowrap flex-shrink-0 transition-colors duration-120",
    "[.as-filter-field:focus-within_&]:": "bg-current-hl/10 text-current-hl font-600",
  },
  "as-filter-field-body": "flex items-stretch gap-[4px] flex-1 min-w-0 pl-[6px]",
  "as-filter-field-input": "flex items-center gap-[4px] flex-1 min-w-0 h-full cursor-text flex-wrap",
  "as-filter-field-chip":
    "scope-primary inline-flex items-center gap-[2px] h-[20px] px-[3px] pl-[6px] bg-current-hl/10 border-1 border-current-hl/40 rounded-[var(--as-radius-sm)] text-[11px] text-current-hl whitespace-nowrap flex-shrink-0",
  "as-filter-field-chip-remove": {
    "": "cursor-pointer opacity-70 w-[14px] h-[14px] inline-grid place-items-center text-[12px] leading-none",
    "hover:": "opacity-100",
  },
  "as-filter-field-search":
    "border-0 outline-none flex-1 min-w-[40px] p-0 m-0 text-[length:var(--as-fs-base)] bg-transparent placeholder:text-current/50",
  "as-filter-field-f4": {
    "": "scope-primary inline-grid place-items-center w-fingertip-s border-0 border-l-1 bg-transparent text-current/70 cursor-pointer flex-shrink-0 transition-colors duration-120 text-[16px] leading-none",
    "hover:": "layer-2 text-current-hl",
    "[.as-filter-field:focus-within_&]:": "text-current-hl",
  },
  "as-filter-field-dropdown":
    "layer-0 z-[200] border-1 rounded-[var(--as-radius-lg)] shadow-[var(--as-shadow-dialog)] min-w-[320px] max-w-[560px] flex flex-col outline-none w-[max(var(--reka-popper-anchor-width,320px),320px)]",
  "as-filter-field-dropdown-footer": {
    "": "flex gap-[8px] px-[8px] py-[6px] border-t-1 justify-end",
    "[&_button]:":
      "scope-primary px-[10px] py-[4px] border-0 bg-transparent text-[length:var(--as-fs-sm)] text-current-hl cursor-pointer",
    "[&_button:hover]:": "underline",
  },

  /* ────────── Config dialog ──────── */
  "as-config-dialog-overlay": dialogOverlay,
  "as-config-dialog-content": `${dialogBase} w-[640px] max-w-[92vw] min-h-[480px] max-h-[85vh]`,
  "as-config-dialog-header":
    "flex items-center gap-[12px] px-[20px] py-[14px] border-b-1 flex-shrink-0",
  "as-config-dialog-title":
    "m-0 text-[length:var(--as-fs-lg)] font-600 whitespace-nowrap tracking-[-0.01em]",
  "as-config-dialog-close": {
    "": "inline-grid place-items-center w-fingertip-m h-fingertip-m p-0 ml-auto border-0 bg-transparent text-current/80 cursor-pointer leading-none rounded-[var(--as-radius-sm)] flex-shrink-0 transition-colors duration-120 text-[20px]",
    "hover:": "layer-2 text-current",
  },
  "as-config-dialog-tabs": "flex flex-col flex-1 min-h-0",
  "as-config-tabs-list": "flex gap-0 flex-shrink-0 border-b-1 px-[20px]",
  "as-config-tab-trigger": {
    "": "scope-primary relative inline-flex items-center gap-[8px] px-[14px] py-[10px] border-0 border-b-2 border-b-transparent bg-transparent text-[length:var(--as-fs-base)] font-500 text-current/60 cursor-pointer whitespace-nowrap outline-none transition-all duration-120",
    "hover:": "text-current",
    "data-[state=active]:": "text-current [border-bottom-color:rgb(var(--current-hl))] font-600",
  },
  "as-config-tab-icon": "inline-block w-[16px] h-[16px] text-[16px] shrink-0",

  /* Config tab summary line — "6 of 8 columns visible" + hint */
  "as-config-tab-summary": "flex flex-col gap-[2px] px-[20px] py-[10px] border-t-1 flex-shrink-0",
  "as-config-tab-summary-count": "text-[length:var(--as-fs-sm)] text-current font-500",
  "as-config-tab-summary-count-num": "font-600",
  "as-config-tab-summary-hint": "text-[length:var(--as-fs-xs)] text-current/60",

  /* Value-help empty state (no search/filter match) */
  "as-vh-empty":
    "flex flex-col items-center justify-center gap-[12px] py-[24px] px-[16px] text-center",
  "as-vh-empty-icon":
    "scope-grey inline-grid place-items-center w-[48px] h-[48px] rounded-full layer-2 text-current/60 text-[20px] flex-shrink-0",
  "as-vh-empty-title": "text-[length:var(--as-fs-md)] font-600 text-current m-0",
  "as-vh-empty-body":
    "text-[length:var(--as-fs-sm)] text-current/60 max-w-[44ch] leading-[1.5] m-0",
  "as-vh-empty-code":
    "scope-grey font-mono text-current bg-current-hl/10 rounded-[var(--as-radius-sm)] px-[4px]",
  "as-vh-empty-clear":
    "c8-outlined inline-flex items-center gap-[6px] h-fingertip-s px-[12px] text-[length:var(--as-fs-sm)] font-600 cursor-pointer rounded-[var(--as-radius)]",
  "as-config-tab-content": "flex flex-col flex-1 min-h-0 data-[state=inactive]:hidden",
  "as-config-dialog-footer":
    "flex items-center gap-[8px] px-[20px] py-[12px] border-t-1 flex-shrink-0",

  /* ────────── Orderable list (design .clist) ──────── */
  "as-orderable-list-box":
    "flex flex-col flex-1 min-h-0 mx-[20px] my-[16px] border-1 rounded-[var(--as-radius)] overflow-hidden",
  "as-orderable-list-toolbar":
    "layer-1 flex items-center gap-[8px] px-[12px] py-[10px] border-b-1 flex-shrink-0",
  "as-orderable-list-search": {
    "": smallInputBase,
    "focus:": `border-current-hl! ${focusRingHl}`,
  },
  "as-orderable-list-toolbar-actions": "flex gap-[4px] flex-shrink-0",
  "as-orderable-list-toolbar-btn": {
    "": "scope-neutral c8-chrome inline-flex items-center justify-center h-fingertip-s px-[12px] text-[length:var(--as-fs-sm)] font-600 cursor-pointer leading-none whitespace-nowrap",
  },

  "as-orderable-list-items": "flex-1 overflow-y-auto flex flex-col",
  "as-orderable-list-item": {
    "": "relative cursor-pointer outline-none transition-colors duration-120 border-b-1 last:border-b-0",
    "hover:": "layer-1",
    "data-[highlighted]:": "layer-1",
  },
  "as-orderable-list-item-dragging": "opacity-25",
  "as-orderable-list-item-disabled": "pointer-events-none cursor-default",
  "as-orderable-list-item-content":
    "flex items-center gap-[8px] px-[8px] py-[2px] min-h-fingertip-s",
  "as-orderable-list-grip":
    "inline-grid place-items-center w-[20px] h-[20px] text-current/40 cursor-grab active:cursor-grabbing shrink-0 text-[16px] hover:text-current/70",
  "as-orderable-list-grip-disabled": "opacity-40 cursor-default pointer-events-none",
  "as-orderable-list-checkbox": {
    "": "scope-primary w-[16px] h-[16px] border-1.5 border-scope-light-3 dark:border-scope-dark-3 rounded-[4px] flex items-center justify-center flex-shrink-0 cursor-pointer text-[10px] layer-0 transition-all duration-120",
    "group-data-[state=checked]:": "bg-current-hl border-current-hl text-white",
    "group-aria-selected:": "bg-current-hl border-current-hl text-white",
  },
  "as-orderable-list-checkbox-disabled": "opacity-50",
  "as-orderable-list-check-icon": "flex items-center justify-center text-white",
  "as-orderable-list-item-body": "flex items-center gap-[8px] flex-1 min-w-0",
  "as-orderable-list-item-label":
    "flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[length:var(--as-fs-base)]",
  "as-orderable-list-item-actions": {
    "": "scope-primary inline-flex items-center gap-[2px] p-[2px] border-1 rounded-[var(--as-radius)] layer-0 flex-shrink-0 opacity-0 pointer-events-none transition-opacity duration-120 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto shadow-[var(--as-shadow-dialog)]",
    "[&_button]:":
      "inline-grid place-items-center w-[22px] h-[22px] p-0 border-0 bg-transparent cursor-pointer text-current/60 leading-none rounded-[var(--as-radius-sm)] transition-colors duration-120 text-[length:var(--as-fs-xs)]",
    "[&_button:hover:not(:disabled)]:": "bg-current-hl/10 text-current-hl",
    "[&_button:disabled]:": "opacity-35 cursor-not-allowed",
  },

  "as-orderable-list-drop-indicator":
    "scope-primary absolute left-0 right-0 -top-px h-[2px] bg-current-hl pointer-events-none z-[1] before:content-[''] before:absolute before:left-0 before:-top-[2px] before:w-[6px] before:h-[6px] before:bg-current-hl before:rounded-full",

  /* ────────── Sorter ──────── */
  "as-sorter-label": "flex items-center gap-[8px] flex-1 min-w-0",
  "as-sorter-index":
    "scope-grey inline-grid place-items-center w-[20px] h-[20px] rounded-[var(--as-radius-sm)] layer-2 text-[length:var(--as-fs-xs)] text-current/70 font-mono font-500 flex-shrink-0",
  "as-sorter-segment": {
    "": "inline-flex items-stretch gap-0 p-[2px] border-1 rounded-[var(--as-radius)] layer-0 flex-shrink-0",
  },
  "as-sorter-segment-btn": {
    "": "scope-primary inline-flex items-center gap-[4px] h-[22px] px-[8px] border-0 bg-transparent text-[length:var(--as-fs-xs)] text-current/60 font-500 leading-none cursor-pointer rounded-[calc(var(--as-radius)-2px)] transition-colors duration-120",
    "hover:not-disabled:": "text-current",
  },
  "as-sorter-segment-btn-active": "scope-primary layer-2 text-current",
  "as-sorter-direction-disabled": "opacity-50 cursor-not-allowed",
  "as-sorter-lock": "text-[length:var(--as-fs-sm)] opacity-50 flex-shrink-0",

  /* ────────── Tabs (filter + config) count pill ──────── */
  "as-config-tab-count": {
    "": "inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-full layer-2 text-[length:var(--as-fs-xs)] text-current/70 font-500 leading-none",
  },
  "as-config-tab-count-active": "scope-primary bg-current-hl/10 text-current-hl",
});
