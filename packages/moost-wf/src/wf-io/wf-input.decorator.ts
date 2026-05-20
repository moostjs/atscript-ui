import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { isAnnotatedType } from "@atscript/typescript/utils";
import { useWfState } from "@moostjs/event-wf";
import { Resolve } from "moost";
import { getFormActions } from "./context";
import { useAtscriptWf } from "./use-atscript-wf";

/**
 * Parameter decorator that resolves to the validated typed input for the
 * current workflow step. Owns the action-vs-input policy matrix on top of
 * the pure `useAtscriptWf` primitives.
 *
 * Policy:
 * - No action fired → strict full validation.
 * - With-data action → input required, partial-deep validation.
 * - No-data action → input must be absent; returns `undefined` only when
 *   `pass: true` opts the step into ignoring the no-data action.
 * - Unknown action → `StepRetriableError` (propagated from `resolveAction`).
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
      const wf = useAtscriptWf(type as TAtscriptAnnotatedType);
      const pass = opts?.pass === true;

      // resolveAction throws on unknown — same behavior we want here.
      const action = wf.resolveAction();

      if (action) {
        const wfInput = useWfState().input<unknown>();
        const { actions, actionsWithData } = getFormActions(type as TAtscriptAnnotatedType);
        const isNoData = actions.includes(action);
        const isWithData = actionsWithData.includes(action);

        if (isNoData) {
          if (!pass) {
            throw wf.requireInput({
              formMessage:
                wfInput === undefined
                  ? `Action "${action}" requires no data but this step expects input`
                  : `Action "${action}" requires no data; input not allowed here`,
            });
          }
          if (wfInput !== undefined) {
            // pass:true permits the step to *ignore* the no-data action, not
            // to smuggle data through it. Reject the input — it's not part
            // of the action contract.
            throw wf.requireInput({
              formMessage: `Action "${action}" requires no data; input not allowed here`,
            });
          }
          return undefined;
        }

        if (isWithData) {
          if (wfInput === undefined) {
            throw wf.requireInput({ formMessage: `Action "${action}" expects input` });
          }
          return wf.resolveInput({ partial: "deep" });
        }
      }

      // no action → strict validation
      return wf.resolveInput();
    }, "WfInput")(target, key, index);
  };
}
