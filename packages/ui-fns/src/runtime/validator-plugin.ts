import type { TValidatorPlugin } from "@atscript/typescript/utils";
import { UI_FORM_VALIDATE, asArray, getFieldMeta, isContainerKind } from "@atscript/ui";
import { buildFieldEntry } from "./dynamic-resolver";
import { compileValidatorFn } from "./fn-compiler";

/** Per-call context passed via `validator.validate(value, safe, context)`. */
export interface TValidatorContext {
  data: Record<string, unknown>;
  context: Record<string, unknown>;
}

/**
 * Whether `value` does NOT have the shape of container `kind` (an object, or
 * an array for array / tuple). A container rule only sees a value of its
 * container's shape; anything else (a missing object, a non-array) falls
 * through to the validator's own shape error instead of handing the rule a
 * value it would crash on.
 */
function containerShapeMismatch(kind: string, value: unknown): boolean {
  if (kind === "object") return typeof value !== "object" || value === null || Array.isArray(value);
  return !Array.isArray(value);
}

/**
 * Creates an ATScript validator plugin that processes `@ui.form.validate` annotations
 * using compiled function strings.
 *
 * The rule receives `(value, data, context, entry)`: `value` is the node's own
 * value (the whole object for an interface / object-type rule), `data` is the
 * form data passed in the validation context.
 *
 * On a leaf, a failing rule ends that leaf's validation (`@expect.*` is not
 * checked). On an object / array / tuple, a failing rule is recorded at the
 * container's path and its children are still validated, so a container-level
 * rule never hides field-level errors.
 *
 * Usage:
 *   const plugin = uiFnsValidatorPlugin()
 *   const validator = new Validator(field.prop, { plugins: [plugin] })
 *   validator.validate(value, true, { data: formData, context })
 */
export function uiFnsValidatorPlugin(): TValidatorPlugin {
  return (ctx, def, value) => {
    const hasValidators = getFieldMeta(def, UI_FORM_VALIDATE);
    if (!hasValidators) return undefined;
    // Object / array / tuple rules are container-level: a failing rule reports
    // at the container's own path and the walk still descends into children.
    // The shape guard exists because atscript validator plugins are pre-hooks
    // that run BEFORE the node's own type / shape check; a post-check hook
    // upstream would make it unnecessary.
    const container = isContainerKind(def.type.kind);
    if (container && containerShapeMismatch(def.type.kind, value)) return undefined;

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
        // Still walk a container's children so their own errors are reported.
        if (container) ctx.validateAnnotatedType(def, value);
        return false;
      }
    }

    return undefined; // fall through to @expect.* validation
  };
}
