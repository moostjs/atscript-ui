import { mergeVunorShortcuts } from "vunor/theme";
import { asActionShortcuts } from "./as-action";
import { asArrayShortcuts } from "./as-array";
import { asCheckboxRadioShortcuts } from "./as-checkbox-radio";
import { asCollapsibleShortcuts } from "./as-collapsible";
import { asDecimalNumberShortcuts } from "./as-decimal-number";
import { asDropdownShortcuts } from "./as-dropdown";
import { asFieldShortcuts } from "./as-field";
import { asFormShortcuts } from "./as-form";
import { asFormGridShortcuts } from "./as-form-grid";
import { asNoDataShortcuts } from "./as-no-data";
import { asObjectShortcuts } from "./as-object";
import { asRefShortcuts } from "./as-ref";

export {
  asActionShortcuts,
  asArrayShortcuts,
  asCheckboxRadioShortcuts,
  asCollapsibleShortcuts,
  asDecimalNumberShortcuts,
  asDropdownShortcuts,
  asFieldShortcuts,
  asFormShortcuts,
  asFormGridShortcuts,
  asNoDataShortcuts,
  asObjectShortcuts,
  asRefShortcuts,
};

export const formShortcuts = mergeVunorShortcuts([
  asFormShortcuts,
  asFormGridShortcuts,
  asFieldShortcuts,
  asDecimalNumberShortcuts,
  asCheckboxRadioShortcuts,
  asCollapsibleShortcuts,
  asObjectShortcuts,
  asArrayShortcuts,
  asNoDataShortcuts,
  asDropdownShortcuts,
  asRefShortcuts,
  asActionShortcuts,
]);
