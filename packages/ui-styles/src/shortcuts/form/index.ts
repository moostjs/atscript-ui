import { mergeVunorShortcuts } from "vunor/theme";
import { asActionShortcuts } from "./as-action";
import { asAmountMeasureShortcuts } from "./as-amount-measure";
import { asArrayShortcuts } from "./as-array";
import { asCheckboxRadioShortcuts } from "./as-checkbox-radio";
import { asCollapsibleShortcuts } from "./as-collapsible";
import { asDropdownShortcuts } from "./as-dropdown";
import { asFieldShortcuts } from "./as-field";
import { asFormShortcuts } from "./as-form";
import { asFormGridShortcuts } from "./as-form-grid";
import { asInputShortcuts } from "./as-input";
import { asNoDataShortcuts } from "./as-no-data";
import { asObjectShortcuts } from "./as-object";
import { asRefShortcuts } from "./as-ref";

export {
  asActionShortcuts,
  asAmountMeasureShortcuts,
  asArrayShortcuts,
  asCheckboxRadioShortcuts,
  asCollapsibleShortcuts,
  asDropdownShortcuts,
  asFieldShortcuts,
  asFormShortcuts,
  asFormGridShortcuts,
  asInputShortcuts,
  asNoDataShortcuts,
  asObjectShortcuts,
  asRefShortcuts,
};

export const formShortcuts = mergeVunorShortcuts([
  asFormShortcuts,
  asFormGridShortcuts,
  asFieldShortcuts,
  asInputShortcuts,
  asAmountMeasureShortcuts,
  asCheckboxRadioShortcuts,
  asCollapsibleShortcuts,
  asObjectShortcuts,
  asArrayShortcuts,
  asNoDataShortcuts,
  asDropdownShortcuts,
  asRefShortcuts,
  asActionShortcuts,
]);
