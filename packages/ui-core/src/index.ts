// ── Annotation key constants ────────────────────────────────
export {
  UI_PLACEHOLDER,
  UI_COMPONENT,
  UI_HIDDEN,
  UI_GROUP,
  UI_ORDER,
  UI_WIDTH,
  UI_ICON,
  UI_HINT,
  UI_DISABLED,
  UI_TYPE,
  UI_ATTR,
  UI_CLASS,
  UI_STYLE,
  META_LABEL,
  META_ID,
  META_DESCRIPTION,
  META_READONLY,
  META_REQUIRED,
  META_DEFAULT,
  META_SENSITIVE,
  UI_FN_PREFIX,
  UI_FN_LABEL,
  UI_FN_PLACEHOLDER,
  UI_FN_DESCRIPTION,
  UI_FN_HINT,
  UI_FN_HIDDEN,
  UI_FN_DISABLED,
  UI_FN_READONLY,
  UI_FN_OPTIONS,
  UI_FN_ATTR,
  UI_FN_VALUE,
  UI_FN_CLASSES,
  UI_FN_STYLES,
} from "./shared/annotation-keys";

// ── Form types ──────────────────────────────────────────────
export type {
  FormDef,
  FormFieldDef,
  FormArrayFieldDef,
  FormObjectFieldDef,
  FormUnionFieldDef,
  FormTupleFieldDef,
  FormUnionVariant,
  TFormEntryOptions,
  TFormAltAction,
} from "./form/types";
export { isArrayField, isObjectField, isUnionField, isTupleField } from "./form/types";

// ── Form definition builder ─────────────────────────────────
export { createFormDef, buildUnionVariants } from "./form/create-form-def";

// ── Field resolver (extensible) ─────────────────────────────
export type { FieldResolver, TResolveOptions } from "./shared/field-resolver";
export {
  StaticFieldResolver,
  defaultResolver,
  setResolver,
  getResolver,
  resolveFieldProp,
  resolveFormProp,
  resolveStatic,
  hasComputedAnnotations,
  getFieldMeta,
  optKey,
  optLabel,
  asArray,
  parseStaticOptions,
  parseStaticAttrs,
  resolveOptions,
  resolveAttrs,
} from "./shared/field-resolver";

// ── Path utilities ──────────────────────────────────────────
export {
  getByPath,
  setByPath,
  createFormValueResolver,
  createFormData,
  detectUnionVariant,
} from "./form/path-utils";
export type { TFormValueResolver } from "./form/path-utils";

// ── Validation ──────────────────────────────────────────────
export { getFormValidator, createFieldValidator } from "./form/validate";
export type { TFormValidatorCallOptions, TFieldValidatorOptions } from "./form/validate";

// ── Table types ─────────────────────────────────────────────
export type {
  TableDef,
  ColumnDef,
  MetaResponse,
  FieldMeta,
  SearchIndexInfo,
  RelationInfo,
  SortControl,
  PaginationControl,
  TableQueryState,
} from "./table/types";

// ── Table definition builder ────────────────────────────────
export { createTableDef } from "./table/create-table-def";

// ── Table column helpers ────────────────────────────────────
export {
  getVisibleColumns,
  getSortableColumns,
  getFilterableColumns,
  getColumn,
} from "./table/column-resolver";
