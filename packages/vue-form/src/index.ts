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
  AsRef,
} from "./components/defaults";

// Types
export type {
  TAsBaseComponentProps,
  TAsComponentProps,
  TAsComponentEmits,
  TAsTypeComponents,
  TAsUnionContext,
  TAsChangeType,
} from "./components/types";

// Factories
export { createAsFormDef } from "./composables/create-as-form-def";
export { createDefaultTypes } from "./composables/create-default-types";

// Composables — field-level
export { useAsField } from "./composables/use-as-field";
export type { UseAsFieldOptions, UseAsFieldReturn } from "./composables/use-as-field";

// Composables — form/state-level
export { useAsState } from "./composables/use-as-state";
export type { UseAsStateReturn, TFormSubmitValidator } from "./composables/use-as-state";
export { useAsForm } from "./composables/use-as-form";
export type { UseAsFormOptions, UseAsFormReturn } from "./composables/use-as-form";
export { useAsExternalErrors } from "./composables/use-as-external-errors";
export type {
  UseAsExternalErrorsOptions,
  UseAsExternalErrorsReturn,
} from "./composables/use-as-external-errors";

// Composables — structured fields
export { useAsArray } from "./composables/use-as-array";
export type { UseAsArrayReturn } from "./composables/use-as-array";
export { useAsTuple } from "./composables/use-as-tuple";
export type { UseAsTupleReturn } from "./composables/use-as-tuple";
export { useAsUnion } from "./composables/use-as-union";
export type { UseAsUnionReturn } from "./composables/use-as-union";
export {
  useAsUnionVariant,
  formatIndexedLabel,
  formatIndexedLabelParts,
} from "./composables/use-form-context";

// Composables — value help / dropdown
export { useAsValueHelp } from "./composables/use-as-value-help";
export type { UseAsValueHelpOptions, UseAsValueHelpReturn } from "./composables/use-as-value-help";
export { useAsDropdown } from "./composables/use-as-dropdown";

// Composables — collapsible-section store
export {
  provideAsNestedSectionsStore,
  useAsNestedSectionsStore,
  type AsNestedSectionsStore,
} from "./composables/use-as-nested-sections-store";

// Composables — focus utilities
export {
  useAsFocusFirstAfter,
  focusFirstAfter,
  focusNewFocusableAfter,
} from "./composables/focus-after-toggle";

// Composables — read-only context wrappers
export { useAsPath } from "./composables/use-as-path";
export type { UseAsPathReturn } from "./composables/use-as-path";
export { useAsTypeMap } from "./composables/use-as-type-map";
export type { UseAsTypeMapReturn } from "./composables/use-as-type-map";
export { useAsData } from "./composables/use-as-data";
export type { UseAsDataReturn } from "./composables/use-as-data";
export { useAsErrorDismiss } from "./composables/use-as-error-dismiss";
export type { AsErrorDismiss } from "./composables/use-as-error-dismiss";

// Re-exports from @atscript/ui
export {
  setDefaultClientFactory,
  getDefaultClientFactory,
  resetDefaultClientFactory,
  type ClientFactory,
} from "@atscript/ui";

// Composable types (for advanced use)
export type {
  TFormState,
  TFormRule,
  TFormFieldCallbacks,
  TFormFieldRegistration,
} from "./composables/types";
