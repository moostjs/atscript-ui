# @atscript/ui

Framework-agnostic core for type-driven UIs. Reads compiled Atscript metadata, builds form and table definitions, exposes a pluggable field resolver, validators, value-help, and a battery of pure utilities consumed by every Vue package. No Vue, no React — plain TypeScript.

## Contents

- [Plugin](#plugin)
- [Form types](#form-types)
- [Form factories](#form-factories)
- [Table types](#table-types)
- [Table factory](#table-factory)
- [Navigate action hrefs](#navigate-action-hrefs)
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
function createFormDef(type: TAtscriptAnnotatedType, opts?: { versionColumn?: string }): FormDef;
```

When `opts.versionColumn` is supplied, the matching prop is excluded from the returned `fields[]` (so `AsForm`'s renderer doesn't paint it) but remains in `flatMap` and in the form's underlying data wrapper. This is the contract OCC needs: hide the version input from users while keeping the value in the wire payload so the server can lift it into `$cas`. Pass `meta.versionColumn` directly.

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
  primaryKeys: string[];
  /** Preferred row identifier for URL/wire addressing. */
  preferredId: string[];
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
  component?: string;
  /** Extra sibling leaf paths to fetch when this column is visible — see [Custom Cells](/tables/custom-cells). */
  selectWith?: string[];
  sortable: boolean;
  filterable: boolean;
  nullable: boolean;
  visible: boolean;
  width?: string;
  maxLen?: number;
  order: number;
  options?: { key: string; label: string }[];
  valueHelpInfo?: ValueHelpInfo;
  currencyCode?: string;
  currencyRefField?: string;
  unitCode?: string;
  unitRefField?: string;
  precisionScale?: number;
  /** Synthesised columns (e.g. row-actions) — locked chrome, excluded from `columnNames`. */
  fixed?: boolean;
}
```

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
}

interface FieldMeta {
  sortable: boolean;
  filterable: boolean;
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
}
```

**`versionColumn?: string`** — name of the server-managed row version column on OCC-protected tables (declared with `@db.column.version` in your `.as` schema). Absent on tables that don't opt into OCC. Consumer code should pass this through to `createFormDef` so the version field doesn't render as an editable input, while still riding in the form data for the server's `$cas` round-trip. See the [Edit forms with optimistic concurrency](/tables/edit-form-occ) pattern guide for the full flow.

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

## Navigate action hrefs

### `navigateHrefFor(action, id, preferredId)`

Computes, at render time, the href a `processor: 'navigate'` action would open — interpolating `$1` in `action.value` with the row's URL-encoded `preferredId`. Lets a custom action-chrome renderer produce the same anchor the built-in `<AsRowActions>` / `<AsTableActions>` do. Returns `undefined` when no link is possible (not a navigate action, or a row-level action with no identifiable pk) → render a `<button>` and let the client handle the invoke.

```typescript
function navigateHrefFor(
  action: TDbActionInfo,
  id: Record<string, unknown> | undefined,
  preferredId: readonly string[],
): string | undefined;
```

See [Navigate actions](/tables/actions#navigate-actions) for the rendering and click-semantics narrative.

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

### DB-aware

`DB_REL_FK`, `DB_HTTP_PATH`, `DB_AMOUNT_CURRENCY`, `DB_AMOUNT_CURRENCY_REF`, `DB_UNIT`, `DB_UNIT_REF`, `DB_COLUMN_PRECISION`.

### Workflow

`WF_ACTION_WITH_DATA`.

### Meta / expect

`META_LABEL`, `META_ID`, `META_DESCRIPTION`, `META_READONLY`, `META_REQUIRED`, `META_DEFAULT`, `META_SENSITIVE`, `EXPECT_MAX_LENGTH`.

## Validators

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

Sync probe for a value-help-eligible prop (FK or ref).

```typescript
interface ValueHelpInfo {
  /** HTTP path of the value-help target. */
  url: string;
  /** Field on the target that this FK references. */
  targetField: string;
}
```

### `extractValueHelp(prop)` / `extractLiteralOptions(prop)` / `isPureLiteralUnion(prop)`

```typescript
function extractValueHelp(prop: TAtscriptAnnotatedType): ValueHelpInfo | undefined;
function extractLiteralOptions(
  prop: TAtscriptAnnotatedType,
): { key: string; label: string }[] | undefined;
function isPureLiteralUnion(prop: TAtscriptAnnotatedType): boolean;
```

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
}

interface ValueHelpResult {
  items: Record<string, unknown>[];
}
```

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

## Error map utilities

```typescript
/** Merge any number of partial error maps; falsy values are dropped, later maps win when both have a string. */
function mergeErrorMaps(
  ...maps: Array<Record<string, string | undefined> | undefined>
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
type ClientFactory = (url: string) => Client; // `Client` from `@atscript/db-client`

function setDefaultClientFactory(factory: ClientFactory): void;
function getDefaultClientFactory(): ClientFactory; // never `undefined` — falls back to `(url) => new Client(url)`
function resetDefaultClientFactory(): void;
```

## Meta cache

A single `/meta` fetch per URL is cached across `useTable` instances and `resolveValueHelp` calls. `getMetaEntry` is synchronous — the promises on the entry resolve once the underlying fetch settles.

```typescript
function getMetaEntry(url: string, factory?: ClientFactory): MetaCacheEntry;
function resetMetaCache(): void;

interface MetaCacheEntry {
  client: Client; // from `@atscript/db-client`
  meta: Promise<MetaResponse>;
  type: Promise<TAtscriptAnnotatedType>; // pre-deserialized
  resolved?: Promise<ResolvedValueHelp>; // populated lazily by `resolveValueHelp`
  tableDef?: Promise<TableDef>; // populated lazily by Vue `useTable`
}
```

## Cross-links

- [Forms — Annotations Reference](/forms/annotations)
- [Forms — Validation](/forms/validation)
- [Forms — References (FK)](/forms/references)
- [Tables — Annotations Reference](/tables/annotations)
- [@atscript/ui-fns](/api/ui-fns) — dynamic resolver
- atscript.dev — `.as` syntax and `Validator`
