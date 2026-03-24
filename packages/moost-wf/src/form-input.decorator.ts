import { useWfState } from "@moostjs/event-wf";
import { Resolve, Intercept, TInterceptorPriority, useControllerContext } from "moost";
import type { TInterceptorDef } from "moost";
import { isAnnotatedType } from "@atscript/typescript/utils";
import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { serializeFormSchema } from "./serialize";
import { extractPassContext, getFormActions } from "./context";
import { useFormInput } from "./use-form-input";
import { useWfAction } from "./use-wf-action";

/**
 * Parameter decorator for workflow steps that need form input.
 *
 * Combines parameter injection (via Resolve) with a method interceptor
 * (via Intercept) that validates input before the step handler executes.
 *
 * The injected value is `{ data(), requireInput(errors?) }`.
 *
 * @example
 * ```ts
 * @Step('login')
 * async login(@FormInput() form: TFormInput<LoginForm>) {
 *   const input = form.data()
 *   try {
 *     await this.auth.login(input.username, input.password)
 *   } catch (e) {
 *     throw form.requireInput({ password: 'Invalid credentials' })
 *   }
 * }
 * ```
 */
export function FormInput(): ParameterDecorator {
  return (target, key, index) => {
    if (typeof index !== "number") return;

    Resolve((metas) => {
      const type = metas?.targetMeta?.type as TAtscriptAnnotatedType | undefined;
      return useFormInput(type);
    }, "FormInput")(target, key, index);

    Intercept(formInputCheckFn())(
      target,
      key as string,
      Object.getOwnPropertyDescriptor(target, key as string) as TypedPropertyDescriptor<unknown>,
    );
  };
}

/** Type for the injected form input helper. */
export type TFormInput<_T = unknown> = ReturnType<typeof useFormInput>;

/**
 * Per-method interceptor that validates workflow input against the atscript
 * form type before the step handler executes. Throws {@link FormInputRequired}
 * on validation failure, which is caught by {@link formInputInterceptor}.
 */
function formInputCheckFn(): TInterceptorDef {
  return {
    priority: TInterceptorPriority.INTERCEPTOR,
    async before(reply) {
      const wfState = useWfState();
      const input = wfState.input<Record<string, unknown> | undefined>();
      const action = useWfAction().getAction();

      const { getMethodMeta } = useControllerContext();
      const meta = getMethodMeta();
      const paramMetas = (meta as Record<string, unknown>)?.params as
        | Array<{ targetMeta?: { type?: unknown } }>
        | undefined;

      let type: TAtscriptAnnotatedType | undefined;
      if (paramMetas) {
        for (const param of paramMetas) {
          if (param?.targetMeta?.type && isAnnotatedType(param.targetMeta.type)) {
            type = param.targetMeta.type as TAtscriptAnnotatedType;
            break;
          }
        }
      }

      if (!type) return;

      if (input === undefined && !action) {
        reply(toInputRequired(type, wfState));
        return;
      }

      if (action) {
        const { actions, actionsWithData } = getFormActions(type);

        if (actionsWithData.includes(action)) {
          const validator = type.validator({ partial: "deep", unknownProps: "strip" });
          try {
            validator.validate(input ?? {});
          } catch (err) {
            if (isValidatorError(err)) {
              reply(toInputRequired(type, wfState, flattenErrors(err)));
              return;
            }
            throw err;
          }
          return;
        }

        if (actions.includes(action)) return;

        reply(
          toInputRequired(type, wfState, {
            __form: `Action "${action}" is not supported`,
          }),
        );
        return;
      }

      const validator = type.validator({ unknownProps: "strip" });
      try {
        validator.validate(input);
      } catch (err) {
        if (isValidatorError(err)) {
          reply(toInputRequired(type, wfState, flattenErrors(err)));
          return;
        }
        throw err;
      }
    },
  };
}

/** Build the inputRequired response payload. */
function toInputRequired(
  type: TAtscriptAnnotatedType,
  wfState: ReturnType<typeof useWfState>,
  errors?: Record<string, string>,
) {
  const wfContext = wfState.ctx<Record<string, unknown>>();
  const schema = serializeFormSchema(type);
  const passedContext = extractPassContext(type, wfContext);
  const context: Record<string, unknown> = { ...passedContext };
  if (errors) {
    context.errors = errors;
  }
  return {
    inputRequired: {
      payload: schema,
      transport: "http" as const,
      context,
    },
  };
}

function flattenErrors(err: {
  errors: Array<{ path: string; message: string }>;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const e of err.errors) {
    errors[e.path] = e.message;
  }
  return errors;
}

function isValidatorError(
  err: unknown,
): err is { errors: Array<{ path: string; message: string }> } {
  return (
    err !== null &&
    typeof err === "object" &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown }).errors)
  );
}
