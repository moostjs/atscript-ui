// Form-side type map. Kept separate from `demo-table-types.ts` so the
// edit page (which only renders forms) doesn't transitively pull in
// `@atscript/vue-table` and its table-only deps. This split also keeps
// `edit-by-path.spec.ts`'s targeted mocks small and focused.
import { createDefaultTypes, type TAsTypeComponents } from "@atscript/vue-form";

export function createDemoTypes(): TAsTypeComponents {
  return { ...createDefaultTypes() };
}
