import { Resolve } from "moost";
import { useWfAction } from "./use-wf-action";

/**
 * Parameter decorator that resolves the action name from the current
 * workflow event context. Returns `undefined` for normal form submits.
 *
 * @example
 * ```ts
 * @Step('mfa-verify')
 * async mfaVerify(
 *   @FormInput() form: TFormInput<PincodeForm>,
 *   @AltAction() action: string | undefined,
 * ) {
 *   if (action === 'resend') {
 *     await this.sendOtp(ctx.email)
 *     return
 *   }
 *   await this.verifyCode(form.data().code)
 * }
 * ```
 */
export const AltAction = () => Resolve(() => useWfAction().getAction(), "AltAction");
