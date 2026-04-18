import { defineShortcuts } from "@atscript/unocss-preset";

/*
 * Colors are authored via vunor's palette utilities:
 *   primary-*  → accent (blue)
 *   grey-*     → slate neutral
 *   error-*    → danger red
 *   layer-*    → surface stack (handles dark mode automatically)
 *
 * Non-color design details (radii, fonts, sizes, dialog shadow, chevron SVG)
 * still come from `--as-*` CSS vars in the tokens preflight.
 */

const inputBase =
  "h-[var(--as-input-h)] px-[10px] w-full box-border outline-none " +
  "border border-solid border-grey-300 dark:border-grey-700 rounded-[var(--as-radius)] " +
  "bg-transparent text-grey-900 dark:text-grey-50 text-[length:var(--as-fs-base)] " +
  "transition-[border-color,box-shadow] duration-120 " +
  "placeholder:text-grey-400 dark:placeholder:text-grey-500";

const inputHover = "hover:border-grey-400 dark:hover:border-grey-600";
const inputFocus =
  "focus:border-primary-500 focus:shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]";
const inputDisabled =
  "disabled:bg-grey-100 dark:disabled:bg-grey-800 disabled:text-grey-400 disabled:cursor-not-allowed";

export const asFormShortcuts = defineShortcuts({
  /* ────────── Field shell ────────── */
  "as-default-field": {
    "": "flex flex-col gap-[6px] mb-[16px] relative",
    "[&_label]:":
      "text-[length:var(--as-fs-base)] font-600 text-grey-900 dark:text-grey-50",
    "[&.required_label]:after:":
      'content-["_*"] text-error-500 font-700 ml-[1px]',
    "[&.error_.as-error-slot]:": "text-error-500",

    "[&_input:not([type=checkbox]):not([type=radio]),&_select,&_textarea]:":
      inputBase,
    "[&_input:not([type=checkbox]):not([type=radio])]:": inputHover,
    "[&_select]:": inputHover,
    "[&_textarea]:": inputHover,
    "[&_input:not([type=checkbox]):not([type=radio])]:focus:":
      "border-primary-500 shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]",
    "[&_select]:focus:":
      "border-primary-500 shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]",
    "[&_textarea]:focus:":
      "border-primary-500 shadow-[0_0_0_3px_rgb(var(--scope-primary-500)/0.2)]",
    "[&_input:not([type=checkbox]):not([type=radio])]:disabled:":
      "bg-grey-100 dark:bg-grey-800 text-grey-400 cursor-not-allowed",
    "[&_select]:disabled:":
      "bg-grey-100 dark:bg-grey-800 text-grey-400 cursor-not-allowed",
    "[&_textarea]:disabled:":
      "bg-grey-100 dark:bg-grey-800 text-grey-400 cursor-not-allowed",
    "[&_input:not([type=checkbox]):not([type=radio]):read-only]:":
      "bg-grey-50 dark:bg-grey-800/50",
    "[&_textarea:read-only]:": "bg-grey-50 dark:bg-grey-800/50",

    "[&_textarea]:":
      "resize-y min-h-[80px] py-[8px] leading-[1.45]",

    "[&_select]:":
      "pr-[28px] cursor-pointer appearance-none bg-[image:var(--as-chevron-down)] bg-[length:16px_16px] bg-no-repeat bg-[position:right_8px_center] whitespace-nowrap",

    "[&.error_input:not([type=checkbox]):not([type=radio]),&.error_select,&.error_textarea]:":
      "border-error-500",
    "[&.error_input:not([type=checkbox]):not([type=radio])]:focus:":
      "border-error-500 shadow-[0_0_0_3px_rgb(var(--scope-error-500)/0.2)]",
    "[&.error_select]:focus:":
      "border-error-500 shadow-[0_0_0_3px_rgb(var(--scope-error-500)/0.2)]",
    "[&.error_textarea]:focus:":
      "border-error-500 shadow-[0_0_0_3px_rgb(var(--scope-error-500)/0.2)]",
  },

  "as-field-label":
    "text-[length:var(--as-fs-base)] font-600 text-grey-900 dark:text-grey-50",

  "as-field-header-row": "flex items-center gap-[6px] min-h-[24px]",
  "as-field-header-content":
    "flex flex-wrap items-center gap-x-[6px] gap-y-[2px] flex-1 min-w-0",
  "as-field-header-actions": "flex items-center gap-[4px] flex-shrink-0",
  "as-field-input-row":
    "flex items-center gap-[4px] [&>input]:flex-1 [&>select]:flex-1 [&>textarea]:flex-1",
  "as-error-slot":
    "min-h-[16px] leading-[16px] text-[length:var(--as-fs-sm)] text-grey-500",

  "as-optional-clear": {
    "":
      "inline-grid place-items-center w-[24px] h-[24px] p-0 border-0 bg-transparent text-grey-400 rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120",
    "hover:": "bg-error-50 dark:bg-error-900/40 text-error-500",
  },
  "as-field-remove-btn": {
    "":
      "inline-grid place-items-center h-[24px] px-[8px] border-0 bg-transparent text-grey-400 rounded-[var(--as-radius-sm)] cursor-pointer text-[length:var(--as-fs-sm)] leading-none transition-all duration-120",
    "hover:not-disabled:":
      "bg-error-50 dark:bg-error-900/40 text-error-500",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Checkbox / radio ────────── */
  "as-checkbox-field": {
    "[&_label]:":
      "flex items-center gap-[8px] text-[length:var(--as-fs-base)] text-grey-900 dark:text-grey-50 cursor-pointer font-normal",
    "[&_input[type=checkbox]]:":
      "w-[16px] h-[16px] m-0 p-0 border-0 shadow-none bg-transparent accent-primary-500 cursor-pointer",
  },
  "as-radio-group": {
    "": "flex flex-col gap-[8px]",
    "[&_label]:":
      "flex items-center gap-[8px] text-[length:var(--as-fs-base)] text-grey-900 dark:text-grey-50 cursor-pointer font-normal",
    "[&_input[type=radio]]:":
      "w-[16px] h-[16px] m-0 p-0 border-0 shadow-none bg-transparent accent-primary-500 cursor-pointer",
  },

  /* ────────── Structured header ────────── */
  "as-structured-header":
    "flex items-center justify-between gap-[8px] mb-[8px]",
  "as-structured-header-content":
    "flex items-center gap-[6px] flex-1 min-w-0",
  "as-structured-title":
    "m-0 text-[length:var(--as-fs-md)] font-600 text-grey-900 dark:text-grey-50 tracking-[-0.005em]",
  "as-form-title":
    "text-[20px] font-700 tracking-[-0.02em]",
  "as-structured-remove-btn": {
    "":
      "inline-flex items-center h-[26px] px-[10px] border border-solid border-grey-200 dark:border-grey-700 bg-transparent text-grey-500 rounded-[var(--as-radius-sm)] cursor-pointer text-[length:var(--as-fs-sm)] flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:":
      "bg-error-50 dark:bg-error-900/40 text-error-500 border-error-500",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Object / Array wrappers ────────── */
  "as-object": "my-[12px]",
  "as-object--root": "",
  "as-object--nested":
    "relative pl-[18px] pt-[14px] pb-[4px] mt-[10px] mb-[20px] border-0 border-l-2 border-l-solid border-l-grey-200 dark:border-l-grey-700 hover:border-l-grey-300 dark:hover:border-l-grey-600",
  "as-object-error":
    "text-[length:var(--as-fs-sm)] text-error-500 mb-[4px]",

  "as-array": "flex flex-col gap-0 my-[12px]",
  "as-array--root": "",
  "as-array--nested":
    "relative pl-[18px] pt-[14px] pb-[4px] mt-[10px] mb-[20px] border-0 border-l-2 border-l-solid border-l-grey-200 dark:border-l-grey-700 hover:border-l-grey-300 dark:hover:border-l-grey-600",
  "as-array-error":
    "text-[length:var(--as-fs-sm)] text-error-500 mt-[4px]",
  "as-array-add": "mt-[4px]",
  "as-array-add-btn": {
    "":
      "inline-flex items-center gap-[6px] h-[32px] px-[14px] border border-dashed border-grey-300 dark:border-grey-700 rounded-[var(--as-radius)] bg-transparent text-[length:var(--as-fs-base)] text-grey-500 cursor-pointer transition-all duration-120",
    "hover:not-disabled:":
      "border-primary-500 text-primary-500 bg-primary-50 dark:bg-primary-900/30",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── No data placeholder ────────── */
  "as-no-data": {
    "":
      "flex items-center justify-center gap-[8px] h-[36px] px-[12px] w-full border border-dashed border-grey-300 dark:border-grey-700 rounded-[var(--as-radius)] bg-transparent text-grey-500 text-[length:var(--as-fs-sm)] cursor-pointer transition-all duration-140",
    "hover:":
      "border-primary-500 text-primary-500 bg-primary-50 dark:bg-primary-900/30",
  },
  "as-no-data-text": "font-mono text-[length:var(--as-fs-xs)] tracking-wide",
  "as-no-data-plus":
    "inline-grid place-items-center w-[16px] h-[16px] rounded-full border border-solid border-current opacity-70 leading-none flex-shrink-0 [&>span]:text-[10px]",

  /* ────────── Dropdown (union / array-variant menu) ────────── */
  "as-dropdown": "relative inline-block",
  "as-dropdown-anchor": "relative",
  "as-dropdown-trigger": {
    "":
      "inline-flex items-center gap-[4px] h-[24px] px-[8px] border border-solid border-grey-200 dark:border-grey-700 bg-transparent text-[length:var(--as-fs-sm)] text-grey-500 rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120",
    "hover:not-disabled:":
      "border-primary-500 text-primary-500",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  "as-dropdown-menu":
    "layer-1 absolute top-full left-0 z-[50] min-w-[160px] mt-[4px] py-[4px] border border-solid border-grey-200 dark:border-grey-700 rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)]",
  "as-dropdown-item": {
    "":
      "block w-full px-[12px] py-[6px] border-0 bg-transparent text-left text-[length:var(--as-fs-base)] cursor-pointer",
    "hover:": "bg-grey-100 dark:bg-grey-800 text-primary-500",
  },
  "as-dropdown-item--active":
    "bg-primary-50 dark:bg-primary-900/30 text-primary-500 font-500",

  "as-variant-trigger": {
    "":
      "inline-flex items-center justify-center w-[24px] h-[24px] p-0 border border-solid border-grey-200 dark:border-grey-700 rounded-[var(--as-radius-sm)] bg-transparent text-grey-400 cursor-pointer flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:":
      "border-primary-500 text-primary-500",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Ref / value-help combobox ────────── */
  "as-ref-root": "block w-full",
  "as-ref-anchor": "flex items-center relative [&>input]:flex-1",
  "as-ref-input": inputBase,
  "as-ref-clear": {
    "":
      "absolute right-[8px] top-1/2 -translate-y-1/2 p-0 border-0 bg-transparent text-grey-400 cursor-pointer text-[length:var(--as-fs-md)] leading-none",
    "hover:": "text-error-500",
  },
  "as-ref-content":
    "layer-1 z-[50] border border-solid border-grey-200 dark:border-grey-700 rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)] w-[var(--reka-combobox-trigger-width)] overflow-hidden",
  "as-ref-viewport": "max-h-[240px] overflow-y-auto py-[4px]",
  "as-ref-item": {
    "":
      "flex items-baseline gap-[12px] px-[12px] py-[8px] cursor-pointer",
    "data-[highlighted]:": "bg-grey-100 dark:bg-grey-800",
  },
  "as-ref-item-id":
    "font-mono text-[length:var(--as-fs-sm)] text-grey-400 flex-shrink-0 min-w-[2em] text-right",
  "as-ref-item-label":
    "text-[length:var(--as-fs-base)] text-grey-900 dark:text-grey-50 flex-1",
  "as-ref-item-descr":
    "text-[length:var(--as-fs-sm)] text-grey-500",
  "as-ref-status":
    "px-[12px] py-[12px] text-center text-[length:var(--as-fs-base)] text-grey-400",

  /* ────────── Action field (form-level button) ────────── */
  "as-action-field": {
    "[&>button]:":
      "inline-flex items-center justify-center gap-[6px] h-[32px] px-[14px] border border-solid border-primary-500 rounded-[var(--as-radius)] bg-primary-500 text-white font-500 cursor-pointer transition-all duration-120 text-[length:var(--as-fs-base)] mt-[16px]",
    "[&>button]:hover:not-disabled:":
      "bg-primary-600 border-primary-600",
    "[&>button]:disabled:": "opacity-60 cursor-not-allowed",
  },
});
