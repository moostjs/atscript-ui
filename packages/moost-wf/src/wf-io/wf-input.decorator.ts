import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { isAnnotatedType } from "@atscript/typescript/utils";
import { Resolve } from "moost";
import { useAtscriptWf } from "./use-atscript-wf";

/**
 * Parameter decorator that resolves to the validated typed input for the
 * current workflow step. Sugar over `useAtscriptWf(<param-type>).resolveInput`.
 *
 * Missing/invalid input or an action-vs-input mismatch throws a
 * `StepRetriableError` carrying the form schema + whitelisted context —
 * the wf engine catches it and pauses via the configured outlet.
 *
 * @example
 * ```ts
 * @Step('login')
 * async login(@WfInput() input: LoginForm) {
 *   await this.auth.login(input.username, input.password)
 * }
 * ```
 */
export function WfInput(opts?: { pass?: boolean }): ParameterDecorator {
  return (target, key, index) => {
    if (typeof index !== "number") return;
    Resolve((metas) => {
      const type = metas?.targetMeta?.type as TAtscriptAnnotatedType | undefined;
      if (!type || !isAnnotatedType(type)) {
        throw new Error(
          "@WfInput(): no atscript type available on the parameter. " +
            "Annotate the parameter with an atscript-derived type.",
        );
      }
      // Cast at the boundary — the parameter's runtime type is the atscript
      // type; the call-site annotation provides the TS-side inference.
      return useAtscriptWf(type as TAtscriptAnnotatedType).resolveInput(opts as { pass?: false });
    }, "WfInput")(target, key, index);
  };
}
