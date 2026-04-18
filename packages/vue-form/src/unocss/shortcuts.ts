import { defineShortcuts } from "@atscript/unocss-preset";

/*
 * Color model (vunor):
 * - Root stays scope-neutral (vunor default).
 * - Elements that paint with the primary palette declare `scope-primary`
 *   directly on themselves — inputs (for the blue focus ring), primary action
 *   buttons, hover accents, selected indicators.
 * - Elements that paint with the error palette declare `scope-error`.
 * - `current-hl`, `current-text` etc. resolve from the active scope.
 * - `layer-*` handles bg+text+border auto-flipping for light/dark mode.
 * - `border-1` alone uses vunor's preflight neutral border color.
 * No `dark:` pairs on utility colors — dark mode is handled upstream.
 */

const focusRingHl = "[box-shadow:0_0_0_3px_rgb(var(--current-hl)/0.2)]";

const inputBase =
  "scope-primary h-[var(--as-input-h)] px-[10px] w-full box-border outline-none " +
  "border-1 rounded-[var(--as-radius)] " +
  "bg-transparent text-current text-[length:var(--as-fs-base)] " +
  "transition-[border-color,box-shadow] duration-120 " +
  "placeholder:text-current/50";

export const asFormShortcuts = defineShortcuts({
  /* ────────── Field shell ────────── */
  "as-default-field": {
    "": "flex flex-col gap-[6px] mb-[16px] relative",
    "[&_label]:":
      "text-[length:var(--as-fs-base)] font-600 text-scope-dark-0 dark:text-scope-light-0",
    "[&.required_label]:after:":
      'content-["_*"] scope-error text-current-hl font-700 ml-[1px]',
    "[&.error_.as-error-slot]:": "scope-error text-current-hl",

    "[&_input:not([type=checkbox]):not([type=radio]),&_select,&_textarea]:":
      inputBase,
    "[&_input:not([type=checkbox]):not([type=radio]):hover,&_select:hover,&_textarea:hover]:":
      "border-current/30",
    "[&_input:not([type=checkbox]):not([type=radio]):focus,&_select:focus,&_textarea:focus]:":
      `border-current-hl! ${focusRingHl}`,
    "[&_input:not([type=checkbox]):not([type=radio]):disabled,&_select:disabled,&_textarea:disabled]:":
      "layer-2 text-current/40 cursor-not-allowed",
    "[&_input:not([type=checkbox]):not([type=radio]):read-only,&_textarea:read-only]:":
      "layer-2",

    "[&_textarea]:":
      "resize-y min-h-[80px] py-[8px] leading-[1.45]",

    "[&_select]:":
      "pr-[28px] cursor-pointer appearance-none bg-[image:var(--as-chevron-down)] bg-[length:16px_16px] bg-no-repeat bg-[position:right_8px_center] whitespace-nowrap",

    "[&.error_input:not([type=checkbox]):not([type=radio]),&.error_select,&.error_textarea]:":
      "scope-error border-current-hl",
    "[&.error_input:not([type=checkbox]):not([type=radio]):hover,&.error_select:hover,&.error_textarea:hover]:":
      "scope-error border-current-hl",
    "[&.error_input:not([type=checkbox]):not([type=radio]):focus,&.error_select:focus,&.error_textarea:focus]:":
      `scope-error border-current-hl! ${focusRingHl}`,
  },

  "as-field-label":
    "text-[length:var(--as-fs-base)] font-600 text-scope-dark-0 dark:text-scope-light-0",

  "as-field-header-row": "flex items-center gap-[6px] min-h-[24px]",
  "as-field-header-content":
    "flex flex-wrap items-center gap-x-[6px] gap-y-[2px] flex-1 min-w-0",
  "as-field-header-actions": "flex items-center gap-[4px] flex-shrink-0",
  "as-field-input-row":
    "flex items-center gap-[4px] [&>input]:flex-1 [&>select]:flex-1 [&>textarea]:flex-1",
  "as-error-slot":
    "min-h-[16px] leading-[16px] text-[length:var(--as-fs-sm)] text-current/60",

  "as-optional-clear": {
    "":
      "inline-grid place-items-center w-[24px] h-[24px] p-0 border-0 bg-transparent text-current/50 rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120",
    "hover:": "scope-error bg-current-hl/10 text-current-hl",
  },
  "as-field-remove-btn": {
    "":
      "inline-grid place-items-center h-[24px] px-[8px] border-0 bg-transparent text-current/50 rounded-[var(--as-radius-sm)] cursor-pointer text-[length:var(--as-fs-sm)] leading-none transition-all duration-120",
    "hover:not-disabled:":
      "scope-error bg-current-hl/10 text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Checkbox / radio ────────── */
  "as-checkbox-field": {
    "[&_label]:":
      "flex items-center gap-[8px] text-[length:var(--as-fs-base)] text-current cursor-pointer font-normal",
    "[&_input[type=checkbox]]:":
      "scope-primary w-[16px] h-[16px] m-0 p-0 border-0 shadow-none bg-transparent [accent-color:rgb(var(--current-hl))] cursor-pointer",
  },
  "as-radio-group": {
    "": "flex flex-col gap-[8px]",
    "[&_label]:":
      "flex items-center gap-[8px] text-[length:var(--as-fs-base)] text-current cursor-pointer font-normal",
    "[&_input[type=radio]]:":
      "scope-primary w-[16px] h-[16px] m-0 p-0 border-0 shadow-none bg-transparent [accent-color:rgb(var(--current-hl))] cursor-pointer",
  },

  /* ────────── Structured header ────────── */
  "as-structured-header":
    "flex items-center justify-between gap-[8px] mb-[8px]",
  "as-structured-header-content":
    "flex items-center gap-[6px] flex-1 min-w-0",
  "as-structured-title":
    "m-0 text-[length:var(--as-fs-md)] font-600 text-scope-dark-0 dark:text-scope-light-0 tracking-[-0.005em]",
  "as-form-title":
    "text-[20px] font-700 tracking-[-0.02em]",
  "as-structured-remove-btn": {
    "":
      "inline-flex items-center h-[26px] px-[10px] border-1 bg-transparent text-current/60 rounded-[var(--as-radius-sm)] cursor-pointer text-[length:var(--as-fs-sm)] flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:":
      "scope-error bg-current-hl/10 text-current-hl border-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Object / Array wrappers ────────── */
  "as-object": "my-[12px]",
  "as-object--root": "",
  "as-object--nested":
    "relative pl-[18px] pt-[14px] pb-[4px] mt-[10px] mb-[20px] border-0 border-l-2 border-l-current/20 hover:border-l-current/40",

  "as-object-error":
    "scope-error text-[length:var(--as-fs-sm)] text-current-hl mb-[4px]",

  "as-array": "flex flex-col gap-0 my-[12px]",
  "as-array--root": "",
  "as-array--nested":
    "relative pl-[18px] pt-[14px] pb-[4px] mt-[10px] mb-[20px] border-0 border-l-2 border-l-current/20 hover:border-l-current/40",
  "as-array-error":
    "scope-error text-[length:var(--as-fs-sm)] text-current-hl mt-[4px]",
  "as-array-add": "mt-[4px]",
  "as-array-add-btn": {
    "":
      "scope-primary inline-flex items-center gap-[6px] h-fingertip-m px-[14px] border-1 border-dashed rounded-[var(--as-radius)] bg-transparent text-[length:var(--as-fs-base)] text-current/60 cursor-pointer transition-all duration-120",
    "hover:not-disabled:":
      "border-current-hl text-current-hl bg-current-hl/10",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── No data placeholder ────────── */
  "as-no-data": {
    "":
      "scope-primary flex items-center justify-center gap-[8px] h-[36px] px-[12px] w-full border-1 border-dashed rounded-[var(--as-radius)] bg-transparent text-current/60 text-[length:var(--as-fs-sm)] cursor-pointer transition-all duration-140",
    "hover:": "border-current-hl text-current-hl bg-current-hl/10",
  },
  "as-no-data-text": "font-mono text-[length:var(--as-fs-xs)] tracking-wide",
  "as-no-data-plus":
    "inline-grid place-items-center w-[16px] h-[16px] rounded-full border-1 border-current opacity-70 leading-none flex-shrink-0 [&>span]:text-[10px]",

  /* ────────── Dropdown (union / array-variant menu) ────────── */
  "as-dropdown": "relative inline-block",
  "as-dropdown-anchor": "relative",
  "as-dropdown-trigger": {
    "":
      "scope-primary inline-flex items-center gap-[4px] h-[24px] px-[8px] border-1 bg-transparent text-[length:var(--as-fs-sm)] text-current/60 rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  "as-dropdown-menu":
    "layer-1 absolute top-full left-0 z-[50] min-w-[160px] mt-[4px] py-[4px] border-1 rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)]",
  "as-dropdown-item": {
    "":
      "scope-primary block w-full px-[12px] py-[6px] border-0 bg-transparent text-current text-left text-[length:var(--as-fs-base)] cursor-pointer",
    "hover:": "layer-3 text-current-hl",
  },
  "as-dropdown-item--active":
    "scope-primary bg-current-hl/10 text-current-hl font-500",

  "as-variant-trigger": {
    "":
      "scope-primary inline-flex items-center justify-center w-[24px] h-[24px] p-0 border-1 rounded-[var(--as-radius-sm)] bg-transparent text-current/50 cursor-pointer flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Ref / value-help combobox ────────── */
  "as-ref-root": "block w-full",
  "as-ref-anchor": "flex items-center relative [&>input]:flex-1",
  "as-ref-input": inputBase,
  "as-ref-clear": {
    "":
      "absolute right-[8px] top-1/2 -translate-y-1/2 p-0 border-0 bg-transparent text-current/50 cursor-pointer text-[length:var(--as-fs-md)] leading-none",
    "hover:": "scope-error text-current-hl",
  },
  "as-ref-content":
    "layer-1 z-[50] border-1 rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)] w-[var(--reka-combobox-trigger-width)] overflow-hidden",
  "as-ref-viewport": "max-h-[240px] overflow-y-auto py-[4px]",
  "as-ref-item": {
    "":
      "flex items-baseline gap-[12px] px-[12px] py-[8px] cursor-pointer",
    "data-[highlighted]:": "layer-3",
  },
  "as-ref-item-id":
    "font-mono text-[length:var(--as-fs-sm)] text-current/50 flex-shrink-0 min-w-[2em] text-right",
  "as-ref-item-label":
    "text-[length:var(--as-fs-base)] text-current flex-1",
  "as-ref-item-descr":
    "text-[length:var(--as-fs-sm)] text-current/60",
  "as-ref-status":
    "px-[12px] py-[12px] text-center text-[length:var(--as-fs-base)] text-current/50",

  /* ────────── Action field (form-level button) ────────── */
  "as-action-field": {
    "[&>button]:": "as-submit-btn",
  },
  "as-submit-btn": {
    "":
      "scope-primary c8-filled inline-flex items-center justify-center gap-[6px] h-fingertip-m px-[14px] font-500 cursor-pointer text-[length:var(--as-fs-base)] mt-[16px]",
    "disabled:": "opacity-60 cursor-not-allowed",
  },
});
