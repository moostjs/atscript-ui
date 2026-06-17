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
  UI_FORM_GRID_COL_SPAN,
  UI_FORM_GRID_ROW_SPAN,
  UI_FORM_SUBMIT_TEXT,
  UI_FORM_LABEL_SINGULAR,
  UI_FORM_ACTION,
  UI_FORM_PREFIX,
  UI_FORM_PREFIX_REF,
  UI_FORM_PREFIX_ICON,
  UI_FORM_SUFFIX,
  UI_FORM_SUFFIX_REF,
  UI_FORM_SUFFIX_ICON,
  // Table static
  UI_TABLE_WIDTH,
  UI_TABLE_COMPONENT,
  UI_TABLE_SELECT_WITH,
  UI_TABLE_EXCLUDE,
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
  DB_AMOUNT_CURRENCY,
  DB_AMOUNT_CURRENCY_REF,
  DB_UNIT,
  DB_UNIT_REF,
  DB_COLUMN_PRECISION,
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

// ── Declared form actions (host-fired action gating) ────────
export { getDeclaredFormActions } from "./form/form-actions";
export type { FormActionInfo } from "./form/form-actions";

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
  deleteByPath,
  createFormValueResolver,
  createFormData,
  detectUnionVariant,
} from "./form/path-utils";
export type { TFormValueResolver } from "./form/path-utils";

// ── Structural deep clone (framework-agnostic) ──────────────
export { deepClone } from "./form/clone";
export type { CloneUnwrap } from "./form/clone";

// ── Validation ──────────────────────────────────────────────
export {
  getFormValidator,
  createFieldValidator,
  setDefaultValidatorPlugins,
  getDefaultValidatorPlugins,
} from "./form/validate";
export type { TFormValidatorCallOptions, TFieldValidatorOptions } from "./form/validate";

// ── Form diff engine (framework-agnostic) ───────────────────
export { buildFormDiff, deepEqual } from "./form/diff";
export type { FormDiffResult, FormDiffOptions, FormFieldChange } from "./form/diff";

// ── Form apply + 3-way rebase (framework-agnostic) ──────────
export { applyFormChanges } from "./form/apply";
export { buildFormRebase } from "./form/rebase";
export type { FormRebaseOptions, FormRebaseResult } from "./form/rebase";

// ── Error-map utilities (framework-agnostic) ────────────────
export {
  mergeErrorMaps,
  iteratePathAncestors,
  buildDescendantErrorCounts,
} from "./form/error-utils";

// ── Grid layout (framework-agnostic) ────────────────────────
export {
  DEFAULT_COL_SPAN,
  DEFAULT_ROW_SPAN,
  parseColSpan,
  parseRowSpan,
  resolveGridSpec,
  buildGridClasses,
} from "./form/grid";
export type { GridSpec, GridSpanArgs } from "./form/grid";

// ── Form label helpers (framework-agnostic) ─────────────────
export { resolveSingularLabel } from "./form/labels";

// ── Measurement annotations (framework-agnostic) ────────────
export { extractMeasurement } from "./form/measurement";
export type { MeasurementInfo } from "./form/measurement";

// ── Decimal formatting + parsing (framework-agnostic) ───────
// Shared by `@atscript/vue-table` cells and `@atscript/vue-form` composables;
// the storage value path is string-only so DB-precision decimals don't bounce
// through floats.
export {
  enforceScale,
  formatDecimalForDisplay,
  getCurrencyDecimals,
  getCurrencyDisplayParts,
  getDecimalSeparator,
  getThousandsSeparator,
  groupInteger,
  joinDecimalString,
  parseDecimalInput,
  splitDecimalString,
} from "./form/decimal-format";
export type { CurrencyDisplay, DecimalParts, FormatDecimalOptions } from "./form/decimal-format";

// ── Table types ─────────────────────────────────────────────
export type {
  TableDef,
  TableActionsModel,
  ColumnDef,
  MetaResponse,
  FieldMeta,
  SearchIndexInfo,
  RelationInfo,
  SortControl,
  PaginationControl,
  TableQueryState,
} from "./table/types";

// ── Re-exports from @atscript/db-client (used in TableDef + MetaResponse) ──
export type {
  TCrudOp,
  TCrudPermissions,
  TDbActionInfo,
  TDbActionIntent,
  TDbActionLevel,
  TDbActionProcessor,
} from "@atscript/db-client";

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
export { getSortableColumns, getFilterableColumns, getColumn } from "./table/column-resolver";
