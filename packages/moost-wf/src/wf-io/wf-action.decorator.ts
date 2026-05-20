import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { isAnnotatedType } from "@atscript/typescript/utils";
import { Resolve } from "moost";
import { useAtscriptWf } from "./use-atscript-wf";
import { useWfAction } from "./use-wf-action";

/**
 * Parameter decorator that resolves to the current workflow action name.
 *
 * If the parameter is annotated with an atscript type, the action is
 * validated against the type's `@ui.form.action` / `@wf.action.withData`
 * declarations — unknown actions throw `StepRetriableError`. When no
 * annotated type is available the action is returned raw (or `undefined`).
 *
 * @example
 * ```ts
 * @Step('mfa-verify')
 * async mfaVerify(
 *   @WfInput() input: PincodeForm,
 *   @WfAction() action: string | undefined,
 * ) {
 *   if (action === 'resend') return this.sendOtp()
 *   await this.verifyCode(input.code)
 * }
 * ```
 */
export function WfAction(): ParameterDecorator {
  return (target, key, index) => {
    if (typeof index !== "number") return;
    Resolve((metas) => {
      const type = metas?.targetMeta?.type as TAtscriptAnnotatedType | undefined;
      if (type && isAnnotatedType(type)) {
        return useAtscriptWf(type as TAtscriptAnnotatedType).resolveAction();
      }
      return useWfAction().getAction();
    }, "WfAction")(target, key, index);
  };
}
