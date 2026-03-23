import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import { createFormDef, createFormData, createFormValueResolver } from "@atscript/ui";
import { reactive } from "vue";

/**
 * Creates a reactive form definition and data object from an ATScript annotated type.
 *
 * @param type - An ATScript annotated type (imported from a `.as` file).
 * @param context - Optional context object forwarded to `ui.fn.value` resolvers during data creation.
 *   Only effective when `@atscript/ui-fns` is installed (dynamic resolver).
 * @returns `{ def, formData }` — the FormDef and a Vue reactive data object with defaults applied
 */
export function useForm<T extends TAtscriptAnnotatedType>(
  type: T,
  context?: Record<string, unknown>,
) {
  const def = createFormDef(type);
  const resolver = context ? createFormValueResolver({}, context) : undefined;
  const formData = reactive(createFormData(type, resolver));
  return { def, formData };
}
