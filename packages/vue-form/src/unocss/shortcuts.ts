import { defineShortcuts } from "@atscript/unocss-preset";

const inputBase =
  "h-[var(--as-input-h)] px-[10px] border border-solid border-[var(--as-border-strong)] rounded-[var(--as-radius)] bg-[var(--as-surface)] text-[var(--as-text)] text-[length:var(--as-fs-base)] font-inherit w-full outline-none transition-[border-color,box-shadow] duration-120 box-border";

const iconBtnBase =
  "inline-grid place-items-center w-[24px] h-[24px] p-0 border-0 bg-transparent text-[var(--as-text-faint)] rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120";

const ghostChipBtn =
  "inline-flex items-center justify-center h-[26px] px-[10px] border border-solid border-[var(--as-border)] bg-[var(--as-surface)] text-[var(--as-text-muted)] rounded-[var(--as-radius-sm)] cursor-pointer text-[length:var(--as-fs-sm)] leading-none transition-all duration-120";

export const asFormShortcuts = defineShortcuts({
  /* ────────── Field shell ────────── */
  "as-default-field": {
    "": "flex flex-col gap-[6px] mb-[16px] relative",
    "[&_label]:":
      "text-[length:var(--as-fs-base)] font-600 text-[var(--as-text)]",
    "[&.required_label]:after:":
      'content-["_*"] text-[var(--as-danger)] font-700 ml-[1px]',
    "[&.error_.as-error-slot]:": "text-[var(--as-danger)]",

    "[&_input:not([type=checkbox]):not([type=radio]),&_select,&_textarea]:":
      inputBase,
    "[&_input:not([type=checkbox]):not([type=radio])]:placeholder:":
      "text-[var(--as-text-faint)]",
    "[&_textarea]:placeholder:": "text-[var(--as-text-faint)]",
    "[&_input:not([type=checkbox]):not([type=radio])]:hover:":
      "border-[var(--as-text-faint)]",
    "[&_select]:hover:": "border-[var(--as-text-faint)]",
    "[&_textarea]:hover:": "border-[var(--as-text-faint)]",
    "[&_input:not([type=checkbox]):not([type=radio])]:focus:":
      "border-[var(--as-accent)] shadow-[0_0_0_3px_var(--as-accent-ring)]",
    "[&_select]:focus:":
      "border-[var(--as-accent)] shadow-[0_0_0_3px_var(--as-accent-ring)]",
    "[&_textarea]:focus:":
      "border-[var(--as-accent)] shadow-[0_0_0_3px_var(--as-accent-ring)]",
    "[&_input:not([type=checkbox]):not([type=radio])]:disabled:":
      "bg-[var(--as-surface-sunken)] text-[var(--as-text-subtle)] cursor-not-allowed",
    "[&_select]:disabled:":
      "bg-[var(--as-surface-sunken)] text-[var(--as-text-subtle)] cursor-not-allowed",
    "[&_textarea]:disabled:":
      "bg-[var(--as-surface-sunken)] text-[var(--as-text-subtle)] cursor-not-allowed",
    "[&_input:not([type=checkbox]):not([type=radio]):read-only]:":
      "bg-[var(--as-surface-muted)]",
    "[&_textarea:read-only]:": "bg-[var(--as-surface-muted)]",

    "[&_textarea]:": "resize-y min-h-[80px] py-[8px] leading-[1.45]",

    "[&_select]:":
      "pr-[28px] cursor-pointer appearance-none bg-[image:var(--as-chevron-down)] bg-[length:16px_16px] bg-no-repeat bg-[position:right_8px_center] whitespace-nowrap",

    "[&.error_input:not([type=checkbox]):not([type=radio]),&.error_select,&.error_textarea]:":
      "border-[var(--as-danger)]",
    "[&.error_input:not([type=checkbox]):not([type=radio])]:focus:":
      "border-[var(--as-danger)] shadow-[0_0_0_3px_rgba(220,38,38,0.15)]",
    "[&.error_select]:focus:":
      "border-[var(--as-danger)] shadow-[0_0_0_3px_rgba(220,38,38,0.15)]",
    "[&.error_textarea]:focus:":
      "border-[var(--as-danger)] shadow-[0_0_0_3px_rgba(220,38,38,0.15)]",
  },

  "as-field-label":
    "text-[length:var(--as-fs-base)] font-600 text-[var(--as-text)]",

  "as-field-header-row": "flex items-center gap-[6px] min-h-[24px]",

  "as-field-header-content":
    "flex flex-wrap items-center gap-x-[6px] gap-y-[2px] flex-1 min-w-0",

  "as-field-header-actions": "flex items-center gap-[4px] flex-shrink-0",

  "as-field-input-row":
    "flex items-center gap-[4px] [&>input]:flex-1 [&>select]:flex-1 [&>textarea]:flex-1",

  "as-error-slot":
    "min-h-[16px] leading-[16px] text-[length:var(--as-fs-sm)] text-[var(--as-text-subtle)]",

  "as-optional-clear": {
    "": iconBtnBase,
    "hover:": "bg-[var(--as-danger-soft)] text-[var(--as-danger)]",
  },

  "as-field-remove-btn": {
    "":
      "inline-grid place-items-center h-[24px] px-[8px] border-0 bg-transparent text-[var(--as-text-faint)] rounded-[var(--as-radius-sm)] cursor-pointer text-[length:var(--as-fs-sm)] leading-none transition-all duration-120",
    "hover:not-disabled:":
      "bg-[var(--as-danger-soft)] text-[var(--as-danger)]",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Checkbox / radio ────────── */
  "as-checkbox-field": {
    "[&_label]:":
      "flex items-center gap-[8px] text-[length:var(--as-fs-base)] text-[var(--as-text)] cursor-pointer font-normal",
    "[&_input[type=checkbox]]:":
      "w-[16px] h-[16px] m-0 p-0 border-0 shadow-none bg-transparent accent-[var(--as-accent)] cursor-pointer",
  },

  "as-radio-group": {
    "": "flex flex-col gap-[8px]",
    "[&_label]:":
      "flex items-center gap-[8px] text-[length:var(--as-fs-base)] text-[var(--as-text)] cursor-pointer font-normal",
    "[&_input[type=radio]]:":
      "w-[16px] h-[16px] m-0 p-0 border-0 shadow-none bg-transparent accent-[var(--as-accent)] cursor-pointer",
  },

  /* ────────── Structured header (used by as-object / as-array) ────────── */
  "as-structured-header":
    "flex items-center justify-between gap-[8px] mb-[8px]",
  "as-structured-header-content":
    "flex items-center gap-[6px] flex-1 min-w-0",
  "as-structured-title":
    "m-0 text-[length:var(--as-fs-md)] font-600 text-[var(--as-text)] tracking-[-0.005em]",
  "as-form-title":
    "text-[20px] font-700 text-[var(--as-text)] tracking-[-0.02em]",
  "as-structured-remove-btn": {
    "":
      "inline-flex items-center h-[26px] px-[10px] border border-solid border-[var(--as-border)] bg-[var(--as-surface)] text-[var(--as-text-muted)] rounded-[var(--as-radius-sm)] cursor-pointer text-[length:var(--as-fs-sm)] flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:":
      "bg-[var(--as-danger-soft)] text-[var(--as-danger)] border-[var(--as-danger)]",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Object / Array wrappers ────────── */
  "as-object": "my-[12px]",
  "as-object--root": "",
  "as-object--nested":
    "relative pl-[18px] pt-[14px] pb-[4px] mt-[10px] mb-[20px] border-0 border-l-2 border-l-solid border-l-[var(--as-border)] hover:border-l-[var(--as-border-strong)]",
  "as-object-error":
    "text-[length:var(--as-fs-sm)] text-[var(--as-danger)] mb-[4px]",

  "as-array": "flex flex-col gap-0 my-[12px]",
  "as-array--root": "",
  "as-array--nested":
    "relative pl-[18px] pt-[14px] pb-[4px] mt-[10px] mb-[20px] border-0 border-l-2 border-l-solid border-l-[var(--as-border)] hover:border-l-[var(--as-border-strong)]",
  "as-array-error":
    "text-[length:var(--as-fs-sm)] text-[var(--as-danger)] mt-[4px]",
  "as-array-add": "mt-[4px]",
  "as-array-add-btn": {
    "":
      "inline-flex items-center gap-[6px] h-[32px] px-[14px] border border-dashed border-[var(--as-border-strong)] rounded-[var(--as-radius)] bg-transparent text-[length:var(--as-fs-base)] text-[var(--as-text-subtle)] cursor-pointer transition-all duration-120",
    "hover:not-disabled:":
      "border-[var(--as-accent)] text-[var(--as-accent)] bg-[var(--as-accent-soft)]",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── No data placeholder ────────── */
  "as-no-data": {
    "":
      "flex items-center justify-center gap-[8px] h-[36px] px-[12px] w-full border border-dashed border-[var(--as-border-strong)] rounded-[var(--as-radius)] bg-transparent text-[var(--as-text-subtle)] text-[length:var(--as-fs-sm)] cursor-pointer transition-all duration-140",
    "hover:":
      "border-[var(--as-accent)] text-[var(--as-accent)] bg-[var(--as-accent-soft)]",
  },
  "as-no-data-text": "font-mono text-[length:var(--as-fs-xs)] tracking-wide",
  "as-no-data-plus":
    "inline-grid place-items-center w-[16px] h-[16px] rounded-full border border-solid border-current opacity-70 leading-none flex-shrink-0 [&>span]:text-[10px]",

  /* ────────── Dropdown (menu used by union/array variants) ────────── */
  "as-dropdown": "relative inline-block",
  "as-dropdown-anchor": "relative",
  "as-dropdown-trigger": {
    "":
      "inline-flex items-center gap-[4px] h-[24px] px-[8px] border border-solid border-[var(--as-border)] bg-[var(--as-surface)] text-[length:var(--as-fs-sm)] text-[var(--as-text-subtle)] rounded-[var(--as-radius-sm)] cursor-pointer leading-none transition-all duration-120",
    "hover:not-disabled:":
      "border-[var(--as-accent)] text-[var(--as-accent)]",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  "as-dropdown-menu":
    "absolute top-full left-0 z-[50] min-w-[160px] mt-[4px] py-[4px] bg-[var(--as-surface)] border border-solid border-[var(--as-border)] rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)]",
  "as-dropdown-item": {
    "":
      "block w-full px-[12px] py-[6px] border-0 bg-transparent text-left text-[length:var(--as-fs-base)] text-[var(--as-text)] cursor-pointer",
    "hover:":
      "bg-[var(--as-hover)] text-[var(--as-accent)]",
  },
  "as-dropdown-item--active":
    "bg-[var(--as-accent-soft)] text-[var(--as-accent)] font-500",

  "as-variant-trigger": {
    "":
      "inline-flex items-center justify-center w-[24px] h-[24px] p-0 border border-solid border-[var(--as-border)] rounded-[var(--as-radius-sm)] bg-[var(--as-surface)] text-[var(--as-text-faint)] cursor-pointer flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:":
      "border-[var(--as-accent)] text-[var(--as-accent)]",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Ref / value-help combobox ────────── */
  "as-ref-root": "block w-full",
  "as-ref-anchor": "flex items-center relative [&>input]:flex-1",
  "as-ref-input": inputBase,
  "as-ref-clear": {
    "":
      "absolute right-[8px] top-1/2 -translate-y-1/2 p-0 border-0 bg-transparent text-[var(--as-text-faint)] cursor-pointer text-[length:var(--as-fs-md)] leading-none",
    "hover:": "text-[var(--as-danger)]",
  },
  "as-ref-content":
    "z-[50] bg-[var(--as-surface)] border border-solid border-[var(--as-border)] rounded-[var(--as-radius)] shadow-[var(--as-shadow-dialog)] w-[var(--reka-combobox-trigger-width)] overflow-hidden",
  "as-ref-viewport": "max-h-[240px] overflow-y-auto py-[4px]",
  "as-ref-item": {
    "":
      "flex items-baseline gap-[12px] px-[12px] py-[8px] cursor-pointer",
    "data-[highlighted]:": "bg-[var(--as-hover)]",
  },
  "as-ref-item-id":
    "font-mono text-[length:var(--as-fs-sm)] text-[var(--as-text-faint)] flex-shrink-0 min-w-[2em] text-right",
  "as-ref-item-label":
    "text-[length:var(--as-fs-base)] text-[var(--as-text)] flex-1",
  "as-ref-item-descr":
    "text-[length:var(--as-fs-sm)] text-[var(--as-text-subtle)]",
  "as-ref-status":
    "px-[12px] py-[12px] text-center text-[length:var(--as-fs-base)] text-[var(--as-text-faint)]",

  /* ────────── Action field (form-level button) ────────── */
  "as-action-field": {
    "[&>button]:":
      "inline-flex items-center justify-center gap-[6px] h-[32px] px-[12px] border border-solid border-[var(--as-border-strong)] rounded-[var(--as-radius)] bg-[var(--as-accent)] text-white font-500 cursor-pointer transition-all duration-120 text-[length:var(--as-fs-base)] mt-[16px]",
    "[&>button]:hover:not-disabled:":
      "bg-[var(--as-accent-hover)] border-[var(--as-accent-hover)]",
    "[&>button]:disabled:":
      "opacity-60 cursor-not-allowed",
  },
});

// Keep legacy aggregator if consumers expect `ghostChipBtn`.
export { ghostChipBtn };
