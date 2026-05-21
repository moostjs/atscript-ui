import type { TAtscriptAnnotatedType, TAtscriptTypeDef } from "@atscript/typescript/utils";
import { Resolve } from "moost";
import { useAtscriptWf } from "./use-atscript-wf";

/**
 * Parameter decorator — sugar for `useAtscriptWf(Type).resolveAction()`.
 *
 * Resolves to the current workflow action name from the input envelope, or
 * `undefined` when no action was submitted.
 *
 * The form type is **required**: the decorator validates the action against
 * the form's declared `@ui.form.action` / `@wf.action.withData` whitelist and
 * throws `StepRetriableError` for any unknown action — the step body never
 * sees actions that aren't part of the form's contract.
 *
 * @example
 * ```ts
 * @Step('mfa-verify')
 * async mfaVerify(
 *   @WfInput() input: PincodeForm,
 *   @WfAction(PincodeForm) action: string | undefined,
 * ) {
 *   if (action === 'resend') return this.sendOtp()
 *   await this.verifyCode(input.code)
 * }
 * ```
 */
export function WfAction<T extends TAtscriptTypeDef>(
  type: TAtscriptAnnotatedType<T>,
): ParameterDecorator {
  return (target, key, index) => {
    if (typeof index !== "number") return;
    Resolve(() => useAtscriptWf(type).resolveAction(), "WfAction")(target, key, index);
  };
}
