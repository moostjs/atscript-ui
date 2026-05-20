import type {
  InferDataType,
  TAtscriptAnnotatedType,
  TAtscriptTypeDef,
} from "@atscript/typescript/utils";
import { useWfState } from "@moostjs/event-wf";
import { StepRetriableError } from "@wooksjs/event-wf";
import { extractPassContext, getFormActions } from "./context";
import { serializeFormSchema } from "./serialize";
import { useWfAction } from "./use-wf-action";
import { getCachedValidator } from "./validator-cache";

interface ResolveInputOpts {
  pass?: boolean;
}

interface ToInputRequiredOpts {
  errors?: Record<string, string>;
  formMessage?: string;
}

function flattenValidatorErrors(err: {
  errors: Array<{ path: string; message: string }>;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of err.errors) {
    out[e.path] = e.message;
  }
  return out;
}

function isValidatorError(err: unknown): err is {
  errors: Array<{ path: string; message: string }>;
} {
  return (
    err !== null &&
    typeof err === "object" &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown }).errors)
  );
}

/**
 * Schema-driven workflow I/O for atscript types. The single primitive that
 * `@WfInput()` and `@WfAction()` sugar over.
 *
 * - `resolveInput(opts?)` returns the typed, validated input — or throws a
 *   `StepRetriableError` carrying the form schema + whitelisted context
 *   when input is missing, invalid, or contradicts the current action.
 * - `resolveAction()` returns the current workflow action name (or
 *   `undefined`), throwing `StepRetriableError` when the action is unknown
 *   to the schema.
 *
 * Validator instances are cached per `(type, opts)` pair.
 */
export function useAtscriptWf<T extends TAtscriptTypeDef>(
  type: TAtscriptAnnotatedType<T>,
): {
  resolveInput(opts?: { pass?: false }): InferDataType<T>;
  resolveInput(opts: { pass: true }): InferDataType<T> | undefined;
  resolveAction(): string | undefined;
};
export function useAtscriptWf<T extends TAtscriptTypeDef>(type: TAtscriptAnnotatedType<T>) {
  const wfState = useWfState();
  const wfAction = useWfAction();

  function toInputRequired({ errors, formMessage }: ToInputRequiredOpts = {}): StepRetriableError<{
    outlet: "http";
    payload: unknown;
    context: Record<string, unknown>;
  }> {
    const wfContext = wfState.ctx<Record<string, unknown>>() ?? {};
    const passContext = extractPassContext(type, wfContext);
    const mergedErrors: Record<string, string> | undefined = errors
      ? { ...errors }
      : formMessage
        ? {}
        : undefined;
    if (formMessage && mergedErrors) {
      mergedErrors.__form = formMessage;
    }
    const context: Record<string, unknown> = mergedErrors
      ? { ...passContext, errors: mergedErrors }
      : { ...passContext };
    return new StepRetriableError(new Error(formMessage ?? "Input required"), undefined, {
      outlet: "http",
      payload: serializeFormSchema(type),
      context,
    });
  }

  function validateOrThrow(
    input: unknown,
    opts: Parameters<TAtscriptAnnotatedType["validator"]>[0],
  ): void {
    const validator = getCachedValidator(type, opts);
    try {
      validator.validate(input);
    } catch (err) {
      if (isValidatorError(err)) {
        throw toInputRequired({ errors: flattenValidatorErrors(err) });
      }
      throw err;
    }
  }

  function resolveInput(opts?: ResolveInputOpts): InferDataType<T> | undefined {
    const input = wfState.input<Record<string, unknown> | undefined>();
    const action = wfAction.getAction();
    const pass = opts?.pass === true;

    if (action) {
      const { actions, actionsWithData } = getFormActions(type);
      const isNoData = actions.includes(action);
      const isWithData = actionsWithData.includes(action);

      if (!isNoData && !isWithData) {
        throw toInputRequired({ formMessage: `Action "${action}" is not supported` });
      }

      if (isNoData) {
        if (!pass) {
          throw toInputRequired({
            formMessage:
              input === undefined
                ? `Action "${action}" requires no data but this step expects input`
                : `Action "${action}" requires no data; input not allowed here`,
          });
        }
        if (input !== undefined) {
          // pass:true permits the step to *ignore* the no-data action, not
          // to smuggle a payload through it. Reject the input — it's not
          // part of the action contract.
          throw toInputRequired({
            formMessage: `Action "${action}" requires no data; input not allowed here`,
          });
        }
        return undefined;
      }

      // with-data action
      if (input === undefined) {
        throw toInputRequired({ formMessage: `Action "${action}" expects input` });
      }
      validateOrThrow(input, { partial: "deep", unknownProps: "strip" });
      return input as InferDataType<T>;
    }

    if (input === undefined) {
      throw toInputRequired();
    }

    validateOrThrow(input, { unknownProps: "strip" });
    return input as InferDataType<T>;
  }

  function resolveAction(): string | undefined {
    const action = wfAction.getAction();
    if (action === undefined) return undefined;
    const { actions, actionsWithData } = getFormActions(type);
    if (!actions.includes(action) && !actionsWithData.includes(action)) {
      throw toInputRequired({ formMessage: `Action "${action}" is not supported` });
    }
    return action;
  }

  return { resolveInput, resolveAction };
}
