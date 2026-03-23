import type { TAtscriptAnnotatedType, TValidatorOptions } from "@atscript/typescript/utils";
import { Validator } from "@atscript/typescript/utils";
import type { FormDef } from "./types";

/** Per-call options for the form validator function. */
export interface TFormValidatorCallOptions {
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * Returns a reusable validator function for a whole FormDef.
 *
 * Validator is created once and reused on every call.
 * ATScript's @expect.* validation runs automatically.
 * For custom `ui.fn.*` validators, install ui-fns and pass its plugin via `opts.plugins`.
 */
export function getFormValidator(
  def: FormDef,
  opts?: Partial<TValidatorOptions>,
): (callOpts: TFormValidatorCallOptions) => Record<string, string> {
  const validator = new Validator(def.type, {
    unknownProps: "ignore",
    ...opts,
  });

  return (callOpts: TFormValidatorCallOptions) => {
    const isValid = validator.validate(callOpts.data, true, {
      data: callOpts.data,
      context: callOpts.context ?? {},
    });
    if (isValid) return {};

    const errors: Record<string, string> = {};
    for (const err of validator.errors) {
      errors[err.path] = err.message;
    }
    return errors;
  };
}

// ── Field-level validator ────────────────────────────────────

/** Options for createFieldValidator. */
export interface TFieldValidatorOptions {
  /** Only report errors at the root path (for structure/array container validation). */
  rootOnly?: boolean;
}

/**
 * Creates a cached validator function for a single ATScript prop.
 *
 * The `Validator` instance is created lazily on first call and reused.
 * Returns `true` when valid, or the first error message string when invalid.
 */
export function createFieldValidator(
  prop: TAtscriptAnnotatedType,
  opts?: TFieldValidatorOptions,
): (value: unknown, externalCtx?: { data: unknown; context: unknown }) => true | string {
  let cached: InstanceType<typeof Validator> | undefined;

  return (value: unknown, externalCtx?: { data: unknown; context: unknown }): true | string => {
    cached ??= new Validator(prop);
    const isValid = cached.validate(value, true, externalCtx);
    if (!isValid) {
      if (opts?.rootOnly) {
        const rootError = cached.errors?.find((e) => e.path === "");
        if (rootError) return rootError.message;
        return true;
      }
      return cached.errors?.[0]?.message || "Invalid value";
    }
    return true;
  };
}
