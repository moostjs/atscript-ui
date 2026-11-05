import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { isAnnotatedType } from "@atscript/typescript/utils";
import { useWfState } from "@moostjs/event-wf";
import { Optional, Resolve } from "moost";
import { getFormActions } from "./context";
import { actionRefused, useAtscriptWf, type UseAtscriptWfOpts } from "./use-atscript-wf";

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
 * `translate`: see {@link UseAtscriptWfOpts}.
 *
 * @example
 * ```ts
 * @Step('login')
 * async login(@WfInput() input: LoginForm) {
 *   await this.auth.login(input.username, input.password)
 * }
 * ```
 */
export function WfInput(opts?: UseAtscriptWfOpts & { pass?: boolean }): ParameterDecorator {
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
      const form = type as TAtscriptAnnotatedType;
      const wf = useAtscriptWf(form, opts);
      const refuse = (template: string, action: string) =>
        actionRefused(form, opts, template, action);
      const pass = opts?.pass === true;

      // resolveAction throws on unknown — same behavior we want here.
      const action = wf.resolveAction();

      if (action) {
        const envelope = useWfState().input<{ action?: string; formData?: unknown }>();
        const wfInput = envelope?.formData;
        const { actions, actionsWithData } = getFormActions(form);
        const isNoData = actions.includes(action);
        const isWithData = actionsWithData.includes(action);

        if (isNoData) {
          if (!pass) {
            throw refuse(
              wfInput === undefined
                ? 'Action "{action}" requires no data but this step expects input'
                : 'Action "{action}" requires no data; input not allowed here',
              action,
            );
          }
          if (wfInput !== undefined) {
            // pass:true permits the step to *ignore* the no-data action, not
            // to smuggle data through it. Reject the input — it's not part
            // of the action contract.
            throw refuse('Action "{action}" requires no data; input not allowed here', action);
          }
          return undefined;
        }

        if (isWithData) {
          if (wfInput === undefined) {
            throw refuse('Action "{action}" expects input', action);
          }
          return wf.resolveInput({ partial: "deep" });
        }
      }

      // no action → strict validation
      return wf.resolveInput();
    }, "WfInput")(target, key, index);

    // pass:true means the decorator can legitimately return undefined when a
    // no-data alt action fires. Mark the param as moost-optional so global
    // validation pipes (e.g. @atscript/moost-validator) skip the undefined
    // value instead of rejecting it as "Expected object".
    if (opts?.pass === true) {
      Optional()(target, key, index);
    }
  };
}
