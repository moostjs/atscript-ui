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

const strongText = "text-scope-dark-0 dark:text-scope-light-0";

const inputBase =
  "scope-primary h-fingertip-m px-$s w-full box-border outline-none " +
  "border-1 layer-0 rounded-base current-outline-hl " +
  "!text-scope-dark-0 dark:!text-scope-light-0 " +
  "placeholder:text-current/50";

export const asFormShortcuts = defineShortcuts({
  /* ────────── Field shell ────────── */
  "as-default-field": {
    "": "flex flex-col gap-$xs mb-$m relative",
    "[&_label]:": `font-600 ${strongText}`,
    "[&.required_label]:after:": 'content-["_*"] scope-error text-current-hl font-700 ml-[0.1em]',
    "[&.error_.as-error-slot]:": "scope-error text-current-hl",

    "[&_input:not([type=checkbox]):not([type=radio]),&_select,&_textarea]:": inputBase,
    "[&_input:not([type=checkbox]):not([type=radio]):hover,&_select:hover,&_textarea:hover]:":
      "border-current/30",
    "[&_input:not([type=checkbox]):not([type=radio]):focus,&_select:focus,&_textarea:focus]:":
      "current-border-hl outline i8-apply-outline",
    "[&_input:not([type=checkbox]):not([type=radio]):disabled,&_select:disabled,&_textarea:disabled]:":
      "layer-2 text-current/40 cursor-not-allowed",
    "[&_input:not([type=checkbox]):not([type=radio]):read-only,&_textarea:read-only]:": "layer-2",

    "[&_textarea]:": "resize-y min-h-[80px] py-$s leading-[1.45]",

    "[&_select]:":
      "pr-[1.75em] cursor-pointer appearance-none bg-[image:url('data:image/svg+xml;utf8,<svg_xmlns=%22http://www.w3.org/2000/svg%22_width=%2216%22_height=%2216%22_viewBox=%220_0_24_24%22_fill=%22none%22_stroke=%22currentColor%22_stroke-width=%222%22_stroke-linecap=%22round%22_stroke-linejoin=%22round%22><polyline_points=%226_9_12_15_18_9%22/></svg>')] bg-[length:1em_1em] bg-no-repeat bg-[position:right_0.5em_center] whitespace-nowrap",

    "[&.error_input:not([type=checkbox]):not([type=radio]),&.error_select,&.error_textarea]:":
      "scope-error current-border-hl",
    "[&.error_input:not([type=checkbox]):not([type=radio]):focus,&.error_select:focus,&.error_textarea:focus]:":
      "scope-error current-border-hl outline i8-apply-outline",
  },

  "as-field-label": `font-600 ${strongText}`,

  "as-field-header-row": "flex items-center gap-$xs min-h-[1.5em]",
  "as-field-header-content": "flex flex-wrap items-center gap-x-$xs gap-y-[0.15em] flex-1 min-w-0",
  "as-field-header-actions": "flex items-center gap-$xs flex-shrink-0",
  "as-field-input-row":
    "flex items-center gap-$xs [&>input]:flex-1 [&>select]:flex-1 [&>textarea]:flex-1",
  "as-error-slot": "min-h-[1em] leading-[1] text-callout text-current/60",

  "as-field-description": "text-callout text-current/70 -mt-[0.2em]",

  "as-optional-clear": {
    "": "inline-grid place-items-center w-[1.5em] h-[1.5em] p-0 border-0 bg-transparent text-current/50 rounded-base cursor-pointer leading-none transition-all duration-120",
    "hover:": "scope-error bg-current-hl/10 text-current-hl",
  },
  "as-field-remove-btn": {
    "": "inline-grid place-items-center h-[1.5em] px-$s border-0 bg-transparent text-current/50 rounded-base cursor-pointer text-callout leading-none transition-all duration-120",
    "hover:not-disabled:": "scope-error bg-current-hl/10 text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Checkbox / radio ────────── */
  "as-checkbox-field": {
    "[&_label]:": "flex items-center gap-$s text-current cursor-pointer font-normal",
    "[&_input[type=checkbox]]:":
      "scope-primary w-[1em] h-[1em] m-0 p-0 border-0 shadow-none bg-transparent [accent-color:rgb(var(--current-hl))] cursor-pointer",
  },
  "as-radio-group": {
    "": "flex flex-col gap-$s",
    "[&_label]:": "flex items-center gap-$s text-current cursor-pointer font-normal",
    "[&_input[type=radio]]:":
      "scope-primary w-[1em] h-[1em] m-0 p-0 border-0 shadow-none bg-transparent [accent-color:rgb(var(--current-hl))] cursor-pointer",
  },

  /* ────────── Structured header ────────── */
  "as-structured-header": "flex items-center justify-between gap-$s mb-$s",
  "as-structured-header-content": "flex items-center gap-$xs flex-1 min-w-0",
  "as-structured-title": `m-0 font-600 ${strongText} tracking-[-0.005em]`,
  "as-form-title": "text-[1.54em] font-700 tracking-[-0.02em]",
  "as-structured-remove-btn": {
    "": "inline-flex items-center h-fingertip-s px-$s border-1 bg-transparent text-current/60 rounded-base cursor-pointer text-callout flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:": "scope-error bg-current-hl/10 text-current-hl border-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Object / Array wrappers ────────── */
  "as-object": "my-$m",
  "as-object--root": "",
  "as-object--nested":
    "relative pl-$m pt-$m pb-$xs mt-$s mb-$l border-0 border-l-2 border-l-current/20 hover:border-l-current/40",

  "as-object-error": "scope-error text-callout text-current-hl mb-$xs",

  /* ────────── Workflow form-level error banner ────────── */
  "as-wf-form-error": "scope-error surface-600 border-1 rounded-base px-$m py-$s mb-$m text-body",

  "as-array": "flex flex-col gap-0 my-$m",
  "as-array--root": "",
  "as-array--nested":
    "relative pl-$m pt-$m pb-$xs mt-$s mb-$l border-0 border-l-2 border-l-current/20 hover:border-l-current/40",
  "as-array-error": "scope-error text-callout text-current-hl mt-$xs",
  "as-array-add": "mt-$xs",
  "as-array-add-btn": {
    "": "scope-primary inline-flex items-center gap-$xs h-fingertip-m px-$m border-1 border-dashed rounded-base bg-transparent text-current/60 cursor-pointer transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl bg-current-hl/10",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── No data placeholder ────────── */
  "as-no-data": {
    "": "scope-primary flex items-center justify-center gap-$s h-fingertip-l px-$m w-full border-1 border-dashed rounded-base bg-transparent text-current/60 text-callout cursor-pointer transition-all duration-140",
    "hover:": "border-current-hl text-current-hl bg-current-hl/10",
  },
  "as-no-data-text": "font-mono text-callout tracking-wide",
  "as-no-data-plus":
    "inline-grid place-items-center w-[1em] h-[1em] rounded-full border-1 border-current opacity-70 leading-none flex-shrink-0 [&>span]:text-callout",

  /* ────────── Dropdown (union / array-variant menu) ────────── */
  "as-dropdown": "relative inline-block",
  "as-dropdown-anchor": "relative",
  "as-dropdown-trigger": {
    "": "scope-primary inline-flex items-center gap-$xs h-[1.5em] px-$s border-1 bg-transparent text-callout text-current/60 rounded-base cursor-pointer leading-none transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },
  "as-dropdown-menu":
    "layer-1 absolute top-full left-0 z-[50] min-w-[10em] mt-$xs py-$xs border-1 rounded-r2 shadow-popup",
  "as-dropdown-item": {
    "": "scope-primary block w-full px-$m py-$xs border-0 bg-transparent text-current text-left cursor-pointer",
    "hover:": "layer-3 text-current-hl",
  },
  "as-dropdown-item--active": "scope-primary bg-current-hl/10 text-current-hl font-500",

  "as-variant-trigger": {
    "": "scope-primary inline-flex items-center justify-center w-[1.5em] h-[1.5em] p-0 border-1 rounded-base bg-transparent text-current/50 cursor-pointer flex-shrink-0 transition-all duration-120",
    "hover:not-disabled:": "border-current-hl text-current-hl",
    "disabled:": "opacity-40 cursor-not-allowed",
  },

  /* ────────── Ref / value-help combobox ────────── */
  "as-ref-root": "block w-full",
  "as-ref-anchor": "flex items-center relative [&>input]:flex-1",
  "as-ref-input": inputBase,
  "as-ref-clear": {
    "": "absolute right-$s top-1/2 -translate-y-1/2 p-0 border-0 bg-transparent text-current/50 cursor-pointer leading-none",
    "hover:": "scope-error text-current-hl",
  },
  "as-ref-content":
    "layer-1 z-[50] border-1 rounded-r2 shadow-popup w-[var(--reka-combobox-trigger-width)] overflow-hidden",
  "as-ref-viewport": "max-h-[15em] overflow-y-auto py-$xs",
  "as-ref-item": {
    "": "flex items-baseline gap-$m px-$m py-$s cursor-pointer",
    "data-[highlighted]:": "layer-3",
  },
  "as-ref-item-id": "font-mono text-callout text-current/50 flex-shrink-0 min-w-[2em] text-right",
  "as-ref-item-label": "text-current flex-1",
  "as-ref-item-descr": "text-callout text-current/60",
  "as-ref-status": "px-$m py-$m text-center text-current/50",

  /* ────────── Action field (form-level button) ────────── */
  "as-action-field": {
    "[&>button]:": "as-submit-btn",
  },
  "as-submit-btn": {
    "": "scope-primary c8-filled inline-flex items-center justify-center gap-$xs h-fingertip-m px-$m font-500 cursor-pointer mt-$m",
    "disabled:": "opacity-60 cursor-not-allowed",
  },
});
