import { mergeVunorShortcuts } from "vunor/theme";
import { aoothShortcuts } from "./aooth";
import { commonShortcuts } from "./common";
import { formShortcuts } from "./form";
import { tableShortcuts } from "./table";
import { wfShortcuts } from "./wf";

export { aoothShortcuts, commonShortcuts, formShortcuts, tableShortcuts, wfShortcuts };

export * from "./form";
export * from "./table";
export * from "./wf";
export * from "./aooth";

export const allShortcuts = mergeVunorShortcuts([
  commonShortcuts,
  formShortcuts,
  tableShortcuts,
  wfShortcuts,
  aoothShortcuts,
]);
