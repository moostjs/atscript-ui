import { mergeVunorShortcuts } from "vunor/theme";
import { asActionShortcuts } from "./as-action";
import { asArrayShortcuts } from "./as-array";
import { asCheckboxRadioShortcuts } from "./as-checkbox-radio";
import { asDropdownShortcuts } from "./as-dropdown";
import { asFieldShortcuts } from "./as-field";
import { asFormShortcuts } from "./as-form";
import { asNoDataShortcuts } from "./as-no-data";
import { asObjectShortcuts } from "./as-object";
import { asRefShortcuts } from "./as-ref";
import { asStructuredShortcuts } from "./as-structured";

export {
  asActionShortcuts,
  asArrayShortcuts,
  asCheckboxRadioShortcuts,
  asDropdownShortcuts,
  asFieldShortcuts,
  asFormShortcuts,
  asNoDataShortcuts,
  asObjectShortcuts,
  asRefShortcuts,
  asStructuredShortcuts,
};

export const formShortcuts = mergeVunorShortcuts([
  asFormShortcuts,
  asFieldShortcuts,
  asCheckboxRadioShortcuts,
  asStructuredShortcuts,
  asObjectShortcuts,
  asArrayShortcuts,
  asNoDataShortcuts,
  asDropdownShortcuts,
  asRefShortcuts,
  asActionShortcuts,
]);
