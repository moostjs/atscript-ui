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
  UI_OPTIONS,
  UI_ATTR,
  UI_CLASS,
  UI_STYLE,
  UI_AUTOCOMPLETE,
  UI_FORM_ACTION,
  UI_DICT_LABEL,
  UI_DICT_DESCR,
  UI_DICT_ATTR,
  UI_DICT_FILTERABLE,
  UI_DICT_SORTABLE,
  UI_DICT_SEARCHABLE,
  DB_REL_FK,
  DB_HTTP_PATH,
  WF_ACTION_WITH_DATA,
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
  UI_VALIDATE,
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
  TFormAction,
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
  asArray,
  parseStaticAttrs,
  resolveAttrs,
} from "./shared/field-resolver";
export { optKey, optLabel, parseStaticOptions, resolveOptions } from "./value-help";

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

// ── Value-help (unified options resolution) ─────────────────
export {
  extractLiteralOptions,
  isPureLiteralUnion,
  extractValueHelp,
  valueHelpDictPaths,
  ValueHelpClient,
  resolveValueHelp,
  resetValueHelpCache,
} from "./value-help";
export type {
  ValueHelpInfo,
  ValueHelpSearchOptions,
  ValueHelpResult,
  ResolvedValueHelp,
} from "./value-help";

// ── Client factory (shared by tables + value-help) ──────────
export {
  setDefaultClientFactory,
  getDefaultClientFactory,
  resetDefaultClientFactory,
  type ClientFactory,
} from "./client-factory";

// ── Shared meta cache (single /meta fetch per URL across tables + value-help)
export { getMetaEntry, resetMetaCache } from "./shared/meta-cache";
export type { MetaCacheEntry } from "./shared/meta-cache";

// ── Shared utilities ────────────────────────────────────────
export { str } from "./shared/str";

// ── Table column helpers ────────────────────────────────────
export {
  getVisibleColumns,
  getSortableColumns,
  getFilterableColumns,
  getColumn,
} from "./table/column-resolver";
