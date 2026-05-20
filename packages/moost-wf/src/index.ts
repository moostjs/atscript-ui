export { FormInput } from "./wf-io/form-input.decorator";
export type { TFormInput } from "./wf-io/form-input.decorator";
export { AltAction } from "./wf-io/alt-action.decorator";
export { FormInputRequired } from "./wf-io/form-input-required";
export { formInputInterceptor } from "./wf-io/form-input.interceptor";
export { serializeFormSchema } from "./wf-io/serialize";
export { extractPassContext, getFormActions } from "./wf-io/context";
export { useFormInput } from "./wf-io/use-form-input";
export { useWfAction } from "./wf-io/use-wf-action";
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
