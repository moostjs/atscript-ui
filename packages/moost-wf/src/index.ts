export { FormInput } from "./form-input/decorator";
export type { TFormInput } from "./form-input/decorator";
export { AltAction } from "./form-input/alt-action.decorator";
export { FormInputRequired } from "./form-input/required";
export { formInputInterceptor } from "./form-input/interceptor";
export { serializeFormSchema } from "./form-input/serialize";
export { extractPassContext, getFormActions } from "./form-input/context";
export { useFormInput } from "./form-input/use";
export { useWfAction } from "./form-input/use-wf-action";
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
  WfAction,
  WfButton,
  WfFinished,
  WfMessage,
  WfNext,
} from "./wf-finished";
