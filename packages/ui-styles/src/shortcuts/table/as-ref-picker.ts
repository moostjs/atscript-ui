import { defineShortcuts } from "vunor/theme";

/**
 * `<AsRefPicker>` (since 0.1.190): the reference field with a button opening
 * the picker dialog and a "See all" entry under its list.
 */
export const asRefPickerShortcuts = defineShortcuts({
  "as-ref-picker-browse": {
    "": "inline-grid place-items-center size-fingertip-m border-1 rounded-base layer-0 text-current/70 cursor-pointer flex-shrink-0 leading-none transition-colors duration-120 text-[1.1em]",
    "hover:": "text-current-hl border-current-hl",
    "focus-visible:": "current-outline-hl outline i8-apply-outline",
  },
  "as-ref-picker-see-all": {
    "": "flex items-center w-full px-$m py-$s border-0 border-t-1 bg-transparent text-callout font-500 text-current-hl cursor-pointer text-left",
    "hover:": "underline",
  },
});
