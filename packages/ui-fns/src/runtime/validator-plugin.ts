import type { TValidatorPlugin } from "@atscript/typescript/utils";
import { UI_VALIDATE, asArray, getFieldMeta } from "@atscript/ui";
import { buildFieldEntry } from "./dynamic-resolver";
import { compileValidatorFn } from "./fn-compiler";

/** Per-call context passed via `validator.validate(value, safe, context)`. */
export interface TValidatorContext {
  data: Record<string, unknown>;
  context: Record<string, unknown>;
}

/**
 * Creates an ATScript validator plugin that processes `@ui.validate` annotations
 * using compiled function strings.
 *
 * Usage:
 *   const plugin = uiFnsValidatorPlugin()
 *   const validator = new Validator(field.prop, { plugins: [plugin] })
 *   validator.validate(value, true, { data: formData, context })
 */
export function uiFnsValidatorPlugin(): TValidatorPlugin {
  return (ctx, def, value) => {
    const hasValidators = getFieldMeta(def, UI_VALIDATE);
    if (!hasValidators) return undefined;

    const fnsCtx = ctx.context as TValidatorContext | undefined;
    const data = fnsCtx?.data ?? {};
    const context = fnsCtx?.context ?? {};

    // Build entry + full scope via dual-scope utility
    const baseScope = { v: value, data, context, entry: undefined };
    const scope = buildFieldEntry(def, baseScope, ctx.path);

    // Run custom validators with full scope
    const fns = asArray(hasValidators);
    for (const fnStr of fns) {
      if (typeof fnStr !== "string") {
        continue;
      }

      const fn = compileValidatorFn(fnStr);
      const result = fn(scope);

      if (result !== true) {
        ctx.error(typeof result === "string" ? result : "Validation failed");
        return false;
      }
    }

    return undefined; // fall through to @expect.* validation
  };
}
