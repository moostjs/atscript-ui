export { serializeFormSchema } from "./wf-io/serialize";
export { extractPassContext, getFormActions } from "./wf-io/context";
export { useAtscriptWf } from "./wf-io/use-atscript-wf";
export { WfInput } from "./wf-io/wf-input.decorator";
export { WfAction } from "./wf-io/wf-action.decorator";
export { createAsHttpOutlet } from "./outlet";
export { handleAsOutletRequest } from "./handle";

// ── WfFinished envelope ────────────────────────────────────────
//
// The HTTP adapter ALWAYS returns 200/201 JSON for `finished: true`
// envelopes. Terminal UX (redirects, countdowns, manual choices) is
// rendered client-side by `<AsWfFinish>` from the `next.action`.
export { abortWf, finishWf, isWfFinished } from "./wf-finished";
export type {
  FinishWfOpts,
  WfActionRequest,
  WfButton,
  WfFinished,
  WfMessage,
  WfNext,
} from "./wf-finished";
