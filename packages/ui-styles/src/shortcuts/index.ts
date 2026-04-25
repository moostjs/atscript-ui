import { mergeVunorShortcuts } from "vunor/theme";
import { commonShortcuts } from "./common";
import { formShortcuts } from "./form";
import { tableShortcuts } from "./table";
import { wfShortcuts } from "./wf";

export { commonShortcuts, formShortcuts, tableShortcuts, wfShortcuts };

export * from "./form";
export * from "./table";
export * from "./wf";

export const allShortcuts = mergeVunorShortcuts([
  commonShortcuts,
  formShortcuts,
  tableShortcuts,
  wfShortcuts,
]);
