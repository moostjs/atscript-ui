import type { TAtscriptAnnotatedType } from "@atscript/typescript/utils";
import {
  createFormDef,
  createFormData,
  createFormValueResolver,
  type CreateFormDefOptions,
} from "@atscript/ui";
import { reactive } from "vue";

/**
 * Creates a reactive form definition and data object from an ATScript annotated type.
 *
 * @param type - An ATScript annotated type (imported from a `.as` file).
 * @param context - Optional context object forwarded to `ui.fn.value` resolvers during data creation.
 *   Only effective when `@atscript/ui-fns` is installed (dynamic resolver).
 * @param opts - Options for `createFormDef`: `mode: "edit"` for a form that edits a stored row,
 *   `versionColumn`, `metaFields`.
 * @returns `{ def, formData }` — the FormDef and a Vue reactive data object with defaults applied
 */
export function createAsFormDef<T extends TAtscriptAnnotatedType>(
  type: T,
  context?: Record<string, unknown>,
  opts?: CreateFormDefOptions,
) {
  const def = createFormDef(type, opts);
  const resolver = context ? createFormValueResolver({}, context) : undefined;
  const formData = reactive(createFormData(type, resolver));
  return { def, formData };
}
