import { mergeVunorShortcuts } from "vunor/theme";
import { asWfFormShortcuts } from "./as-wf-form";
import { asWfFormLoadingShortcuts } from "./as-wf-form-loading";
import { asWfFinishShortcuts } from "./as-wf-finish";
import { asWfFinishMessageShortcuts } from "./as-wf-finish-message";
import { asWfFinishCountdownShortcuts } from "./as-wf-finish-countdown";
import { asWfFinishActionsShortcuts } from "./as-wf-finish-actions";
import { asWfFinishPrimaryShortcuts } from "./as-wf-finish-primary";
import { asWfFinishOptionShortcuts } from "./as-wf-finish-option";
import { asWfFinishSkipShortcuts } from "./as-wf-finish-skip";

export {
  asWfFormShortcuts,
  asWfFormLoadingShortcuts,
  asWfFinishShortcuts,
  asWfFinishMessageShortcuts,
  asWfFinishCountdownShortcuts,
  asWfFinishActionsShortcuts,
  asWfFinishPrimaryShortcuts,
  asWfFinishOptionShortcuts,
  asWfFinishSkipShortcuts,
};

export const wfShortcuts = mergeVunorShortcuts([
  asWfFormShortcuts,
  asWfFormLoadingShortcuts,
  asWfFinishShortcuts,
  asWfFinishMessageShortcuts,
  asWfFinishCountdownShortcuts,
  asWfFinishActionsShortcuts,
  asWfFinishPrimaryShortcuts,
  asWfFinishOptionShortcuts,
  asWfFinishSkipShortcuts,
]);
