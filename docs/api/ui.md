# @atscript/ui

Framework-agnostic core for type-driven UIs. Reads compiled Atscript metadata, builds form and table definitions, exposes a pluggable field resolver, validators, value-help, and a battery of pure utilities consumed by every Vue package. No Vue, no React — plain TypeScript.

## Contents

- [Plugin](#plugin)
- [Form types](#form-types)
- [Form factories](#form-factories)
- [Table types](#table-types)
- [Table factory](#table-factory)
- [Navigate action hrefs](#navigate-action-hrefs)
- [Model nav routes](#model-nav-routes)
- [Field resolver](#field-resolver)
- [Annotation key constants](#annotation-key-constants)
- [Validators](#validators)
- [Form diff engine](#form-diff-engine)
- [Path utilities](#path-utilities)
- [Value-help](#value-help)
- [Grid layout](#grid-layout)
- [Decimal helpers](#decimal-helpers)
- [Column helpers](#column-helpers)
- [Error map utilities](#error-map-utilities)
- [Type guards](#type-guards)
- [Misc utilities](#misc-utilities)
- [Client factory](#client-factory)
- [Meta cache](#meta-cache)

## Plugin

`@atscript/ui/plugin` exposes the build-time plugin that registers every static `@ui.*` annotation key. Wire it in `atscript.config.ts`:

```typescript
import uiPlugin from "@atscript/ui/plugin";

export default {
  plugins: [uiPlugin()],
};
```

For dynamic `@ui.fn.*` and `@ui.form.validate`, also register [`@atscript/ui-fns/plugin`](/api/ui-fns).

## Form types

### `FormDef`

Complete form definition produced by `createFormDef(type)`.

```typescript
interface FormDef {
  type: TAtscriptAnnotatedType;
  rootField: FormFieldDef;
  fields: FormFieldDef[];
  flatMap: Map<string, TAtscriptAnnotatedType>;
}
```

### `FormFieldDef`

Thin pointer to one atscript prop. Metadata lives on `prop.metadata` and is resolved on demand.

```typescript
interface FormFieldDef {
  /** Dot-separated path relative to the parent data container. `""` = root. */
  path: string;
  prop: TAtscriptAnnotatedType;
  /** Render-kind: structural names (`array`, `object`, `union`, `tuple`) or primitive override from `@ui.form.type`. */
  type: string;
  /**
   * Optional `@ui.form.type` / `@ui.type` override that lets a structured kind
   * (`array`, `object`, `union`, `tuple`) dispatch to a different built-in
   * renderer in the `:types` map. Reserved for built-in ids — custom
   * components are wired via `@ui.form.component` + `:components`.
   */
  customType?: string;
  phantom: boolean;
  name: string;
  /** True when no `ui.fn.*` keys exist on the prop — perf flag. */
  allStatic: boolean;
  /** `@ui.form.pushDown` — render below the submit button instead of in the main grid. */
  pushDown: boolean;
  /**
   * Value-help target for an FK field, resolved once by `extractValueHelp()`
   * while the def is built (since 0.1.134). `undefined` for non-FK fields.
   * Renderers read this instead of re-walking the annotations per mount —
   * `<AsField>` forwards it to the control as the `valueHelp` prop.
   */
  valueHelpInfo?: ValueHelpInfo;
  /**
   * Set for a `@db.column.derived` field (server-computed). `<AsField>` renders
   * it read-only; validators and `buildFormDiff` skip it. Since 0.1.144.
   */
  derived?: true;
}
```

### `FormArrayFieldDef`, `FormObjectFieldDef`, `FormUnionFieldDef`, `FormTupleFieldDef`

Extended field defs for structural kinds.

```typescript
interface FormArrayFieldDef extends FormFieldDef {
  itemType: TAtscriptAnnotatedType;
  itemField: FormFieldDef;
}

interface FormObjectFieldDef extends FormFieldDef {
  objectDef: FormDef;
}

interface FormUnionFieldDef extends FormFieldDef {
  unionVariants: FormUnionVariant[];
}

interface FormTupleFieldDef extends FormFieldDef {
  itemFields: FormFieldDef[];
}
```

### `FormUnionVariant`

One branch of a union.

```typescript
interface FormUnionVariant {
  label: string;
  type: TAtscriptAnnotatedType;
  /** Pre-built FormDef for object variants. */
  def?: FormDef;
  /** Pre-built field def for primitive variants. */
  itemField?: FormFieldDef;
  /** "string" | "number" | "boolean" for primitive variants. */
  designType?: string;
}
```

### `TFormAction`

```typescript
interface TFormAction {
  id: string;
  label: string;
}
```

### `TFormEntryOptions`

A select/radio option — plain string or `{ key, label }` pair.

```typescript
type TFormEntryOptions = { key: string; label: string } | string;
```

## Form factories

### `createFormDef(type, opts?)`

Builds a `FormDef` from an annotated type. Walks props, pre-resolves structural sub-defs, and caches the flat map.

```typescript
function createFormDef(type: TAtscriptAnnotatedType, opts?: CreateFormDefOptions): FormDef;

interface CreateFormDefOptions {
  versionColumn?: string;
  /** `meta.fields` — a field marked `computed` is marked `derived`. Since 0.1.147. */
  metaFields?: Record<string, { computed?: boolean }>;
}
```

When `opts.versionColumn` is supplied, the matching prop is excluded from the returned `fields[]` (so `AsForm`'s renderer doesn't paint it) but remains in `flatMap` and in the form's underlying data wrapper. This is the contract OCC needs: hide the version input from users while keeping the value in the wire payload so the server can lift it into `$cas`. Pass `meta.versionColumn` directly — it is the logical field name (see [`MetaResponse`](#metaresponse)).

A `@db.column.derived` field (a top-level column the server computes from a `@db.json` leaf) needs no option: `createFormDef` reads the annotation from the type — `/meta` keeps it in the serialized type since `@atscript/db` 0.1.142 — and sets [`FormFieldDef.derived`](#formfielddef). `<AsField>` renders the field read-only with no required marker, the [validators](#validators) never fail it (a required derived field left empty on a create form passes), and `buildFormDiff` never sends it. Since 0.1.144.

A computed view column (`@db.compute`) carries no annotation on the client — the server keeps it out of the serialized type — so pass `opts.metaFields: meta.fields`: a field `/meta` marks `computed` gets the same `derived` treatment. Views are read-only, so this matters only for a form you build from a view's type (a read-only detail form, say). Since 0.1.147.

```ts
formDef.value = createFormDef(deserializeAnnotatedType(meta.type), {
  versionColumn: meta.versionColumn,
});
```

See the [Edit forms with optimistic concurrency](/tables/edit-form-occ) pattern guide for the end-to-end flow.

### `buildUnionVariants(type)`

Returns the variant list for a union prop — used internally by `createFormDef` for union fields and union array items.

```typescript
function buildUnionVariants(type: TAtscriptAnnotatedType): FormUnionVariant[];
```

### `createFormData(type, resolver?)`

Creates the wrapped data container `{ value: domainData }` populated from atscript defaults and `@meta.default`. The optional `resolver` (`TFormValueResolver`) overrides the per-field defaulting strategy.

```typescript
function createFormData<T extends TAtscriptAnnotatedType>(
  type: T,
  resolver?: TFormValueResolver,
): { value: TAtscriptDataType<T> };
```

### `createFormValueResolver(data?, context?)`

Returns a value resolver that reads `@meta.default` or `@ui.form.fn.value`, given a scope.

```typescript
type TFormValueResolver = (prop: TAtscriptAnnotatedType, path: string) => unknown;

function createFormValueResolver(
  data?: Record<string, unknown>,
  context?: Record<string, unknown>,
): TFormValueResolver;
```

## Table types

### `TableDef`

Complete table definition built by `createTableDef(meta, type)`.

```typescript
interface TableDef {
  type: TAtscriptAnnotatedType;
  columns: ColumnDef[];
  flatMap: Map<string, TAtscriptAnnotatedType>;
  /** Readable `meta.fields` paths — the gate for `@ui.table.selectWith` / `alwaysSelected`; includes `@ui.table.exclude` fields, excludes `writeOnly` ones (since 0.1.141). */
  fetchableFields: Set<string>;
  primaryKeys: string[];
  /** Preferred row identifier for URL/wire addressing. */
  preferredId: string[];
  /** `preferredId` + every delegated action's `idMap` path — the fields action identifiers are built from. Equals `preferredId` when no action has an `idMap`. Since 0.1.147. */
  identifierFields: string[];
  /** Mirrors `MetaResponse.versionColumn` — name of the OCC version column when the table opts into `@db.column.version`. */
  versionColumn?: string;
  crud: TCrudPermissions;
  canRemove: boolean;
  actions: TableActionsModel;
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  relations: RelationInfo[];
}
```

`createTableDef` propagates `versionColumn` from the meta envelope and skips the matching entry from `def.columns`, so filter/sort/column-picker dialogs ignore the version column automatically — see [Edit forms with optimistic concurrency](/tables/edit-form-occ).

### `ColumnDef`

A single column definition built from field metadata + annotations.

```typescript
interface ColumnDef {
  path: string;
  label: string;
  type: string;
  /**
   * Scalar storage kind of the value — what the server's filter guard checks,
   * derived from the atscript type by `createTableDef`. Filter UIs and the
   * query builder read it to pick the filter kind (a `timestamp` gets a
   * date-time filter) and to encode values. `undefined` for arrays, objects,
   * JSON and mixed unions: no coercion. Since 0.1.148.
   */
  valueKind?: ColumnValueKind;
  component?: string;
  /** Extra sibling leaf paths to fetch when this column is visible — see [Custom Cells](/tables/custom-cells). */
  selectWith?: string[];
  sortable: boolean;
  /** Value comparisons accepted (the server's `filterable`). */
  filterable: boolean;
  /** Narrower operators accepted when `filterable` is `false`, e.g. `["$exists"]` on a JSON-stored column. Since 0.1.139. */
  filterOps?: string[];
  nullable: boolean;
  visible: boolean;
  width?: string;
  maxLen?: number;
  order: number;
  /** `value` (since 0.1.148) is the typed literal — `true`, `3` — that a filter sends; `key` is its string form. Always set by `createTableDef`; a hand-built column may omit it. */
  options?: { key: string; label: string; value?: string | number | boolean }[];
  valueHelpInfo?: ValueHelpInfo;
  /** Distinct-values picker (`@ui.valueHelp.distinct`): the table's own controller answers the values of `field`. Since 0.1.148. */
  distinct?: { url: string; field: string };
  currencyCode?: string;
  currencyRefField?: string;
  unitCode?: string;
  unitRefField?: string;
  precisionScale?: number;
  /** Synthesised columns (e.g. row-actions) — locked chrome, excluded from `columnNames`. */
  fixed?: boolean;
}
```

### `ColumnValueKind`

Since 0.1.148.

```typescript
type ColumnValueKind =
  | "string" // string
  | "date" // string.date (stored as `YYYY-MM-DD`)
  | "isoDate" // string.isoDate (stored as an ISO date-time string)
  | "number" // number, float
  | "integer" // number.int (or @expect.int / @db.default.increment / now / agg.count)
  | "decimal" // decimal (strings end to end)
  | "timestamp" // number.timestamp (epoch milliseconds)
  | "boolean";
```

A union whose non-null members agree on one kind takes it (`1 | 2` is `number`, `'a' | 'b' | null` is `string`); anything else has none. See [Filterable columns](/tables/filtering#storage-kind-valuekind).

### `MetaResponse`

The payload returned by the `moost-db` `/meta` endpoint.

```typescript
interface MetaResponse {
  searchable: boolean;
  vectorSearchable: boolean;
  searchIndexes: SearchIndexInfo[];
  primaryKeys: string[];
  preferredId: string[];
  versionColumn?: string;
  crud: TCrudPermissions;
  actions: TDbActionInfo[];
  relations: RelationInfo[];
  fields: Record<string, FieldMeta>;
  type: TSerializedAnnotatedType;
  /** The controller's declared display-only fields (`@DbDecorations`, `@atscript/moost-db` 0.1.148+) as a serialized plain interface. Absent on older servers. Since 0.1.148. */
  decorations?: TSerializedAnnotatedType;
}

interface FieldMeta {
  sortable: boolean;
  filterable: boolean;
  /** Present only when `filterable` is `false` but narrower predicates pass (`@atscript/moost-db` 0.1.132+). Since 0.1.139. */
  filterOps?: string[];
  /** The caller may write but not read this field (kept in `/meta` for forms). Never a column, never fetchable. Since 0.1.141. */
  writeOnly?: boolean;
  /** `@db.column.derived` — server-computed; a written value is dropped (`@atscript/db` 0.1.141+). Forms read the annotation from the type instead. Since 0.1.144. */
  derived?: boolean;
  /** Computed view column (`@db.compute`, `@atscript/db` 0.1.147+). An ordinary column for sorting / filtering; read-only in forms via `CreateFormDefOptions.metaFields`. Since 0.1.147. */
  computed?: boolean;
  /** Display-only value the controller computes (`@DbDecorations`) — selectable, never filterable / sortable / groupable. `createTableDef` builds its column from `MetaResponse.decorations`. Since 0.1.148. */
  decoration?: boolean;
  /** `$groupBy` on this field passes the server's gate (`@atscript/moost-db` 0.1.148+). With `filterable` and `@ui.valueHelp.distinct` it enables the distinct-values picker. Since 0.1.148. */
  groupable?: boolean;
}

interface SearchIndexInfo {
  name: string;
  description?: string;
  type?: "text" | "vector";
}

interface RelationInfo {
  name: string;
  direction: "to" | "from" | "via";
  isArray: boolean;
  /** `@db.rel.filterable` — the server accepts `name: { $some | $none: … }` filters (`@atscript/moost-db` 0.1.147+). Since 0.1.147. */
  filterable?: boolean;
}
```

**`versionColumn?: string`** — logical field name of the server-managed row version field on OCC-protected tables (declared with `@db.column.version` in your `.as` schema). A `@db.column 'row_version'` rename changes only the storage column; `/meta` reports the field name you read and write (`@atscript/db` 0.1.141+ — earlier servers sent the storage name, which broke OCC for renamed fields). Absent on tables that don't opt into OCC. Consumer code should pass this through to `createFormDef` so the version field doesn't render as an editable input, while still riding in the form data for the server's `$cas` round-trip. See the [Edit forms with optimistic concurrency](/tables/edit-form-occ) pattern guide for the full flow.

### `TableActionsModel`

Server-declared actions grouped by `level`.

```typescript
interface TableActionsModel {
  table: TDbActionInfo[];
  row: TDbActionInfo[];
  rows: TDbActionInfo[];
  default: {
    table?: TDbActionInfo;
    row?: TDbActionInfo;
    rows?: TDbActionInfo;
  };
}
```

### `TableQueryState`, `SortControl`, `PaginationControl`

```typescript
interface SortControl {
  field: string;
  direction: "asc" | "desc";
}
interface PaginationControl {
  page: number;
  itemsPerPage: number;
}

interface TableQueryState {
  sort?: SortControl[];
  pagination?: PaginationControl;
  search?: string;
  filters?: Record<string, unknown>;
}
```

## Table factory

### `createTableDef(meta, type)`

Builds a `TableDef` from a `MetaResponse` plus the deserialized atscript type.

```typescript
function createTableDef(meta: MetaResponse, type: TAtscriptAnnotatedType): TableDef;
```

See [Annotations Reference](/tables/annotations) for how `@ui.table.*` and `@db.*` annotations populate `ColumnDef`.

Since 0.1.148 the server's declared display-only fields become columns too: the top-level props of `meta.decorations` that `meta.fields` lists with `decoration: true` are built by the same code (label, `@ui.table.*`, display type) as `sortable: false`, `filterable: false`, `nullable: true` columns with no value help, and join `flatMap` / `fetchableFields`. A server that sends no `decorations` is unchanged — see [Customization](/tables/customization#server-declared-decoration-columns).

Only readable fields become columns: a path must be listed in `meta.fields` and not be `writeOnly`. Since 0.1.141 a `writeOnly` field and a top-level field missing from `meta.fields` are no longer columns — either would fail the query's `$select`. See [Fields Hidden by Role](/tables/hidden-fields#which-fields-a-table-can-use).

## Navigate action hrefs

### `navigateHrefFor(action, id, preferredId)`

Computes, at render time, the href a `processor: 'navigate'` action would open — interpolating `$1` in `action.value` with the row's URL-encoded `preferredId`. Lets a custom action-chrome renderer produce the same anchor the built-in `<AsRowActions>` / `<AsTableActions>` do. Returns `undefined` when no link is possible (not a navigate action, or a row-level action with no identifiable pk) → render a `<button>` and let the client handle the invoke. Since 0.1.147 a delegated action (`action.idMap`) reads `id` as this table's row and encodes the owner's identification it maps to, in `Object.keys(idMap)` order (no link when a mapped column is missing).

```typescript
function navigateHrefFor(
  action: TDbActionInfo,
  id: Record<string, unknown> | undefined,
  preferredId: readonly string[],
): string | undefined;
```

See [Navigate actions](/tables/actions#navigate-actions) for the rendering and click-semantics narrative.

## Model nav routes

### `buildModelRoutes(models)`

Derives a declarative route registry from a list of annotated model types (typically the `atscriptModels` manifest generated by `@atscript/db`'s `dbPlugin({ manifest })`). Only DB entities (`@db.table` / `@db.view` / `@db.view.for`) with a derivable path are included; the result is sorted by `order` ascending (undefined last, stable).

```typescript
function buildModelRoutes(models: readonly TAtscriptAnnotatedType[]): TModelRoute[];
```

### `TModelRoute`

One navigable route derived from a DB-backed model's metadata.

```typescript
interface TModelRoute {
  model: TAtscriptAnnotatedType;
  /** Route path without leading/trailing slashes — mountable anywhere. */
  path: string;
  /** Display label — from @meta.label or humanized last path segment. */
  label: string;
  kind: "table" | "view";
  /** Nav section from @ui.nav.group — grouping is the consumer's job. */
  group?: string;
  /** Position from @ui.nav.order — lower first, undefined last. */
  order?: number;
  /** From @ui.nav.hidden — hidden routes are still returned; consumers filter. */
  hidden?: boolean;
}
```

See [Model Routes & Nav](/tables/model-routes) for the manifest → routes → router pipeline, the path/label derivation contract, and consumer mapping examples.

## Field resolver

The resolver is pluggable so static-only consumers ship with zero `new Function` overhead and dynamic consumers (`@atscript/ui-fns`) opt in by replacing the global instance.

### `FieldResolver`

```typescript
interface FieldResolver {
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

interface TResolveOptions<T> {
  staticAsBoolean?: boolean;
  transform?: (raw: unknown) => T;
}
```

### `StaticFieldResolver`

Class implementing `FieldResolver` with static-only semantics — fn keys are ignored.

### `setResolver(resolver)` / `getResolver()` / `defaultResolver`

```typescript
function setResolver(resolver: FieldResolver): void;
function getResolver(): FieldResolver;
const defaultResolver: StaticFieldResolver;
```

### Standalone helpers

```typescript
function resolveFieldProp<T>(prop, fnKey, staticKey, scope, opts?): T | undefined;
function resolveFormProp<T>(type, fnKey, staticKey, scope, opts?): T | undefined;
function resolveStatic<T>(metadata, staticKey, opts?): T | undefined;
function hasComputedAnnotations(prop: TAtscriptAnnotatedType): boolean;
function getFieldMeta<K extends keyof AtscriptMetadata>(
  prop: TAtscriptAnnotatedType,
  key: K,
): AtscriptMetadata[K] | undefined;

/** Whether a metadata key is present on a prop (no resolver needed). */
function hasFieldMeta(prop: TAtscriptAnnotatedType, key: string): boolean;

/**
 * SSOT for field hidden resolution — resolves `@ui.form.fn.hidden` (dynamic, via
 * the active resolver) with static `@ui.form.hidden` presence as the fallback.
 * Absent both → `false` (visible). `scope` is the fn scope for the field
 * (`{ v, data, context, entry }`); dynamic resolution needs `@atscript/ui-fns`.
 */
function isFieldHidden(prop: TAtscriptAnnotatedType, scope: Record<string, unknown>): boolean;
```

`resolveStatic` is exposed so dynamic resolvers (in `ui-fns`) can fall back to it without duplicating logic. `hasFieldMeta` and `isFieldHidden` are shared by `AsField` and vue-form's [`useAsVisibleFields`](/api/vue-form#useasvisiblefields-fields); both are re-exported from `@atscript/vue-form` for container-renderer code.

### `parseStaticAttrs(value)` / `resolveAttrs(prop, scope, keys?)`

Resolve `@ui.form.attr` and the dynamic `@ui.form.fn.attr` counterpart into a single record. `keys` overrides the static/fn key pair for `@ui.table.attr` and friends.

```typescript
function parseStaticAttrs(value: unknown): Record<string, unknown> | undefined;
function resolveAttrs(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
  keys?: { staticKey?: string; fnKey?: string },
): Record<string, unknown> | undefined;
```

## Annotation key constants

Every supported annotation has a stringly-typed constant exported from `@atscript/ui` so consumers can build resolvers, mappers, or codegen against named keys instead of magic strings.

### Cross-surface

| Name      | Value       |
| --------- | ----------- |
| `UI_TYPE` | `"ui.type"` |

### Form static keys

`UI_FORM_PLACEHOLDER`, `UI_FORM_HINT`, `UI_FORM_CLASSES`, `UI_FORM_STYLES`, `UI_FORM_AUTOCOMPLETE`, `UI_FORM_DISABLED`, `UI_FORM_OPTIONS`, `UI_FORM_ORDER`, `UI_FORM_TYPE`, `UI_FORM_COMPONENT`, `UI_FORM_HIDDEN`, `UI_FORM_ATTR`, `UI_FORM_GRID_COL_SPAN`, `UI_FORM_GRID_ROW_SPAN`, `UI_FORM_SUBMIT_TEXT`, `UI_FORM_LABEL_SINGULAR`, `UI_FORM_ACTION`, `UI_FORM_PREFIX`, `UI_FORM_PREFIX_REF`, `UI_FORM_PREFIX_ICON`, `UI_FORM_SUFFIX`, `UI_FORM_SUFFIX_REF`, `UI_FORM_SUFFIX_ICON`, `UI_FORM_VALIDATE`.

### Form dynamic keys

`UI_FORM_FN_PREFIX`, `UI_FORM_FN_LABEL`, `UI_FORM_FN_PLACEHOLDER`, `UI_FORM_FN_DESCRIPTION`, `UI_FORM_FN_HINT`, `UI_FORM_FN_HIDDEN`, `UI_FORM_FN_DISABLED`, `UI_FORM_FN_READONLY`, `UI_FORM_FN_OPTIONS`, `UI_FORM_FN_ATTR`, `UI_FORM_FN_VALUE`, `UI_FORM_FN_CLASSES`, `UI_FORM_FN_STYLES`, `UI_FORM_FN_TITLE`, `UI_FORM_FN_SUBMIT_TEXT`, `UI_FORM_FN_SUBMIT_DISABLED`.

### Table static keys

`UI_TABLE_WIDTH`, `UI_TABLE_COMPONENT`, `UI_TABLE_SELECT_WITH`, `UI_TABLE_EXCLUDE`, `UI_TABLE_ATTR`, `UI_TABLE_CLASSES`, `UI_TABLE_STYLES`, `UI_TABLE_TYPE`, `UI_TABLE_ORDER`.

### Table dynamic keys

`UI_TABLE_FN_PREFIX`, `UI_TABLE_FN_ATTR`, `UI_TABLE_FN_CLASSES`, `UI_TABLE_FN_STYLES`.

### Dictionary

`UI_DICT_LABEL`, `UI_DICT_DESCR`, `UI_DICT_ATTR`, `UI_DICT_FILTERABLE`, `UI_DICT_SORTABLE`, `UI_DICT_SEARCHABLE`.

### Navigation

`UI_NAV_GROUP`, `UI_NAV_ORDER`, `UI_NAV_HIDDEN` — the `@ui.nav.*` keys read by [`buildModelRoutes`](#model-nav-routes).

### DB-aware

`DB_REL_FK`, `DB_HTTP_PATH`, `DB_AMOUNT_CURRENCY`, `DB_AMOUNT_CURRENCY_REF`, `DB_UNIT`, `DB_UNIT_REF`, `DB_COLUMN_PRECISION`.

### Workflow

`WF_ACTION_WITH_DATA`.

### Meta / expect

`META_LABEL`, `META_ID`, `META_DESCRIPTION`, `META_READONLY`, `META_REQUIRED`, `META_DEFAULT`, `META_SENSITIVE`, `EXPECT_MAX_LENGTH`.

## Validators

Both validators let server-managed db fields through, so a create form built from a `/meta` type isn't blocked on values the server fills in: a `@db.column.derived` field is never validated, and an absent `@db.default*` or `@db.column.version` value passes. A `@db.rel.FK` field stays required — the form, not the server, supplies it. Since 0.1.144.

### `getFormValidator(def, opts?)`

Returns a reusable validator function bound to a `FormDef`. Built once, called per submit.

```typescript
function getFormValidator(
  def: FormDef,
  opts?: Partial<TValidatorOptions>,
): (callOpts: {
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
}) => Record<string, string>;
```

Returns an errors record keyed by dot-separated field path (empty when valid).

### `createFieldValidator(prop, opts?)`

Field-level validator with internal `Validator` caching. Returns `true` on success or the first error message string.

```typescript
function createFieldValidator(
  prop: TAtscriptAnnotatedType,
  opts?: { rootOnly?: boolean },
): (value: unknown, externalCtx?: { data: unknown; context: unknown }) => true | string;
```

### Default validator plugins

`setDefaultValidatorPlugins(plugins)` installs validator plugins globally; both `getFormValidator` and `createFieldValidator` apply them. `getDefaultValidatorPlugins()` returns the current list. `@atscript/ui-fns` uses this to wire its `uiFnsValidatorPlugin()`.

```typescript
function setDefaultValidatorPlugins(plugins: TValidatorPlugin[]): void;
function getDefaultValidatorPlugins(): TValidatorPlugin[];
```

See the [Validation guide](/forms/validation) for end-to-end usage.

## Form diff engine

Framework-agnostic change tracking — diffs a form's current data against a baseline snapshot and produces both a changed-fields list and an `@atscript/db` patch object, plus a pure 3-way rebase that folds fresh server data back into a form with unsaved local edits. Vue's [`useAsFormPatch()`](/api/vue-form#useasformpatch) wraps these. See the [Change tracking](/forms/change-tracking) guide.

### `buildFormDiff(def, baseline, current, opts?)`

Diffs `current` against `baseline` (both the WRAPPED `{ value: domainData }` container) and returns the dirty flag, the per-field change list, and a ready-to-ship `@atscript/db` patch. Revert-aware — a value edited back to its baseline produces no change and no patch entry. Lifts a top-level `$cas` sibling for optimistic concurrency when the type has a `@db.column.version` field and `opts.cas !== false`. The result holds live references into `baseline` / `current` — snapshot first if you keep editing (see [Change tracking](/forms/change-tracking)).

```typescript
function buildFormDiff(
  def: FormDef,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  opts?: FormDiffOptions,
): FormDiffResult;
```

### `FormDiffResult`

```typescript
interface FormDiffResult {
  /** True when at least one field changed (revert-aware). */
  isDirty: boolean;
  /** Per-field changes (revert-aware — reverted fields are absent). */
  changes: FormFieldChange[];
  /** `@atscript/db` patch — flat, keyed by field; `{}` when nothing changed; carries `$cas` when applicable. */
  patch: Record<string, unknown>;
}
```

### `FormDiffOptions`

```typescript
interface FormDiffOptions {
  /**
   * Optimistic-concurrency control. `true` (default) auto-includes a top-level
   * `$cas: { [versionColumn]: baselineVersion }` whenever the form has a
   * `@db.column.version` column, the patch is non-empty, and a baseline integer
   * version exists. `false` suppresses it. The version column is never emitted
   * as a normal SET regardless. See [Change tracking — `$cas`](/forms/change-tracking#optimistic-concurrency-cas).
   */
  cas?: boolean;
}
```

### `FormFieldChange`

One field that differs between baseline and current. `kind: 'set'` is a scalar / object / union / tuple field whose whole value changed; `kind: 'array'` is an array whose membership or item content changed. `before` / `after` hold live references into the supplied containers.

```typescript
interface FormFieldChange {
  /** Dot-separated path relative to the form root (e.g. `"address.city"`). */
  path: string;
  kind: "set" | "array";
  before: unknown;
  after: unknown;
}
```

### `isPathDirty(changes, path)`

Pure predicate over a `FormFieldChange[]`: `true` when the field at dot-path `path` changed. A field is dirty iff some change path equals `path` OR starts with `path + "."`, so a leaf matches exactly, an object/section container matches via its leaves, and a whole-array field matches at its root. The trailing dot rules out false positives (`item` never matches a change at `items`); the empty root path `''` is dirty iff there are any changes. Reuse this to mark changed fields in a non-Vue renderer; Vue's [`isDirtyPath()`](/api/vue-form#useasformpatch) / [`useAsField().isDirty`](/api/vue-form#useasfield-opts) wrap it over the reactive change list. See [Change tracking — per-field dirty](/forms/change-tracking#marking-changed-fields-per-field-dirty).

```typescript
function isPathDirty(changes: FormFieldChange[], path: string): boolean;
```

### `buildFormRebase(def, baseline, current, upstream, opts?, diffOptions?)`

Pure 3-way merge: given the baseline, the live form, and a fresh `upstream` (all WRAPPED `{ value: domainData }` containers), produces the form rewritten as `upstream` + the local diff reapplied on top. Untouched fields adopt upstream, local edits survive, both-sides edits are conflicts resolved by `opts.conflict`. No input is mutated. `diffOptions` are forwarded to BOTH internal `buildFormDiff` passes — keep them identical to your own tracking options so the version-column / `$cas` exclusion matches on both sides. Vue's [`rebaseOnto()`](/api/vue-form#useasformpatch) is the thin reactive wrapper over this. See the [Change tracking](/forms/change-tracking#folding-in-fresh-server-data-rebaseonto) guide.

```typescript
function buildFormRebase(
  def: FormDef,
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  upstream: Record<string, unknown>,
  opts?: FormRebaseOptions,
  diffOptions?: FormDiffOptions,
): FormRebaseResult;
```

### `FormRebaseOptions`

```typescript
interface FormRebaseOptions {
  /**
   * How to resolve a field changed on BOTH sides to a different value:
   * - `'ours'` (default) — keep the local edit, discard upstream's value.
   * - `'theirs'` — take upstream's value, discard the local edit.
   * A field changed on both sides to the SAME value is never a conflict.
   */
  conflict?: "ours" | "theirs";
}
```

### `FormRebaseResult`

```typescript
interface FormRebaseResult {
  /** The rebased WRAPPED container to install — a fresh clone of `upstream` with the local diff reapplied. */
  next: Record<string, unknown>;
  /** Paths changed on both sides to different values, plus ancestor-clear paths. De-duplicated. */
  conflicts: string[];
  /** The surviving diff of `next` against the new baseline (`upstream`); `[]` when fully clean. */
  reapplied: FormFieldChange[];
}
```

### `applyFormChanges(def, data, changes)`

Reapplies a `FormFieldChange[]` onto a WRAPPED container, MUTATING it in place and returning the same reference — the inverse of `buildFormDiff`. A `set` change with `after === undefined` deletes the key; an `array` change is a whole-array set. Pass a clone, never the live fetched row.

```typescript
function applyFormChanges(
  def: FormDef,
  data: Record<string, unknown>,
  changes: FormFieldChange[],
): Record<string, unknown>;
```

### `deepEqual(a, b)`

Shared structural comparator behind the diff (order-sensitive arrays, `NaN`-equal, own-key structural). Use it for the same equality semantics the change tracker applies.

```typescript
function deepEqual(a: unknown, b: unknown): boolean;
```

### `deepClone(value, unwrap?)`

Structural deep clone of plain JSON-ish data (objects / arrays / primitives / `Date`), own-enumerable keys only. The optional `unwrap` hook lets a framework strip a reactive proxy off each visited value first (vue-form passes Vue's `toRaw`). The single deep-clone primitive for the form engine — used by `applyFormChanges`, `buildFormRebase`, and vue-form's baseline snapshot.

```typescript
type CloneUnwrap = (value: unknown) => unknown;

function deepClone<T>(value: T, unwrap?: CloneUnwrap): T;
```

## Path utilities

Form data is wrapped: `{ value: domainData }`. These helpers de-reference the wrapper automatically.

### `joinPath(prefix, segment)`

Joins a dot-separated path prefix with a segment. Empty-safe on both sides: an empty segment returns the prefix as-is, an empty prefix returns the segment as-is (no leading/trailing dots). The single primitive `AsField` / `AsIterator` and container renderers use to build absolute child paths. Re-exported from `@atscript/vue-form` for container-renderer code.

```typescript
function joinPath(prefix: string, segment: string): string;
```

### `getByPath(data, path)` / `setByPath(data, path, value)`

```typescript
function getByPath(obj: Record<string, unknown>, path: string): unknown;
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void;
```

`path === ""` returns or replaces the entire `obj.value`. Intermediate objects are auto-created on set.

### `detectUnionVariant(value, variants)`

Returns the index of the variant matching `value`. Uses a discriminator when atscript detects one, otherwise probes each variant's validator. Falls back to `0`.

```typescript
function detectUnionVariant(value: unknown, variants: FormUnionVariant[]): number;
```

## Value-help

### `ValueHelpInfo`

Sync probe for a dictionary value-help prop (FK or `@ui.valueHelp` binding).

```typescript
interface ValueHelpInfo {
  /** HTTP path of the value-help target. */
  url: string;
  /** Field on the target that this FK / binding references — the value a pick commits. */
  targetField: string;
  /** Static dictionary scope (`@ui.valueHelp`'s filter), AND'd into every picker query. Since 0.1.148. */
  filter?: FilterExpr;
  /** Target fields the filter pins with `=` — constant in the picker, hidden from its columns. Since 0.1.148. */
  pinned?: string[];
}
```

### `extractValueHelp(prop)` / `extractLiteralOptions(prop)` / `isPureLiteralUnion(prop)`

```typescript
function extractValueHelp(prop: TAtscriptAnnotatedType): ValueHelpInfo | undefined;
function extractLiteralOptions(
  prop: TAtscriptAnnotatedType,
): { key: string; label: string; value: string | number | boolean }[] | undefined; // `value` since 0.1.148
function isPureLiteralUnion(prop: TAtscriptAnnotatedType): boolean;
```

`extractValueHelp` reads a `@ui.valueHelp` binding first (since 0.1.148) and returns its `filter` / `pinned`; a binding beats `@db.rel.FK`, and one whose target has no `@db.http.path` is ignored. It follows reference chains since 0.1.134: when the prop itself has no `@db.rel.FK`, it hops through `ref.type().props[ref.field]` (bounded, cycle-safe) until it meets a link that carries `@db.rel.FK` and whose target has `@db.http.path`, so a view field projected from an FK column resolves to the dictionary, not the intermediate table. The server does the same in `/meta` since @atscript/db 0.1.128.

You rarely call it directly: `createFormDef()` and `createTableDef()` run it once per field and store the result on the def ([`FormFieldDef.valueHelpInfo`](#formfielddef) / [`ColumnDef.valueHelpInfo`](#columndef)), which is where renderers read it from.

### `ValueHelpClient`

Thin wrapper over a pre-built `Client` (from `@atscript/db-client`) that runs FK-flavoured searches against the value-help target. Most consumers stick to `resolveValueHelp()` plus their own `Client`; this class formalises the search semantics (full-text `$search` when the target is searchable, `$or`-regex fallback otherwise) so picker UIs don't reimplement them.

```typescript
class ValueHelpClient {
  constructor(client: Client);
  search(resolved: ResolvedValueHelp, opts?: ValueHelpSearchOptions): Promise<ValueHelpResult>;
}

interface ValueHelpSearchOptions {
  /** Search term. Empty / undefined returns all records. */
  text?: string;
  /** `"form"` = PK + label + descr; `"filter"` = all dict fields including attrs. Default: `"form"`. */
  mode?: "form" | "filter";
  /** Max results. Default: 20. */
  limit?: number;
  /** Override the computed `$select` fields. */
  select?: string[];
  /** Static scope (`ValueHelpInfo.filter`), AND'd with the search filter and with `$search`. Since 0.1.148. */
  filter?: FilterExpr;
  /**
   * The field the picker commits (`ValueHelpInfo.targetField`). It is always selected and is the
   * exact-match key of a non-searchable search. Default: `primaryKeys[0]`. Since 0.1.148.
   */
  valueField?: string;
}

interface ValueHelpResult {
  items: Record<string, unknown>[];
}
```

### `setValueHelpCacheTtl(ms)` / `invalidateValueHelpCache(client?)`

_Since 0.1.151._ In the browser, identical `ValueHelpClient.search()` calls on the same `Client` are shared: a call joins a request still in flight, and a settled result is reused for `ms` milliseconds (default 5000). A form with many pickers on one dictionary sends one request instead of one per picker. Server-side rendering never shares.

```typescript
function setValueHelpCacheTtl(ms: number): void; // 0 = share in-flight only, < 0 = off
function invalidateValueHelpCache(client?: Client): void; // one client, or all when omitted
```

`resetMetaCache()` clears every shared search, and so does a backend action or delete run through `<AsTable>`. Call `invalidateValueHelpCache()` after writing a dictionary any other way when pickers must refetch immediately.

### `resolveValueHelp(url)` / `resetValueHelpCache()`

Globally caches resolved value-help endpoints by URL so multiple fields pointing at the same target share one `/meta` fetch.

```typescript
function resolveValueHelp(url: string): Promise<ResolvedValueHelp>;
function resetValueHelpCache(): void;

interface ResolvedValueHelp {
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

### `valueHelpDictPaths(resolved)`

Returns the dict-view path set of a resolved value-help target (PKs + label + descr + attr fields). Filter dialogs use it to clamp visible columns to the dictionary subset.

```typescript
function valueHelpDictPaths(resolved: ResolvedValueHelp): Set<string>;
```

See [Forms — References (FK)](/forms/references).

### Option helpers

```typescript
function optKey(opt: TFormEntryOptions): string;
function optLabel(opt: TFormEntryOptions): string;
/** The `@ui.literalLabel` label of a union column's value (`undefined` when none) — what a custom cell shows. Since 0.1.148. */
function optionLabel(
  column: { options?: { key: string; label: string }[] },
  value: unknown,
): string | undefined;
function parseStaticOptions(value: unknown): TFormEntryOptions[] | undefined;
function resolveOptions(
  prop: TAtscriptAnnotatedType,
  scope: Record<string, unknown>,
): TFormEntryOptions[] | undefined;
```

`resolveOptions` checks `@ui.form.options`, then `@ui.form.fn.options` via the active resolver, then literal-union extraction.

## Grid layout

Framework-agnostic helpers for `@ui.form.grid.colSpan` / `@ui.form.grid.rowSpan`. Each annotation has the shape `{ desktop, narrow? }` — `getFieldMeta(prop, UI_FORM_GRID_COL_SPAN)` returns a `GridSpanArgs`.

```typescript
const DEFAULT_COL_SPAN: number; // 12
const DEFAULT_ROW_SPAN: number; // 1

interface GridSpec {
  col: { desktop: number; narrow: number };
  row: { desktop: number; narrow: number };
}

interface GridSpanArgs {
  desktop: string;
  narrow?: string;
}

/** Accepts `"1"`–`"12"` and the aliases `"full"` (12), `"half"` (6), `"third"` (4). */
function parseColSpan(raw: string | undefined): number | undefined;

/** Accepts numeric strings `"1"`+; rejects `"0"`, negatives, decimals, aliases. */
function parseRowSpan(raw: string | undefined): number | undefined;

/** Compose a resolved spec from already-extracted `colSpan` / `rowSpan` annotation values. */
function resolveGridSpec(
  colSpan: GridSpanArgs | undefined,
  rowSpan: GridSpanArgs | undefined,
): GridSpec;

/** Emit `col-span-X` / `row-span-X` + `as-narrow:` variants for the spec. */
function buildGridClasses(spec: GridSpec): string;
```

See [Grid Layout](/forms/grid-layout).

## Decimal helpers

Framework-agnostic decimal-string formatting and parsing — shared by `@atscript/vue-form` AsDecimal and `@atscript/vue-table` cells. Storage is string-only so DB-precision decimals never bounce through floats.

```typescript
interface CurrencyDisplay {
  decimals: number;
  symbol: string;
}
interface DecimalParts {
  integer: string;
  fraction: string;
  sign: "+" | "-";
}
interface FormatDecimalOptions {
  currency?: string;
  locale?: string;
  /** Number of fractional digits to display. */
  scale?: number;
}

function enforceScale(value: string, scale: number): string;
function formatDecimalForDisplay(value: string, opts?: FormatDecimalOptions): string;
function parseDecimalInput(input: string, opts?: FormatDecimalOptions): string | undefined;
function getCurrencyDecimals(currency: string, locale?: string): number;
function getCurrencyDisplayParts(currency: string, locale?: string): CurrencyDisplay;
function getDecimalSeparator(locale?: string): string;
function getThousandsSeparator(locale?: string): string;
function groupInteger(integer: string, locale?: string): string;
function joinDecimalString(parts: DecimalParts): string;
function splitDecimalString(value: string): DecimalParts;
```

## Column helpers

```typescript
function getSortableColumns(def: TableDef): ColumnDef[];
function getFilterableColumns(def: TableDef): ColumnDef[];
function getColumn(def: TableDef, path: string): ColumnDef | undefined;
```

`getFilterableColumns` returns the value-filterable columns (`filterable: true`). To list every column a filter UI can offer — existence-only columns included — filter with `isColumnFilterable` from `@atscript/ui-table`.

## Error map utilities

```typescript
/** Merge any number of partial error maps; falsy values are dropped, later maps win when both have a string. */
function mergeErrorMaps(
  ...maps: Array<Record<string, string | undefined> | undefined>
): Record<string, string>;

/** Return `errors` without the entries whose key is in `paths`. Identity-preserving: when no key matches, the ORIGINAL object is returned unchanged — compare `result !== errors` to detect pruning and skip spurious reactive writes. */
function omitPaths(
  errors: Record<string, string>,
  paths: ReadonlySet<string>,
): Record<string, string>;

/** Yields every ancestor prefix longest-first, including the path itself. `"a.b.c"` → `"a.b.c", "a.b", "a"`. */
function* iteratePathAncestors(path: string): Generator<string>;

/** Build `Map<absolutePath, descendantErrorCount>` so each struct in the tree renders an error-count badge in O(1). */
function buildDescendantErrorCounts(
  errors: Record<string, string | undefined>,
): Map<string, number>;
```

`buildDescendantErrorCounts` powers the count badges on `AsObject` headers.

## Type guards

```typescript
function isArrayField(field: FormFieldDef): field is FormArrayFieldDef;
function isObjectField(field: FormFieldDef): field is FormObjectFieldDef;
function isUnionField(field: FormFieldDef): field is FormUnionFieldDef;
function isTupleField(field: FormFieldDef): field is FormTupleFieldDef;
```

## Misc utilities

```typescript
function asArray<T>(x: T | T[]): T[];

/** `@ui.form.label.singular` for array fields; falls back to `"item"`. */
function resolveSingularLabel(prop: TAtscriptAnnotatedType | undefined): string;

/** Always returns a `MeasurementInfo` — individual fields are `undefined` when their annotation is absent. */
function extractMeasurement(prop: TAtscriptAnnotatedType): MeasurementInfo;

function str(value: unknown): string;
```

`extractMeasurement` reads `@db.amount.currency*` / `@db.unit*` / `@db.column.precision` and returns a structured info record consumed by AsField for currency/unit adornments.

## Client factory

`ClientFactory` is the contract Vue tables and value-help use to build HTTP clients. Override globally to inject auth headers / retries / interceptors.

```typescript
type ClientFactory = (url: string, options?: ClientFactoryOptions) => Client; // `Client` from `@atscript/db-client`
type ClientFactoryOptions = Pick<ClientOptions, "metaKey" | "metaStore">; // since 0.1.153

function setDefaultClientFactory(factory: ClientFactory): void;
function getDefaultClientFactory(): ClientFactory; // never `undefined` — falls back to `(url, options) => new Client(url, options)`
function resetDefaultClientFactory(): void;
```

Spread the optional second argument into the `Client` options you build (_since 0.1.153_): the library passes `metaKey` for a table given [`metaKey`](#meta-cache), and `metaStore: false` during server rendering. A factory that ignores it still works, but loses those two behaviors.

```typescript
setDefaultClientFactory((url, options) => new Client(url, { ...options, fetch: appFetch }));
```

## Meta cache

A single `/meta` fetch per URL is cached across `useTable` instances and `resolveValueHelp` calls. `getMetaEntry` is synchronous — the promises on the entry resolve once the underlying fetch settles.

```typescript
function getMetaEntry(
  url: string,
  factory?: ClientFactory,
  options?: MetaEntryOptions,
): MetaCacheEntry;
function getMetaTableDef(entry: MetaCacheEntry): Promise<TableDef>; // since 0.1.153
function retainMetaEntry(entry: MetaCacheEntry): () => void; // since 0.1.154
function setMetaCacheMaxEntries(max?: number): void; // since 0.1.154 — default 100
function resetMetaCache(): void;
function setMetaCacheIdentity(key: string | null | undefined): void; // since 0.1.151
function getMetaCacheIdentity(): string | null | undefined; // since 0.1.153
function onMetaCacheReset(listener: () => void): () => void; // since 0.1.153

interface MetaEntryOptions {
  metaKey?: string; // since 0.1.153 — `/meta` revalidation key, default the URL
}

interface MetaCacheEntry {
  client: Client; // from `@atscript/db-client`
  meta: Promise<MetaResponse>;
  type: Promise<TAtscriptAnnotatedType>; // pre-deserialized
  resolved?: Promise<ResolvedValueHelp>; // populated lazily by `resolveValueHelp`
  tableDef?: Promise<TableDef>; // populated lazily by `getMetaTableDef` (Vue `useTable`)
}
```

`/meta` is projected per user — the server strips the columns, actions and value-help a role may not use — so the cache belongs to one signed-in viewer:

- **Bind it to the viewer** (_since 0.1.151_). Call `setMetaCacheIdentity(key)` with a key naming the user and role (e.g. `` `${userId}:${role}` ``, `null` when signed out) after login, after logout and whenever you reload the current user. A different key resets the cache; the same key keeps it. Without it, an SPA that logs out and signs in as another user without a page reload keeps rendering the previous user's columns and actions. Binding an identity also turns on the [table-presets cache](/tables/presets#session-cache) (_since 0.1.153_).
- **`resetMetaCache()`** drops every entry, the value-help searches shared under them and — _since 0.1.151_, with `@atscript/db-client` ≥ 0.1.151 — the `/meta` each cached `Client` memoizes (`Client.invalidateMeta()`), so a `ClientFactory` that reuses `Client` instances refetches too. _Since 0.1.153_ it also clears the `@atscript/db-client` meta stores (the shared default one, and any custom `metaStore` your factory gave a cached client) and runs every `onMetaCacheReset` listener (the presets cache registers one). Components already mounted keep the entry they hold; remount them (e.g. navigate) to pick up the new `/meta`. Clients you use outside the cache (`client.meta()`, `client.action()` on a client you keep yourself) need their own `invalidateMeta()` call.
- **Server rendering never caches** (_since 0.1.151_). Without a browser `window`, every `getMetaEntry` call builds a fresh entry, so one viewer's render never sees another's `/meta`, and _since 0.1.153_ the factory is asked for `metaStore: false` so no `/meta` body lands in a process-wide store. Your server-side `ClientFactory` must not hand one `Client` to several requests either — a `Client` memoizes its `/meta`. Never mutate the `meta` object an entry resolves to: in-process consumers may share it by reference.

### Size limit

_Since 0.1.154._ The cache keeps the 100 most recently used URLs; a hit makes a URL the most recent, and older entries beyond the limit are dropped (their `type` / `TableDef`, shared per `ETag`, go with the last entry using them). An app that opens many parametric URLs (`/api/db/ticket-issue/${key}`) no longer grows the cache for the life of the tab. 100 covers a page's tables plus the dictionaries its filters and forms pick from, and the recent navigation history; revisiting a dropped URL costs one `/meta` request — a `304` when the db-client meta store still holds its body.

```typescript
setMetaCacheMaxEntries(300); // keep more; `Infinity` = no limit, no argument = back to 100
```

Entries in use are never dropped: `useTable` (so every mounted `<AsTableRoot>` and its filter pickers) and the form value-help hold their entry until their component unmounts, and may push the cache past the limit while they do. Hold an entry you keep using outside those yourself:

```typescript
const entry = getMetaEntry(url);
const release = retainMetaEntry(entry);
// … later, when done (idempotent):
release();
```

An entry dropped while you still use it keeps working, but the next `getMetaEntry(url)` builds a new entry and `Client` (with the factory passed then), and a dropped entry's `Client` forgets its memoized `/meta`. `resetMetaCache()` and a new `setMetaCacheIdentity()` key still drop every entry, held or not.

### Parametric mounts (`metaKey`)

_Since 0.1.153, with `@atscript/db-client` ≥ 0.1.153._ A controller mounted under a route parameter (`/api/db/ticket-issue/:key`) serves byte-identical `/meta` for every key, but each key is its own URL — so each new key used to download the full `/meta`. Pass the route template as `metaKey` and every key shares one entry in the db-client meta store: the first visit to a new key sends the stored `ETag` as `If-None-Match` and costs a `304`.

```typescript
getMetaEntry(`/api/db/ticket-issue/${key}`, undefined, { metaKey: "/api/db/ticket-issue/:key" });
```

In Vue, pass it on the table: `<AsTableRoot :url="`/api/db/ticket-issue/${key}`" meta-key="/api/db/ticket-issue/:key">` (or `useTable(url, { metaKey })`).

- `metaKey` is honoured on the first `getMetaEntry` call per URL, like `factory`. A custom `ClientFactory` must spread its second argument into the `Client` options, or the key never reaches the client.
- Entries whose `/meta` resolved to the same `ETag` (`Client.metaEtag()`) share the deserialized `type` and the `TableDef` — a new key with an unchanged `/meta` deserializes nothing. This holds with or without `metaKey`.
- Cross-origin APIs must expose the header (`Access-Control-Expose-Headers: ETag`) and allow `If-None-Match` in CORS preflights; otherwise the client falls back to plain downloads.
- Use it only when `/meta` really does not depend on the route parameter. An app-side meta overlay that reads the parameter makes the bodies (and ETags) differ — still correct, but no `304`s.

## Cross-links

- [Forms — Annotations Reference](/forms/annotations)
- [Forms — Validation](/forms/validation)
- [Forms — References (FK)](/forms/references)
- [Tables — Annotations Reference](/tables/annotations)
- [@atscript/ui-fns](/api/ui-fns) — dynamic resolver
- atscript.dev — `.as` syntax and `Validator`
