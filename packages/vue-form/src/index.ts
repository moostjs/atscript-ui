// Public components
export { default as AsForm } from "./components/as-form.vue";
export { default as AsField } from "./components/as-field.vue";
export { default as AsIterator } from "./components/as-iterator.vue";

// Default type components
export {
  AsInput,
  AsSelect,
  AsRadio,
  AsCheckbox,
  AsParagraph,
  AsAction,
  AsObject,
  AsArray,
  AsUnion,
  AsTuple,
} from "./components/defaults";

// Types
export type {
  TAsBaseComponentProps,
  TAsComponentProps,
  TAsTypeComponents,
  TAsUnionContext,
  TAsChangeType,
} from "./components/types";

// Composables
export { useForm } from "./composables/use-form";
export { useFormArray } from "./composables/use-form-array";
export { useFormUnion } from "./composables/use-form-union";
export { useConsumeUnionContext, formatIndexedLabel } from "./composables/use-form-context";
export { createDefaultTypes } from "./composables/create-default-types";

// Composable types (for advanced use)
export type {
  TFormState,
  TFormRule,
  TFormFieldCallbacks,
  TFormFieldRegistration,
} from "./composables/types";
export type { TFormSubmitValidator } from "./composables/use-form-state";
export type { UseFormFieldOptions } from "./composables/use-form-field";
