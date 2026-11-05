import { defineShortcuts } from "vunor/theme";

export const asCheckboxRadioShortcuts = defineShortcuts({
  "as-checkbox-field": {
    "[&_label]:": "flex items-center gap-$s text-current cursor-pointer font-normal flex-1 min-w-0",
    "[&_input[type=checkbox]]:":
      "scope-primary size-[1em] m-0 p-0 border-0 shadow-none bg-transparent [accent-color:rgb(var(--current-hl))] cursor-pointer",
  },
  "as-checkbox-row": "flex items-center gap-$s w-full",
  // Read-only value text (`Yes` / `No` or the `@ui.literalLabel` label) in place of the checkbox.
  "as-checkbox-value": "font-medium",
  // Visual cue for the tri-state indeterminate (`undefined`) value.
  "as-checkbox-indeterminate": "opacity-60",
  "as-radio-group": {
    "": "flex flex-col gap-$s",
    "[&_label]:": "flex items-center gap-$s text-current cursor-pointer font-normal",
    "[&_input[type=radio]]:":
      "scope-primary size-[1em] m-0 p-0 border-0 shadow-none bg-transparent [accent-color:rgb(var(--current-hl))] cursor-pointer",
  },
});
