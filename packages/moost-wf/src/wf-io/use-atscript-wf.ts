import type {
  InferDataType,
  TAtscriptAnnotatedType,
  TAtscriptTypeDef,
  TError,
} from "@atscript/typescript/utils";
import { localizeErrors } from "@atscript/typescript/utils";
import { FORM_ERROR_KEY, validatorErrorsToMap } from "@atscript/ui";
import { useWfState } from "@moostjs/event-wf";
import { StepRetriableError } from "@wooksjs/event-wf";
import { extractPassContext, getFormActions } from "./context";
import { currentTranslation, translateText } from "./i18n";
import { serializeFormSchema, type SerializeFormSchemaOpts } from "./serialize";
import { getCachedValidator } from "./validator-cache";

interface RequireInputOpts {
  errors?: Record<string, string>;
  formMessage?: string;
}

/** Options of {@link useAtscriptWf}. */
export type UseAtscriptWfOpts = SerializeFormSchemaOpts;

function isValidatorError(err: unknown): err is { errors: TError[] } {
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
 *
 * Served in the request's language (moost's `setTranslator`): the form
 * schema (see {@link SerializeFormSchemaOpts.translate}), validation errors
 * (by their code) and `formMessage` / `errors` given to `requireInput` (by
 * their text). The workflow's state is never translated.
 */
export function useAtscriptWf<T extends TAtscriptTypeDef>(
  type: TAtscriptAnnotatedType<T>,
  opts?: UseAtscriptWfOpts,
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
export function useAtscriptWf<T extends TAtscriptTypeDef>(
  type: TAtscriptAnnotatedType<T>,
  opts?: UseAtscriptWfOpts,
) {
  const wfState = useWfState();

  function requireInput(input: RequireInputOpts = {}): StepRetriableError<{
    outlet: "http";
    payload: unknown;
    context: Record<string, unknown>;
  }> {
    // The caller's texts in the request's language (their text is the id).
    const translation = currentTranslation();
    let { errors, formMessage } = input;
    if (translation) {
      if (formMessage !== undefined) formMessage = translation.t(formMessage);
      if (errors) {
        errors = Object.fromEntries(
          Object.entries(errors).map(([path, message]) => [path, translation.t(message)]),
        );
      }
    }
    return inputRequired(type, opts, errors, formMessage);
  }

  function validateOrThrow(
    input: unknown,
    validatorOpts: Parameters<TAtscriptAnnotatedType["validator"]>[0],
  ): void {
    const validator = getCachedValidator(type, validatorOpts);
    try {
      validator.validate(input);
    } catch (err) {
      if (isValidatorError(err)) {
        // Localized by code (params filled) before the map is built: the
        // same error map as the client-side validator (root error → `__form`).
        const translation = currentTranslation();
        const errors = translation
          ? localizeErrors(err.errors, (id, params, error) =>
              translation.t(id, params, error.message),
            )
          : err.errors;
        throw inputRequired(type, opts, validatorErrorsToMap(errors));
      }
      throw err;
    }
  }

  function resolveInput(opts?: { partial?: "deep" }): InferDataType<T> {
    const input = wfState.input<{ action?: string; formData?: unknown }>()?.formData;
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
    const action = wfState.input<{ action?: string }>()?.action;
    if (action === undefined) return undefined;
    const { actions, actionsWithData } = getFormActions(type);
    if (!actions.includes(action) && !actionsWithData.includes(action)) {
      throw actionRefused(type, opts, 'Action "{action}" is not supported', action);
    }
    return action;
  }

  return { resolveInput, resolveAction, requireInput };
}

/**
 * The `StepRetriableError` refusing `action` with a built-in message: the
 * `template` translated once here with its `{action}` param, then served as is.
 *
 * @internal Shared with `@WfInput`.
 */
export function actionRefused(
  type: TAtscriptAnnotatedType,
  opts: UseAtscriptWfOpts | undefined,
  template: string,
  action: string,
): StepRetriableError<{ outlet: "http"; payload: unknown; context: Record<string, unknown> }> {
  return inputRequired(type, opts, undefined, translateText(template, { action }));
}

/**
 * The `StepRetriableError` asking for `type`'s form, with `errors` /
 * `formMessage` as they are (already in the request's language).
 */
function inputRequired(
  type: TAtscriptAnnotatedType,
  opts: UseAtscriptWfOpts | undefined,
  errors: Record<string, string> | undefined,
  formMessage?: string,
): StepRetriableError<{ outlet: "http"; payload: unknown; context: Record<string, unknown> }> {
  const wfContext = useWfState().ctx<Record<string, unknown>>() ?? {};
  const passContext = extractPassContext(type, wfContext);
  const mergedErrors: Record<string, string> | undefined = errors
    ? { ...errors }
    : formMessage
      ? {}
      : undefined;
  if (formMessage && mergedErrors) {
    mergedErrors[FORM_ERROR_KEY] = formMessage;
  }
  const context: Record<string, unknown> = mergedErrors
    ? { ...passContext, errors: mergedErrors }
    : { ...passContext };
  return new StepRetriableError(new Error(formMessage ?? "Input required"), undefined, {
    outlet: "http",
    payload: serializeFormSchema(type, opts),
    context,
  });
}
