import type {
  InferDataType,
  TAtscriptAnnotatedType,
  TAtscriptTypeDef,
} from "@atscript/typescript/utils";
import { useWfState } from "@moostjs/event-wf";
import { StepRetriableError } from "@wooksjs/event-wf";
import { extractPassContext, getFormActions } from "./context";
import { serializeFormSchema } from "./serialize";
import { useWfActionSlot } from "./use-wf-action-slot";
import { getCachedValidator } from "./validator-cache";

interface RequireInputOpts {
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
 * Schema-driven workflow I/O primitives for atscript types. Returned helpers
 * are pure and independent — composable consumers can interleave their own
 * logic between checking the action and validating the input.
 *
 * - `resolveInput(opts?)` validates the current step input against the type
 *   schema and returns it typed; throws `StepRetriableError` when input is
 *   missing or invalid. Does NOT look at the wf action.
 * - `resolveAction()` returns the current wf action name (or `undefined`),
 *   throwing `StepRetriableError` when the action is unknown to the schema.
 *   Does NOT look at the wf input.
 * - `requireInput(opts?)` builds the `StepRetriableError` carrying the form
 *   schema + whitelisted context. Exposed so callers (composables, the
 *   `@WfInput` decorator) can throw their own custom failures.
 *
 * Validator instances are cached per `(type, opts)` pair.
 */
export function useAtscriptWf<T extends TAtscriptTypeDef>(
  type: TAtscriptAnnotatedType<T>,
): {
  resolveInput(opts?: { partial?: "deep" }): InferDataType<T>;
  resolveAction(): string | undefined;
  requireInput(opts?: {
    errors?: Record<string, string>;
    formMessage?: string;
  }): StepRetriableError<{
    outlet: "http";
    payload: unknown;
    context: Record<string, unknown>;
  }>;
};
export function useAtscriptWf<T extends TAtscriptTypeDef>(type: TAtscriptAnnotatedType<T>) {
  const wfState = useWfState();
  const wfAction = useWfActionSlot();

  function requireInput({ errors, formMessage }: RequireInputOpts = {}): StepRetriableError<{
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
        throw requireInput({ errors: flattenValidatorErrors(err) });
      }
      throw err;
    }
  }

  function resolveInput(opts?: { partial?: "deep" }): InferDataType<T> {
    const input = wfState.input<unknown>();
    if (input === undefined) {
      throw requireInput();
    }
    validateOrThrow(
      input,
      opts?.partial === "deep"
        ? { partial: "deep", unknownProps: "strip" }
        : { unknownProps: "strip" },
    );
    return input as InferDataType<T>;
  }

  function resolveAction(): string | undefined {
    const action = wfAction.getAction();
    if (action === undefined) return undefined;
    const { actions, actionsWithData } = getFormActions(type);
    if (!actions.includes(action) && !actionsWithData.includes(action)) {
      throw requireInput({ formMessage: `Action "${action}" is not supported` });
    }
    return action;
  }

  return { resolveInput, resolveAction, requireInput };
}
