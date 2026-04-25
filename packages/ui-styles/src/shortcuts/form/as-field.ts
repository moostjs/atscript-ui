import { defineShortcuts } from "vunor/theme";
import { inputBase, strongText } from "./_shared";

export const asFieldShortcuts = defineShortcuts({
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
});
