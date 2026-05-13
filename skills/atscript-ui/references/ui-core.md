Framework-agnostic API contracts for `@atscript/ui` + `@atscript/ui-table` + `@atscript/ui-fns`. For React/Svelte/Solid port authors and server-side consumers. All shapes grounded in source — paths cited where relevant.

## Contents

- [@atscript/ui — types](#atscriptui--types)
- [@atscript/ui — factories](#atscriptui--factories)
- [@atscript/ui — FieldResolver contract](#atscriptui--fieldresolver-contract)
- [@atscript/ui — Path helpers](#atscriptui--path-helpers)
- [@atscript/ui — Validators](#atscriptui--validators)
- [@atscript/ui — Value-help](#atscriptui--value-help)
- [@atscript/ui — Decimal helpers](#atscriptui--decimal-helpers)
- [@atscript/ui — Grid + column helpers](#atscriptui--grid--column-helpers)
- [@atscript/ui — Type guards](#atscriptui--type-guards)
- [@atscript/ui — Utilities](#atscriptui--utilities)
- [@atscript/ui — Annotation key constants](#atscriptui--annotation-key-constants)
- [@atscript/ui-fns](#atscriptui-fns)
- [@atscript/ui-table — filter model](#atscriptui-table--filter-model)
- [@atscript/ui-table — preset model](#atscriptui-table--preset-model)
- [@atscript/ui-table — HTTP clients](#atscriptui-table--http-clients)
- [@atscript/ui-table — query builder](#atscriptui-table--query-builder)
- [@atscript/ui-table — URL bridge](#atscriptui-table--url-bridge)
- [@atscript/ui-table — selection helpers](#atscriptui-table--selection-helpers)
- [@atscript/ui-table — window-mode helpers](#atscriptui-table--window-mode-helpers)
- [@atscript/ui-table — column widths](#atscriptui-table--column-widths)
- [@atscript/ui-table — state contracts](#atscriptui-table--state-contracts)
- [@atscript/ui-table — utilities](#atscriptui-table--utilities)

## @atscript/ui — types

Form-side. Source: `packages/ui/src/form/types.ts`.

```typescript
export interface FormFieldDef {
  path: string;                     // '' = root
  prop: TAtscriptAnnotatedType;
  type: string;                     // structural kind: 'array', 'object', 'union', 'tuple', or primitive
  customType?: string;              // @ui.form.type / @ui.type override for structured kinds only
  phantom: boolean;
  name: string;
  allStatic: boolean;               // true when no ui.fn.* keys exist — Vue perf flag
}

export interface FormDef {
  type: TAtscriptAnnotatedType;
  rootField: FormFieldDef;
  fields: FormFieldDef[];
  flatMap: Map<string, TAtscriptAnnotatedType>;
}

export interface FormArrayFieldDef extends FormFieldDef {
  itemType: TAtscriptAnnotatedType;
  itemField: FormFieldDef;          // template (path='')
}

export interface FormObjectFieldDef extends FormFieldDef {
  objectDef: FormDef;
}

export interface FormUnionFieldDef extends FormFieldDef {
  unionVariants: FormUnionVariant[];
}

export interface FormTupleFieldDef extends FormFieldDef {
  itemFields: FormFieldDef[];
}

export interface FormUnionVariant {
  label: string;
  type: TAtscriptAnnotatedType;
  def?: FormDef;                    // for object variants
  itemField?: FormFieldDef;         // for primitive variants
  designType?: string;
}

export interface TFormAction { id: string; label: string; }
```

Table-side. Source: `packages/ui/src/table/types.ts`.

```typescript
export interface TableDef {
  type: TAtscriptAnnotatedType;
  columns: ColumnDef[];
  flatMap: Map<string, TAtscriptAnnotatedType>;   // empty for non-object roots
  primaryKeys: string[];
  preferredId: string[];                          // defaults to primaryKeys
  crud: TCrudPermissions;
  canRemove: boolean;
  actions: TableActionsModel;
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  relations: RelationInfo[];
}

export interface ColumnDef {
  path: string;
  label: string;
  type: string;
  component?: string;
  sortable: boolean;
  filterable: boolean;
  nullable: boolean;          // drops null / notNull ops when false
  visible: boolean;
  width?: string;
  maxLen?: number;            // @expect.maxLen — drives default width
  order: number;
  options?: { key: string; label: string }[];
  valueHelpInfo?: ValueHelpInfo;
  currencyCode?: string;      // from @db.amount.currency literal
  currencyRefField?: string;  // from @db.amount.currency.ref
  unitCode?: string;
  unitRefField?: string;
  precisionScale?: number;    // 2nd arg of @db.column.precision
  fixed?: boolean;            // synthesised locked-chrome column (e.g. row-actions)
}

export interface TableActionsModel {
  table: TDbActionInfo[];
  row: TDbActionInfo[];
  rows: TDbActionInfo[];
  default: { table?: TDbActionInfo; row?: TDbActionInfo; rows?: TDbActionInfo; };
}

export interface MetaResponse {
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  primaryKeys: string[];
  preferredId: string[];
  crud: TCrudPermissions;
  actions: TDbActionInfo[];
  relations: RelationInfo[];
  fields: Record<string, FieldMeta>;
  type: TSerializedAnnotatedType;
}

export interface FieldMeta { sortable: boolean; filterable: boolean; }
export interface SearchIndexInfo { name: string; description?: string; type?: 'text' | 'vector'; }
export interface RelationInfo { name: string; direction: 'to' | 'from' | 'via'; isArray: boolean; }
export interface SortControl { field: string; direction: 'asc' | 'desc'; }
export interface PaginationControl { page: number; itemsPerPage: number; }
```

Value-help. Source: `packages/ui/src/value-help/types.ts`, `packages/ui/src/value-help/resolve.ts`.

```typescript
export interface ValueHelpInfo {
  url: string;                  // from target's @db.http.path
  targetField: string;          // from prop.ref.field — the value committed on pick
}

export type TFormEntryOptions = { key: string; label: string } | string;

export interface ResolvedValueHelp {
  url: string;
  primaryKeys: string[];
  labelField: string;
  descrField: string | undefined;
  attrFields: string[];
  filterableFields: string[];
  sortableFields: string[];
  searchable: boolean;
  targetType: TAtscriptAnnotatedType;
}
```

## @atscript/ui — factories

| Signature | Semantics |
| --- | --- |
| `createFormDef(type: TAtscriptAnnotatedType): FormDef` | Walks the annotated type, builds field defs, flattens descendants. Single call per form. `packages/ui/src/form/create-form-def.ts:48`. |
| `createTableDef(meta: MetaResponse, preDeserializedType?: TAtscriptAnnotatedType): TableDef` | Deserializes `meta.type`, builds `ColumnDef` per field, sorts by `@ui.table.order`. `packages/ui/src/table/create-table-def.ts:32`. |
| `createFormData<T>(type: T, resolver?: TFormValueResolver): { value: TAtscriptDataType<T> }` | Produces initial wrapped form value `{ value: ... }`. Backfills primitive `decimal` to `"0"` so optional toggle / array-add render an editable value. `packages/ui/src/form/path-utils.ts:114`. |
| `buildUnionVariants(typeDef: TAtscriptAnnotatedType): FormUnionVariant[]` | Materialises union branches with labels + pre-built defs/itemFields. `packages/ui/src/form/create-form-def.ts:288`. |

## @atscript/ui — FieldResolver contract

```typescript
export interface FieldResolver {
  resolveFieldProp<T>(
    prop: TAtscriptAnnotatedType,
    fnKey: string,
    staticKey: string | undefined,
    scope: Record<string, unknown>,
    opts?: TResolveOptions<T>,
  ): T | undefined;

  resolveFormProp<T>(
    type: TAtscriptAnnotatedType,
    fnKey: string,
    staticKey: string | undefined,
    scope: Record<string, unknown>,
    opts?: TResolveOptions<T>,
  ): T | undefined;

  hasComputedAnnotations(prop: TAtscriptAnnotatedType): boolean;
}

export interface TResolveOptions<T> {
  staticAsBoolean?: boolean;             // any non-undefined static → true
  transform?: (raw: unknown) => T;       // post-process raw static value
}
```

| Function | Semantics |
| --- | --- |
| `class StaticFieldResolver` | Default. Reads only `prop.metadata.get(staticKey)`. `hasComputedAnnotations` always `false`. |
| `class DynamicFieldResolver` (in `@atscript/ui-fns`) | Compiles fn keys via `new Function`, falls back to static. |
| `setResolver(resolver)` | Replace the singleton (called by `installDynamicResolver()`). |
| `getResolver(): FieldResolver` | Read the current singleton. |
| `defaultResolver: StaticFieldResolver` | The static instance. |
| `resolveFieldProp(prop, fnKey, staticKey, scope, opts?)` | Delegates to the active resolver — preferred call site. |
| `resolveFormProp(type, fnKey, staticKey, scope, opts?)` | Form-level (top scope). |
| `resolveStatic(metadata, staticKey, opts?)` | Direct static metadata read — used by both static + dynamic implementations. |
| `hasComputedAnnotations(prop): boolean` | Delegate. |
| `getFieldMeta(prop, key)` | Typed metadata read; `K extends keyof AtscriptMetadata` overload returns the typed value, else `unknown`. |

Source: `packages/ui/src/shared/field-resolver.ts`.

## @atscript/ui — Path helpers

Form data is wrapped: `{ value: domainData }`. The path utilities handle unwrapping.

```typescript
getByPath(obj: Record<string, unknown>, path: string): unknown;
setByPath(obj: Record<string, unknown>, path: string, value: unknown): void;

export type TFormValueResolver = (prop: TAtscriptAnnotatedType, path: string) => unknown;

createFormValueResolver(
  data?: Record<string, unknown>,
  context?: Record<string, unknown>,
): TFormValueResolver;

createFormData<T>(type: T, resolver?: TFormValueResolver): { value: TAtscriptDataType<T> };

detectUnionVariant(value: unknown, variants: FormUnionVariant[]): number;
```

Source: `packages/ui/src/form/path-utils.ts`. `createFormValueResolver` resolves `@ui.form.fn.value` first, then `@meta.default` (parsed via `parseStaticDefault`).

## @atscript/ui — Validators

```typescript
export interface TFormValidatorCallOptions {
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
}

getFormValidator(
  def: FormDef,
  opts?: Partial<TValidatorOptions>,
): (callOpts: TFormValidatorCallOptions) => Record<string, string>;
// Returns {} on success; otherwise { [path]: errorMessage }.
// @expect.* runs automatically; default plugins (e.g. uiFnsValidatorPlugin) prepended.

export interface TFieldValidatorOptions { rootOnly?: boolean; }

createFieldValidator(
  prop: TAtscriptAnnotatedType,
  opts?: TFieldValidatorOptions,
): (value: unknown, externalCtx?: { data: unknown; context: unknown }) => true | string;
// Cached Validator instance; returns true | first error message.

setDefaultValidatorPlugins(plugins: TValidatorPlugin[]): void;
getDefaultValidatorPlugins(): TValidatorPlugin[];

mergeErrorMaps(...maps: Record<string, string>[]): Record<string, string>;
iteratePathAncestors(path: string): Iterable<string>;
buildDescendantErrorCounts(errors: Record<string, string>): Record<string, number>;
```

Source: `packages/ui/src/form/validate.ts`, `packages/ui/src/form/error-utils.ts`.

`TValidatorPlugin` contract (from `@atscript/typescript/utils`): `(ctx, def, value) => boolean | undefined`. `ctx` carries `path`, `error(msg)`, and the per-call `context` passed to `validator.validate(value, true, ctx)`.

## @atscript/ui — Value-help

Lazy resolution; per-URL caching.

```typescript
extractValueHelp(prop: TAtscriptAnnotatedType): ValueHelpInfo | undefined;
// Returns { url, targetField } for FK-marked props (@db.rel.FK + target @db.http.path).

extractLiteralOptions(prop: TAtscriptAnnotatedType):
  | { key: string; label: string }[]
  | undefined;
// For pure literal-union props (e.g. 'a' | 'b' | 'c').

isPureLiteralUnion(prop: TAtscriptAnnotatedType): boolean;

valueHelpDictPaths(resolved: ResolvedValueHelp): Set<string>;
// Returns the dict-view paths: PKs + label + descr + attr fields. Used by filter dialogs.

resolveValueHelp(url: string): Promise<ResolvedValueHelp>;
// Lazy — fetches the target's /meta once per URL, builds a TableDef, caches.

resetValueHelpCache(): void;
// Clear the per-URL cache (e.g. on logout).

class ValueHelpClient {
  constructor(client: Client);                                                  // Client from @atscript/db-client
  search(resolved: ResolvedValueHelp, opts?: ValueHelpSearchOptions): Promise<ValueHelpResult>;
}
// ValueHelpSearchOptions = { text?, mode?: 'form' | 'filter', limit?, select?: string[] }
// ValueHelpResult = { items: Record<string, unknown>[] }

// Static option helpers
optKey(option: TFormEntryOptions): string;
optLabel(option: TFormEntryOptions): string;
parseStaticOptions(staticOptions: unknown): TFormEntryOptions[] | undefined;
resolveOptions(prop, scope, opts?): TFormEntryOptions[] | undefined;
// Combines @ui.form.options (static) with @ui.form.fn.options (dynamic if installed).
```

Source: `packages/ui/src/value-help/`.

## @atscript/ui — Decimal helpers

```typescript
enforceScale(value: string, scale: number | undefined): string;
formatDecimalForDisplay(opts: FormatDecimalOptions): string;
parseDecimalInput(raw: string, locale?: string): string | null;

splitDecimalString(s: string): DecimalParts;
joinDecimalString(parts: DecimalParts): string;
groupInteger(integer: string, locale?: string): string;

getDecimalSeparator(locale?: string): string;
getThousandsSeparator(locale?: string): string;
getCurrencyDecimals(code: string, locale?: string): number | undefined;
getCurrencyDisplayParts(code: string, locale?: string): CurrencyDisplay;

interface CurrencyDisplay { symbol: string; placement: 'prefix' | 'suffix'; }
interface DecimalParts { sign: '' | '-'; integer: string; fraction: string; }
interface FormatDecimalOptions {
  value: string;
  scale?: number;
  locale?: string;
  group?: boolean;
}
```

Source: `packages/ui/src/form/decimal-format.ts`. Storage value path is string-only so DB-precision decimals never bounce through floats.

## @atscript/ui — Grid + column helpers

```typescript
DEFAULT_COL_SPAN = 12;
DEFAULT_ROW_SPAN = 1;

parseColSpan(raw: string | undefined): number | undefined;
parseRowSpan(raw: string | undefined): number | undefined;

interface GridSpec { col: { desktop: number; narrow: number }; row: { desktop: number; narrow: number }; }
interface GridSpanArgs { desktop?: string; narrow?: string; }

resolveGridSpec(col: GridSpanArgs | undefined, row: GridSpanArgs | undefined): GridSpec;
buildGridClasses(spec: GridSpec): string;  // emits `col-span-X` / `row-span-X` + narrow variants
```

```typescript
getVisibleColumns(def: TableDef): ColumnDef[];
getSortableColumns(def: TableDef): ColumnDef[];
getFilterableColumns(def: TableDef): ColumnDef[];
getColumn(def: TableDef, path: string): ColumnDef | undefined;

extractMeasurement(prop: TAtscriptAnnotatedType): MeasurementInfo | undefined;
resolveSingularLabel(prop: TAtscriptAnnotatedType): string;  // @ui.form.label.singular || 'item'
```

Source: `packages/ui/src/form/grid.ts`, `packages/ui/src/table/column-resolver.ts`.

## @atscript/ui — Type guards

All take a `FormFieldDef` and narrow on `field.type`:

```typescript
isArrayField(field: FormFieldDef): field is FormArrayFieldDef;     // field.type === 'array'
isObjectField(field: FormFieldDef): field is FormObjectFieldDef;   // field.type === 'object'
isUnionField(field: FormFieldDef): field is FormUnionFieldDef;     // field.type === 'union'
isTupleField(field: FormFieldDef): field is FormTupleFieldDef;     // field.type === 'tuple'
```

## @atscript/ui — Utilities

```typescript
asArray<T>(x: T | T[]): T[];
parseStaticAttrs(staticAttrs: unknown): Record<string, unknown> | undefined;
resolveAttrs(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
  keys?: { staticKey?: string; fnKey?: string },
): Record<string, unknown> | undefined;
// Defaults read @ui.form.attr / @ui.form.fn.attr; pass keys to read table-side or any other surface.

str(value: unknown): string;  // safe string coercion (null/undefined → '')

// Client factory (used by tables + value-help so consumers register one HTTP client)
setDefaultClientFactory(factory: ClientFactory): void;
getDefaultClientFactory(): ClientFactory;          // never undefined — falls back to `new Client(url)`
resetDefaultClientFactory(): void;
type ClientFactory = (url: string) => Client;      // Client from @atscript/db-client

// Meta cache — single /meta fetch per URL shared across tables + value-help. Synchronous: returned promises resolve once the underlying fetch settles.
getMetaEntry(url: string, factory?: ClientFactory): MetaCacheEntry;
resetMetaCache(): void;
interface MetaCacheEntry { client: Client; meta: Promise<MetaResponse>; type: Promise<TAtscriptAnnotatedType>; resolved?: Promise<ResolvedValueHelp>; tableDef?: Promise<TableDef>; }
```

## @atscript/ui — Annotation key constants

Every constant `as const` from `packages/ui/src/shared/annotation-keys.ts`, re-exported from the package index. Use these instead of literal strings.

| Namespace | Constants |
| --- | --- |
| Cross-surface | `UI_TYPE` |
| Form static | `UI_FORM_PLACEHOLDER`, `UI_FORM_HINT`, `UI_FORM_CLASSES`, `UI_FORM_STYLES`, `UI_FORM_AUTOCOMPLETE`, `UI_FORM_DISABLED`, `UI_FORM_OPTIONS`, `UI_FORM_ORDER`, `UI_FORM_TYPE`, `UI_FORM_COMPONENT`, `UI_FORM_HIDDEN`, `UI_FORM_ATTR`, `UI_FORM_GRID_COL_SPAN`, `UI_FORM_GRID_ROW_SPAN`, `UI_FORM_SUBMIT_TEXT`, `UI_FORM_LABEL_SINGULAR`, `UI_FORM_ACTION`, `UI_FORM_PREFIX`, `UI_FORM_PREFIX_REF`, `UI_FORM_PREFIX_ICON`, `UI_FORM_SUFFIX`, `UI_FORM_SUFFIX_REF`, `UI_FORM_SUFFIX_ICON` |
| Table static | `UI_TABLE_WIDTH`, `UI_TABLE_COMPONENT`, `UI_TABLE_HIDDEN`, `UI_TABLE_ATTR`, `UI_TABLE_CLASSES`, `UI_TABLE_STYLES`, `UI_TABLE_TYPE`, `UI_TABLE_ORDER` |
| Dictionary | `UI_DICT_LABEL`, `UI_DICT_DESCR`, `UI_DICT_ATTR`, `UI_DICT_FILTERABLE`, `UI_DICT_SORTABLE`, `UI_DICT_SEARCHABLE` |
| Form dynamic (ui-fns) | `UI_FORM_FN_PREFIX`, `UI_FORM_FN_LABEL`, `UI_FORM_FN_PLACEHOLDER`, `UI_FORM_FN_DESCRIPTION`, `UI_FORM_FN_HINT`, `UI_FORM_FN_HIDDEN`, `UI_FORM_FN_DISABLED`, `UI_FORM_FN_READONLY`, `UI_FORM_FN_OPTIONS`, `UI_FORM_FN_ATTR`, `UI_FORM_FN_VALUE`, `UI_FORM_FN_CLASSES`, `UI_FORM_FN_STYLES`, `UI_FORM_FN_TITLE`, `UI_FORM_FN_SUBMIT_TEXT`, `UI_FORM_FN_SUBMIT_DISABLED` |
| Table dynamic (ui-fns) | `UI_TABLE_FN_PREFIX`, `UI_TABLE_FN_ATTR`, `UI_TABLE_FN_CLASSES`, `UI_TABLE_FN_STYLES` |
| Validation (ui-fns) | `UI_FORM_VALIDATE` |
| DB (re-exported for convenience) | `DB_REL_FK`, `DB_HTTP_PATH`, `DB_AMOUNT_CURRENCY`, `DB_AMOUNT_CURRENCY_REF`, `DB_UNIT`, `DB_UNIT_REF`, `DB_COLUMN_PRECISION` |
| Workflow | `WF_ACTION_WITH_DATA` |
| Meta | `META_LABEL`, `META_ID`, `META_DESCRIPTION`, `META_READONLY`, `META_REQUIRED`, `META_DEFAULT`, `META_SENSITIVE` |
| Expect | `EXPECT_MAX_LENGTH` |

`UI_FORM_FN_PREFIX = 'ui.form.fn.'` and `UI_TABLE_FN_PREFIX = 'ui.table.fn.'` are the prefix strings — `DynamicFieldResolver.hasComputedAnnotations` matches them with `startsWith`.

## @atscript/ui-fns

Computed annotation runtime — opt-in.

```typescript
installDynamicResolver(): void;
// 1. setResolver(new DynamicFieldResolver())
// 2. setDefaultValidatorPlugins([uiFnsValidatorPlugin()])
// Call once at app startup before any createFormDef / createTableDef.

class DynamicFieldResolver implements FieldResolver {
  resolveFieldProp<T>(prop, fnKey, staticKey, scope, opts?): T | undefined;
  resolveFormProp<T>(type, fnKey, staticKey, scope, opts?): T | undefined;
  hasComputedAnnotations(prop): boolean;  // true when any ui.form.fn.* / ui.table.fn.* present
}

// Fn compilers — compile a JS function string and cache by string identity.
compileFieldFn<T>(fnStr: string): (scope: TFnScope) => T;
// (v, data, context, entry) => T

compileTopFn<T>(fnStr: string): (scope: TFnScope) => T;
// (data, context) => T   — form-level scope (no v, no entry)

compileValidatorFn(fnStr: string): (scope: TFnScope) => true | string;
// (value, data, context, entry) => true | string   — for @ui.form.validate

buildFieldEntry(
  prop: TAtscriptAnnotatedType,
  baseScope: TFnScope,
  path: string,
  opts?: TBuildFieldEntryOpts,
): TFnScope;
// Materialises `entry` (TFieldEvaluated snapshot) and returns the full scope.

uiFnsValidatorPlugin(): TValidatorPlugin;
// TValidatorPlugin that processes @ui.form.validate strings during validate.
```

```typescript
export interface TFnScope<V = unknown, D = Record<string, unknown>, C = Record<string, unknown>> {
  v?: V;
  data: D;
  context: C;
  entry?: TFieldEvaluated;
  action?: string;
}

export type TComputed<T> = T | ((scope: TFnScope) => T);

export interface TFieldEvaluated {
  field: string;
  type: string;
  component?: string;
  name: string;
  disabled?: boolean;
  optional?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  options?: TFormEntryOptions[];
}

export interface TValidatorContext {
  data: Record<string, unknown>;
  context: Record<string, unknown>;
}

export type TBuildFieldEntryOpts = Partial<Pick<TFieldEvaluated,
  'name' | 'type' | 'component' | 'optional' | 'disabled' | 'hidden' | 'readonly'
>>;
```

Source: `packages/ui-fns/src/index.ts`, `packages/ui-fns/src/runtime/types.ts`, `packages/ui-fns/src/runtime/dynamic-resolver.ts`, `packages/ui-fns/src/runtime/validator-plugin.ts`.

**Security model.** Fn strings are compiled with `new Function('v', 'data', 'context', 'entry', 'return (' + fnStr + ')(v, data, context, entry)')` — i.e. host-scope JS, not sandboxed. Only safe for schemas validated at build time by the atscript compiler. Never feed runtime/user-controlled `.as` into a runtime where `installDynamicResolver()` is active.

## @atscript/ui-table — filter model

```typescript
export type FilterConditionType =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts' | 'ends' | 'bw'
  | 'null' | 'notNull' | 'regex';

export interface FilterCondition {
  type: FilterConditionType;
  value: (string | number | boolean)[];
}
// `bw` uses value[0] (low) + value[1] (high). null/notNull ignore value.

export type FieldFilters = Record<string, FilterCondition[]>;

export type ColumnFilterType = 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'ref';
```

Helpers:

```typescript
NULL_OPS: ReadonlySet<FilterConditionType>;     // { 'null', 'notNull' }
isFilled(condition: FilterCondition): boolean;
hasSecondValue(type: FilterConditionType): boolean;   // 'bw' → true
isSimpleEq(condition: FilterCondition): boolean;
conditionLabel(type: FilterConditionType): string;
filledFilterCount(filters: FieldFilters): number;
filterTokenLabel(path: string, conditions: FilterCondition[], columnLabel?: string): string;

conditionsForType(columnType: ColumnFilterType, nullable?: boolean): readonly FilterConditionType[];
columnFilterType(columnType: string): ColumnFilterType;
defaultCondition(columnType: ColumnFilterType): FilterConditionType;     // text/enum/ref → contains, else eq

parseFilterInput(text: string, columnType: ColumnFilterType, nullable?: boolean): FilterCondition | undefined;
formatFilterCondition(condition: FilterCondition): string;

escapeRegex(input: string): string;
unescapeRegex(input: string): string;
```

Translators:

```typescript
filtersToUniqueryFilter(fieldFilters: FieldFilters): FilterExpr | undefined;
uniqueryFilterToFieldFilters(expr: FilterExpr): FieldFilters;
// FilterExpr comes from @uniqu/core.
```

Date shortcuts (relative date filters):

```typescript
interface DateShortcut { label: string; dates: [start: string, end: string]; }
dateShortcuts(now?: Date): DateShortcut[];
// Last 7/30/90 Days, Last 6/12 Months, Month to Date, Year to Date — ISO date pairs for `bw`
```

Source: `packages/ui-table/src/filters/`.

## @atscript/ui-table — preset model

In-memory dict shape vs wire entries-array shape — atscript has no `Record<string, T>`, so the wire form uses entries arrays.

```typescript
// In-memory (runtime)
export interface PresetSnapshot {
  columns?: {
    columnNames: string[];
    columnWidths?: Record<string, string>;   // override-only diff vs defaults
  };
  filters?: string[];                         // displayed filter field paths
  filterOps?: FieldFilters;                   // applied filter conditions
  sorters?: SortControl[];
  itemsPerPage?: number;
}

// Wire
export interface PresetSnapshotWire {
  columns?: { columnNames: string[]; columnWidths?: PresetColumnWidthEntry[]; };
  filters?: string[];
  filterOps?: PresetFilterOpEntry[];
  sorters?: PresetSorterEntry[];
  itemsPerPage?: number;
}
export interface PresetColumnWidthEntry { field: string; width: string; }
export interface PresetFilterOpEntry { field: string; conditions: FilterCondition[]; }
export interface PresetSorterEntry { field: string; direction: 'asc' | 'desc'; }

// Aspect opt-in: presence of a top-level key claims that aspect.
export type PresetAspect = 'columns' | 'filters' | 'filterOps' | 'sorters' | 'itemsPerPage';
export const PRESET_ASPECTS: readonly PresetAspect[];
export type AspectMask = Partial<Record<PresetAspect, boolean>>;
derivePresetAspects(content: PresetSnapshot | PresetSnapshotWire | unknown): PresetAspect[];

// Wire converters
toWireSnapshot(snapshot: PresetSnapshot): PresetSnapshotWire;
fromWireSnapshot(wire: PresetSnapshotWire): PresetSnapshot;
```

Preset data shapes (application layer):

```typescript
export interface PresetData {
  label: string;                          // public-name unique within (app, tableKey)
  content?: PresetSnapshotWire;
}
export interface UserConfData {
  defaultPresetId?: string;
  favPresetIds?: string[];
}
export interface AppConfData {
  appearance?: 'system' | 'light' | 'dark';
  language?: string;                       // BCP-47, max 5 chars
  timezone?: string;                       // IANA, max 64 chars
  density?: 'compact' | 'cozy' | 'comfortable';
  dateFormat?: 'iso' | 'us' | 'eu';
  firstDayOfWeek?: 0 | 1 | 6;
  customJson?: string;                     // max 1024 chars
}
export type AsPresetEntryData = PresetData | UserConfData | AppConfData;

export interface AsPresetEntryRow {
  id: string;
  type: 'preset' | 'userConf' | 'appConf';
  app: string;
  tableKey?: string;
  user: string;
  userLabel?: string;
  public?: boolean;
  label?: string;
  publicLabel?: string;
  aspects?: PresetAspect[];
  data: AsPresetEntryData;
  createdAt: number;
  updatedAt: number;
}

export interface PresetCapabilities {
  canPublish: boolean;
  presetLimit: number;
  userId: string;
}

export type AsPresetsErrorCode =
  | 'preset_limit_reached' | 'reserved_id' | 'public_name_conflict'
  | 'missing_scope' | 'missing_id' | 'invalid_type' | 'type_immutable'
  | 'identity_immutable' | 'preset_not_found' | 'publish_forbidden'
  | 'action_unsupported';

export interface PresetLimitReachedBody { code: 'preset_limit_reached'; limit: number; count: number; }
```

Preset ids + reserved prefixes:

```typescript
SYSTEM_PRESET_PREFIX = 'sys:';
USER_CONF_PREFIX = 'uc:';
APP_CONF_PREFIX = 'ac:';
STANDARD_PRESET_ID = 'sys:standard';
RESERVED_ID_PREFIXES: readonly string[];

userConfId(user: string, app: string, tableKey: string): string;   // 'uc:user:app:tableKey'
appConfId(user: string, app: string): string;                       // 'ac:user:app'
isSystemPresetId(id: string | null | undefined): boolean;           // startsWith 'sys:'
normaliseSystemPresetId(id: string): string;
```

System presets:

```typescript
interface SystemPreset { id: string; label: string; content: PresetSnapshot; }
interface SystemPresetInput { id: string; label: string; content: PresetSnapshot | PresetSnapshotWire; }
resolveSystemPresets(input?: SystemPresetInput[]): SystemPreset[];
```

Dirty detection:

```typescript
stableStringify(value: unknown): string;                      // stable JSON for diffing
isDirtyAgainst(active: PresetSnapshot, current: PresetSnapshot): boolean;
```

Local drafts (localStorage overlay):

```typescript
export type PresetDraft = Omit<PresetSnapshot, 'filterOps'>;
export const DRAFT_PERSISTED_ASPECTS: readonly DraftPersistedAspect[];
export type DraftPersistedAspect = (typeof DRAFT_PERSISTED_ASPECTS)[number];

serializeDraft(draft: PresetDraft, persisted: DraftPersistedAspect[]): string;
deserializeDraft(raw: string): PresetDraft | undefined;
isEmptyDraft(draft: PresetDraft): boolean;
draftMatchesPreset(draft: PresetDraft, preset: PresetSnapshot): boolean;
```

Source: `packages/ui-table/src/presets/`.

## @atscript/ui-table — HTTP clients

```typescript
class PresetsClient {
  constructor(config: PresetsClientConfig);
  list(opts?: { capabilities?: boolean }): Promise<PresetsListResult>;
  loadCapabilities(): Promise<PresetCapabilities>;
  savePreset(id: string, label: string, snapshot: PresetSnapshot): Promise<void>;
  savePresetAs(label: string, snapshot: PresetSnapshot, opts?: PresetsSaveAsOptions): Promise<PresetsSaveResult>;
  renamePreset(id: string, label: string): Promise<void>;
  setPublic(id: string, value: boolean): Promise<void>;
  deletePreset(id: string): Promise<void>;
  upsertUserConf(existing: AsPresetEntryRow | null, patch: Partial<UserConfData>, user?: string): Promise<void>;
}

class PresetsHttpError extends Error { readonly status: number; }
isAuthError(err: unknown): boolean;   // true for HTTP 401/403 on ClientError or PresetsHttpError

interface PresetsClientConfig { url: string; app: string; tableKey: string; client?: Client; clientFactory?: (url: string) => Client; fetch?: typeof globalThis.fetch; }
interface PresetsListResult { presets: AsPresetEntryRow[]; userConf: AsPresetEntryRow | null; capabilities: PresetCapabilities | null | undefined; denied: boolean; }
interface PresetsSaveAsOptions { public?: boolean; }
interface PresetsSaveResult { id: string; }

class AppPrefsClient {
  constructor(config: AppPrefsClientConfig);
  load(): Promise<AppPrefsLoadResult>;
  save(existing: AsPresetEntryRow | null, patch: Partial<AppConfData>, user?: string): Promise<string | null>;
}

interface AppPrefsClientConfig { url: string; app: string; client?: Client; clientFactory?: (url: string) => Client; }
interface AppPrefsLoadResult { row: AsPresetEntryRow | null; prefs: AppConfData | null; denied: boolean; }
```

Source: `packages/ui-table/src/presets/presets-client.ts`, `packages/ui-table/src/presets/app-prefs-client.ts`. Translates intent → HTTP; holds **no** reactive state.

## @atscript/ui-table — query builder

```typescript
export interface BuildTableQueryOptions {
  visibleColumnPaths: string[];     // → controls.$select
  sorters: SortControl[];
  forceSorters?: SortControl[];     // prepended via mergeSorters
  filters: FieldFilters;
  forceFilters?: FilterExpr;        // AND-merged via mergeFilters
  search?: string;                  // → controls.$search or $search:<index>
  searchIndex?: string;
  includeActions?: boolean;         // → controls.$actions = true
}

buildTableQuery(opts: BuildTableQueryOptions): Uniquery;                  // from @uniqu/core
mergeSorters(force: SortControl[], user: SortControl[]): SortControl[];
mergeFilters(force?: FilterExpr, user?: FilterExpr): FilterExpr | undefined;  // AND-merge, parser-safe
```

Source: `packages/ui-table/src/query/build-table-query.ts:40`. Pure function — no framework deps.

## @atscript/ui-table — URL bridge

```typescript
export interface UrlQueryStateLike { /* subset of TableStateData read from */ }
export interface UrlQueryStateSnapshot { /* serialisable snapshot */ }
export interface UrlQueryDefaults { /* per-aspect defaults to suppress in URL */ }
export interface UrlQueryParseOptions { /* parser knobs */ }
export interface UrlQuerySync { /* return shape of stateToUrlQueryString */ }

export type AspectGate = 'all' | 'none' | Set<string>;
resolveAspectGate(value: boolean | string[] | undefined): AspectGate;

stateToUrlQueryString(
  state: UrlQueryStateLike,
  defaults: UrlQueryDefaults,
): string;

urlQueryStringToState(
  urlString: string,
  opts?: UrlQueryParseOptions,
): UrlQueryStateSnapshot;
```

Per-aspect gates live on `UrlQueryDefaults.sync` (encoder) and `UrlQueryParseOptions.sync` (decoder) — pass the same `sync` config to both directions or the echo guard mismatches.

Source: `packages/ui-table/src/query/url-query.ts`.

## @atscript/ui-table — selection helpers

```typescript
export type SelectionMode = 'none' | 'single' | 'multi';

togglePk(selected: string[], pk: string, mode: SelectionMode): string[];
trimSelection(selected: string[], visiblePks: string[]): string[];
rowsToPks(rows: Record<string, unknown>[], primaryKeys: string[]): string[];
```

Source: `packages/ui-table/src/selection/selection-fns.ts`.

## @atscript/ui-table — window-mode helpers

```typescript
DEFAULT_ROW_HEIGHT_PX: number;

interface PageAlignedBlock { page: number; firstIndex: number; }
pageAlignedBlocksFor(skip: number, limit: number, blockSize: number): PageAlignedBlock[];
blockStartFor(absIdx: number, blockSize: number): number;
clampTopIndex(topIndex: number, totalCount: number, viewport: number): number;

interface MergeResult { /* absorbed range + delta */ }
walkForwardAbsorb(/* ... */): MergeResult;
walkBackwardAbsorb(/* ... */): MergeResult;

export type FetchPlanMode = 'jump' | 'steady';
interface FetchPlan { skip: number; limit: number; mode: FetchPlanMode; }
interface PlanFetchArgs { top: number; viewport: number; totalCount: number; cache: Map<number, unknown>; blockSize: number; buffer: number; }
planFetch(args: PlanFetchArgs): FetchPlan | null;
```

Source: `packages/ui-table/src/state/window/`.

## @atscript/ui-table — column widths

```typescript
interface ColumnWidthEntry { w: string; d: string; }   // current width + default
type ColumnWidthsMap = Record<string, ColumnWidthEntry>;
MAX_DEFAULT_COLUMN_WIDTH_PX = 320;

computeDefaultColumnWidth(col: ColumnDef): string;
// Resolution: @ui.table.width > type+@expect.maxLen-derived > 320px clamp.

reconcileColumnWidthDefaults(
  current: ColumnWidthsMap,
  columns: ColumnDef[],
): ColumnWidthsMap;
// On TableDef change, recomputes defaults but preserves user-overridden widths.
```

Source: `packages/ui-table/src/columns/column-widths.ts`.

## @atscript/ui-table — state contracts

The contract any framework wrapper must satisfy. Values are plain — the framework wraps them in its own reactive primitives. Source: `packages/ui-table/src/state/table-state-types.ts`.

```typescript
export type ConfigTab = 'columns' | 'filters' | 'sorters';

export interface TableStateData {
  tableDef: TableDef | null;
  loadingMetadata: boolean;
  columnNames: string[];
  columns: ColumnDef[];
  allColumns: ColumnDef[];
  columnWidths: ColumnWidthsMap;
  filterFields: string[];           // displayed filter inputs
  filters: FieldFilters;            // applied conditions
  sorters: SortControl[];
  results: Record<string, unknown>[];
  resultsStart: number;
  windowCache: Map<number, Record<string, unknown>>;
  windowLoading: Set<number>;
  topIndex: number;
  viewportRowCount: number;
  querying: boolean;
  queryingNext: boolean;
  totalCount: number;
  loadedCount: number;
  pagination: PaginationControl;
  queryError: Error | null;
  metadataError: Error | null;
  mustRefresh: boolean;
  searchTerm: string;
}

export interface TableStateMethods {
  query(): void;                     // microtask-coalesced refresh
  queryImmediate(): Promise<void>;   // sync refresh, settles on response
  queryNext(): void;                 // append-style extension, no page mutation
  loadRange(skip: number, limit: number): Promise<void>;
  invalidate(): void;                // wipe + reset, no refetch
  dataAt(absIdx: number): Record<string, unknown> | undefined;
  loadingAt(absIdx: number): boolean;
  errorAt(absIdx: number): Error | null;
  resetFilters(): void;
  showConfigDialog(tab?: ConfigTab): void;
  addFilterField(path: string): void;
  removeFilterField(path: string): void;                            // does NOT clear applied filter value
  setFieldFilter(path: string, conditions: FilterCondition[]): void; // does NOT touch filterFields
  removeFieldFilter(path: string): void;                            // does NOT remove filterField
  setColumnWidth(path: string, width: string): void;
  resetColumnWidth(path: string): void;
  openFilterDialog(column: ColumnDef): void;
  closeFilterDialog(): void;
}
```

**Invariants** — mutators are pure (each touches exactly one entity). Display state (`filterFields`) and applied state (`filters`) are independent. Re-query / pagination-reset / `mustRefresh` flag are reactions on root watchers, not in mutators. `state.query()` is reserved for user-initiated refresh; all state-change → refetch flows go through watchers.

## @atscript/ui-table — utilities

```typescript
debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T;

arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean;
sameColumnSet<T>(a: readonly T[], b: readonly T[]): boolean;
setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean;
sortersEqual(a: SortControl[], b: SortControl[]): boolean;

export type ColumnReorderPosition = 'before' | 'after';
reorderColumnNames(
  names: string[],
  fromPath: string,
  toPath: string,
  position: ColumnReorderPosition,
): string[];   // pure — returns input unchanged when paths missing or move is no-op
```

Source: `packages/ui-table/src/utils/`.
