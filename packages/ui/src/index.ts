// ── Annotation key constants ────────────────────────────────
export {
  // Cross-surface root
  UI_TYPE,
  // Form static
  UI_FORM_PLACEHOLDER,
  UI_FORM_HINT,
  UI_FORM_CLASSES,
  UI_FORM_STYLES,
  UI_FORM_AUTOCOMPLETE,
  UI_FORM_DISABLED,
  UI_FORM_OPTIONS,
  UI_FORM_ORDER,
  UI_FORM_TYPE,
  UI_FORM_COMPONENT,
  UI_FORM_HIDDEN,
  UI_FORM_ATTR,
  UI_FORM_WIDTH,
  UI_FORM_ICON,
  UI_FORM_SUBMIT_TEXT,
  UI_FORM_ACTION,
  // Table static
  UI_TABLE_WIDTH,
  UI_TABLE_COMPONENT,
  UI_TABLE_HIDDEN,
  UI_TABLE_ATTR,
  UI_TABLE_CLASSES,
  UI_TABLE_STYLES,
  UI_TABLE_TYPE,
  UI_TABLE_ORDER,
  // Dictionary
  UI_DICT_LABEL,
  UI_DICT_DESCR,
  UI_DICT_ATTR,
  UI_DICT_FILTERABLE,
  UI_DICT_SORTABLE,
  UI_DICT_SEARCHABLE,
  // DB
  DB_REL_FK,
  DB_HTTP_PATH,
  // Workflow
  WF_ACTION_WITH_DATA,
  // Meta
  META_LABEL,
  META_ID,
  META_DESCRIPTION,
  META_READONLY,
  META_REQUIRED,
  META_DEFAULT,
  META_SENSITIVE,
  EXPECT_MAX_LENGTH,
  // Form dynamic
  UI_FORM_FN_PREFIX,
  UI_FORM_FN_LABEL,
  UI_FORM_FN_PLACEHOLDER,
  UI_FORM_FN_DESCRIPTION,
  UI_FORM_FN_HINT,
  UI_FORM_FN_HIDDEN,
  UI_FORM_FN_DISABLED,
  UI_FORM_FN_READONLY,
  UI_FORM_FN_OPTIONS,
  UI_FORM_FN_ATTR,
  UI_FORM_FN_VALUE,
  UI_FORM_FN_CLASSES,
  UI_FORM_FN_STYLES,
  UI_FORM_FN_TITLE,
  UI_FORM_FN_SUBMIT_TEXT,
  UI_FORM_FN_SUBMIT_DISABLED,
  // Table dynamic
  UI_TABLE_FN_PREFIX,
  UI_TABLE_FN_ATTR,
  UI_TABLE_FN_CLASSES,
  UI_TABLE_FN_STYLES,
  // Validation
  UI_FORM_VALIDATE,
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
