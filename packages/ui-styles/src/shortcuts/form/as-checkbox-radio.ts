import { defineShortcuts } from "vunor/theme";

export const asCheckboxRadioShortcuts = defineShortcuts({
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
});
