# @atscript/ui-table

Framework-agnostic table model. Filter conditions, filter→Uniquery conversion, sorter/filter merging, URL state bridging, preset wire types, window-mode pagination math, column widths, selection helpers, and the abstract `TableStateMethods` / `TableStateData` contracts that `@atscript/vue-table` fulfills. Zero Vue dependency — React or Svelte adapters reuse everything here.

## Contents

- [Filter model](#filter-model)
- [Filter input format](#filter-input-format)
- [Filters and Uniquery](#filters-and-uniquery)
- [Date shortcuts](#date-shortcuts)
- [Presets — wire types](#presets-wire-types)
- [Presets — application types](#presets-application-types)
- [Presets — id helpers](#presets-id-helpers)
- [Presets — system presets](#presets-system-presets)
- [Presets — dirty detection](#presets-dirty-detection)
- [Presets — local draft](#presets-local-draft)
- [Presets — HTTP clients](#presets-http-clients)
- [Query builder](#query-builder)
- [URL query bridge](#url-query-bridge)
- [Selection](#selection)
- [State contracts](#state-contracts)
- [Window mode helpers](#window-mode-helpers)
- [Column widths](#column-widths)
- [Utilities](#utilities)

## Filter model

### `FilterConditionType`

Canonical operator names used in filter conditions. `bw` ("between") is the range operator — there is no separate `between` alias.

```typescript
type FilterConditionType =
  | "eq" | "ne" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "starts" | "ends" | "bw"
  | "null" | "notNull" | "regex";
```

### `FilterCondition`

A single per-field condition. Operands live in a positional array — most operators read `value[0]`; `bw` reads `value[0]` (low) + `value[1]` (high); `null` / `notNull` ignore `value`.

```typescript
interface FilterCondition {
  type: FilterConditionType;
  value: (string | number | boolean)[];
}
```

### `FieldFilters`

Per-field map of applied conditions. The framework treats absence and empty array as equivalent.

```typescript
type FieldFilters = Record<string, FilterCondition[]>;
```

### Condition helpers

```typescript
function isFilled(cond: FilterCondition): boolean;
function hasSecondValue(type: FilterConditionType): boolean;        // `true` only for `"bw"`
function isSimpleEq(cond: FilterCondition): boolean;
function conditionLabel(type: FilterConditionType): string;
function filledFilterCount(filters: FieldFilters): number;
function filterTokenLabel(
  path: string,
  conditions: FilterCondition[],
  columnLabel?: string,
): string;

const NULL_OPS: ReadonlySet<FilterConditionType>; // { "null", "notNull" }
```

`isFilled` returns true when the condition has at least one operand bound (or uses a `NULL_OPS` operator). `filledFilterCount` is used by toolbar badges. `filterTokenLabel` summarises a field's filled conditions into a chip-friendly token.

### Conditions per type

```typescript
type ColumnFilterType = "text" | "number" | "boolean" | "date" | "enum" | "ref";

/** Drops `"null"` / `"notNull"` when `nullable === false`. */
function conditionsForType(
  type: ColumnFilterType,
  nullable?: boolean,
): readonly FilterConditionType[];

/** Map a `ColumnDef.type` string to its filter-type bucket. */
function columnFilterType(columnType: string): ColumnFilterType;
```

`conditionsForType` returns the operator set the filter picker should offer for a given column type.

## Filter input format

Tools for parsing and formatting filter values typed by the user.

```typescript
/** Parses operator shorthand (`>100`, `*foo*`, `lo...hi`, `<empty>`, `!<empty>`, `/regex/`). */
function parseFilterInput(
  raw: string,
  columnType: ColumnFilterType,
  nullable?: boolean,
): FilterCondition | undefined;

/** Format a condition back into the same operator-shorthand string. Round-trips with `parseFilterInput`. */
function formatFilterCondition(cond: FilterCondition): string;

/** Default operator for a fresh filter picker: `"contains"` for `text`/`enum`/`ref`, else `"eq"`. */
function defaultCondition(columnType: ColumnFilterType): FilterConditionType;

function escapeRegex(value: string): string;
function unescapeRegex(value: string): string;
```

See [Filtering](/tables/filtering).

## Filters and Uniquery

`filtersToUniqueryFilter` produces a `@uniqu/core`-compatible filter object the server consumes; `uniqueryFilterToFieldFilters` rebuilds `FieldFilters` from a stored Uniquery object (used when applying a preset or URL state).

```typescript
function filtersToUniqueryFilter(
  filters: FieldFilters,
  columns: ColumnDef[],
): Record<string, unknown> | undefined;

function uniqueryFilterToFieldFilters(
  filter: Record<string, unknown> | undefined,
  columns: ColumnDef[],
): FieldFilters;
```

## Date shortcuts

Pre-built date-range presets used by the date filter picker. Each shortcut produces an ISO date pair (`YYYY-MM-DD`) intended for a `bw` (between) condition.

```typescript
interface DateShortcut {
  label: string;
  dates: [start: string, end: string];
}

/** Returns the canonical shortcut list relative to `now` (defaults to current date). */
function dateShortcuts(now?: Date): DateShortcut[];
// → Last 7 Days, Last 30 Days, Month to Date, Last 90 Days, Last 6 Months,
//   Last 12 Months, Year to Date
```

## Presets — wire types

### `PresetSnapshot`

In-memory snapshot of table state for preset persistence. Dict-shaped — aspects mirror the runtime state, not the wire format. The wire form (entries-arrays for atscript validation) is `PresetSnapshotWire`. Each top-level key is opt-in: a key's presence claims that aspect; absent keys are left untouched on apply.

```typescript
interface PresetSnapshot {
  columns?: {
    columnNames: string[];
    /** Override-only diff against column defaults — never serialise the default itself. */
    columnWidths?: Record<string, string>;
  };
  /** Displayed filter field paths (the visible-input list). */
  filters?: string[];
  /** Applied filter conditions keyed by field path. */
  filterOps?: FieldFilters;
  sorters?: SortControl[];
  itemsPerPage?: number;
}
```

### `PresetSnapshotWire`, `PresetColumnWidthEntry`, `PresetFilterOpEntry`, `PresetSorterEntry`

Persisted wire form (what hits the DB / URL). Matches the `.as` model in [`@atscript/moost-ui-presets`](/api/moost-ui-presets).

### `PresetAspect`, `AspectMask`, `PRESET_ASPECTS`, `derivePresetAspects`

```typescript
type PresetAspect = "columns" | "filters" | "filterOps" | "sorters" | "itemsPerPage";
type AspectMask = ReadonlySet<PresetAspect> | readonly PresetAspect[];

const PRESET_ASPECTS: readonly PresetAspect[];

function derivePresetAspects(snapshot: PresetSnapshot | PresetSnapshotWire): PresetAspect[];
```

`derivePresetAspects(snapshot)` returns the list of aspects actually present on a snapshot — used by the controller when stamping `aspects[]` on a preset row.

### `toWireSnapshot(snapshot)` / `fromWireSnapshot(wire)`

```typescript
function toWireSnapshot(snapshot: PresetSnapshot): PresetSnapshotWire;
function fromWireSnapshot(wire: PresetSnapshotWire): PresetSnapshot;
```

Bidirectional bridge between the application shape (sets, ordered arrays, etc.) and the JSON wire shape.

## Presets — application types

```typescript
interface AsPresetEntryRow {
  id: string;
  type: "preset" | "userConf" | "appConf";
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

type AsPresetEntryData = PresetData | UserConfData | AppConfData;

interface PresetData { label: string; content?: PresetSnapshotWire; }
interface UserConfData { defaultPresetId?: string; favPresetIds?: string[]; }
interface AppConfData {
  appearance?: "system" | "light" | "dark";
  language?: string;
  timezone?: string;
  density?: "compact" | "cozy" | "comfortable";
  dateFormat?: "iso" | "us" | "eu";
  firstDayOfWeek?: 0 | 1 | 6;
  customJson?: string;
}

interface PresetCapabilities {
  /** Whether the current user may set `public: true` on presets in this scope. */
  canPublish: boolean;
  /** Per-`(app, tableKey, user)` preset cap. */
  presetLimit: number;
  /** Server-known opaque identity for the current user. */
  userId: string;
}

interface PresetLimitReachedBody {
  code: "preset_limit_reached";
  limit: number;
  count: number;
}

type AsPresetsErrorCode =
  | "preset_limit_reached"
  | "reserved_id"
  | "public_name_conflict"
  | "missing_scope"
  | "missing_id"
  | "invalid_type"
  | "type_immutable"
  | "identity_immutable"
  | "preset_not_found"
  | "publish_forbidden"
  | "action_unsupported";
```

## Presets — id helpers

```typescript
const SYSTEM_PRESET_PREFIX: "sys:";
const USER_CONF_PREFIX: "uc:";
const APP_CONF_PREFIX: "ac:";
const RESERVED_ID_PREFIXES: readonly string[];
const STANDARD_PRESET_ID: "sys:standard";

function userConfId(user: string, app: string, tableKey: string): string;
function appConfId(user: string, app: string): string;
function isSystemPresetId(id: string): boolean;
function normaliseSystemPresetId(id: string): string;
```

User-authored preset ids must NOT start with any prefix in `RESERVED_ID_PREFIXES` — the controller rejects writes that try.

## Presets — system presets

System presets are read-only, framework-defined snapshots like "Standard view". Apps may also register custom synthetic presets via `useTable({ preset.systemPresets })`.

```typescript
interface SystemPreset {
  id: string;          // "sys:standard" or "sys:<custom>"
  label: string;
  snapshot: PresetSnapshot;
  aspects: PresetAspect[];
}

interface SystemPresetInput {
  id: string;
  label: string;
  snapshot: Partial<PresetSnapshot>;
}

function resolveSystemPresets(
  inputs?: SystemPresetInput[],
  defaults?: { columnNames?: string[] },
): SystemPreset[];
```

`resolveSystemPresets` always emits a `sys:standard` entry as item 0 and follows it with the consumer-supplied list.

## Presets — dirty detection

```typescript
function stableStringify(value: unknown): string;
function isDirtyAgainst(current: PresetSnapshot, claimed: AspectMask, baseline: PresetSnapshot): boolean;
```

`stableStringify` produces deterministic JSON (sorted keys) so a snapshot's hash is stable across reorders. `isDirtyAgainst` returns true when at least one claimed aspect differs from baseline.

## Presets — local draft

Opt-in localStorage overlay that captures the user's in-flight tweaks. Persists `columns`/`filters`/`sorters` and optionally `itemsPerPage`; `filterOps`, `searchTerm`, and pagination are never persisted.

```typescript
interface PresetDraft {
  presetId: string;
  columns?: PresetSnapshot["columns"];
  filters?: PresetSnapshot["filters"];
  sorters?: PresetSnapshot["sorters"];
  itemsPerPage?: number;
}

type DraftPersistedAspect = "columns" | "filters" | "sorters" | "itemsPerPage";
const DRAFT_PERSISTED_ASPECTS: readonly DraftPersistedAspect[];

function serializeDraft(draft: PresetDraft): string;
function deserializeDraft(raw: string): PresetDraft | undefined;
function isEmptyDraft(draft: PresetDraft): boolean;
function draftMatchesPreset(draft: PresetDraft, snapshot: PresetSnapshot): boolean;
```

## Presets — HTTP clients

### `PresetsClient`

Framework-agnostic wrapper over `@atscript/db-client`'s `Client` for the [`AsPresetsController`](/api/moost-ui-presets) endpoint. Owns preset CRUD, userConf upserts, and capability probing. Stateless — every method is a fresh request.

```typescript
interface PresetsClientConfig {
  /** Controller mount URL, e.g. `"/db/_presets"`. */
  url: string;
  app: string;
  tableKey: string;
  /** Pre-built `Client` (auth-configured by the host). Wins over `clientFactory`. */
  client?: Client;
  /** Builds a `Client` for the given URL. Defaults to `getDefaultClientFactory()`. */
  clientFactory?: (url: string) => Client;
  /** Fetch impl for the `GET /capabilities` side-channel. Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
}

interface PresetsListResult {
  presets: AsPresetEntryRow[];
  /** type='userConf' row for this `(user, app, tableKey)`, or null. */
  userConf: AsPresetEntryRow | null;
  /** `null` when the capabilities load failed; `undefined` when the call skipped capabilities. */
  capabilities: PresetCapabilities | null | undefined;
  /** True when the controller responded 401/403 — UI silently hides. */
  denied: boolean;
}

interface PresetsSaveAsOptions {
  public?: boolean;
}

interface PresetsSaveResult {
  id: string;
}

class PresetsClient {
  constructor(config: PresetsClientConfig);

  /** Lists owned + public preset rows AND the user's userConf row. `{ capabilities: false }` skips the capabilities fetch. */
  list(opts?: { capabilities?: boolean }): Promise<PresetsListResult>;

  /** `GET ${url}/capabilities?app=...&tableKey=...` — out-of-band of the CRUD plumbing. */
  loadCapabilities(): Promise<PresetCapabilities>;

  /** Overwrite the active preset's content (label preserved). */
  savePreset(id: string, label: string, snapshot: PresetSnapshot): Promise<void>;

  /** Create a new preset row. Server stamps `user`, generates `id`, derives `aspects`. */
  savePresetAs(
    label: string,
    snapshot: PresetSnapshot,
    opts?: PresetsSaveAsOptions,
  ): Promise<PresetsSaveResult>;

  renamePreset(id: string, label: string): Promise<void>;
  setPublic(id: string, value: boolean): Promise<void>;
  deletePreset(id: string): Promise<void>;

  /** Upsert the userConf row keyed on `${USER_CONF_PREFIX}${user}:${app}:${tableKey}`. */
  upsertUserConf(
    existing: AsPresetEntryRow | null,
    patch: Partial<UserConfData>,
    user?: string,
  ): Promise<void>;
}
```

### `PresetsHttpError` / `isAuthError`

```typescript
class PresetsHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string);
}

function isAuthError(err: unknown): boolean; // true for HTTP 401/403 on `ClientError` or `PresetsHttpError`
```

### `AppPrefsClient`

Loads the `appConf` row for `(user, app)` — app-wide preferences like density, locale, appearance. Independent of any table; devs may use this standalone.

```typescript
interface AppPrefsClientConfig {
  /** Same controller URL the presets table is mounted on. */
  url: string;
  app: string;
  client?: Client;
  clientFactory?: (url: string) => Client;
}

interface AppPrefsLoadResult {
  /** Full row (server-stamped id, user, timestamps), or `null`. */
  row: AsPresetEntryRow | null;
  /** Convenience accessor for `row.data`, or `null`. */
  prefs: AppConfData | null;
  /** True when the controller responded 401/403. */
  denied: boolean;
}

class AppPrefsClient {
  constructor(config: AppPrefsClientConfig);
  load(): Promise<AppPrefsLoadResult>;
  /** Upsert the appConf row. `existing` comes from a prior `load()` so the verb is correct. Returns the row id on success. */
  save(
    existing: AsPresetEntryRow | null,
    patch: Partial<AppConfData>,
    user?: string,
  ): Promise<string | null>;
}
```

See [Server-Side Presets](/tables/server-presets).

## Query builder

### `buildTableQuery(opts)`

Pure function that translates table UI state into a `Uniquery` request. Merges user filters with force filters, prepends force sorters, projects `$select`, applies search and the `$actions` flag.

```typescript
interface BuildTableQueryOptions {
  /** Paths of visible columns — emitted as `controls.$select`. */
  visibleColumnPaths: string[];
  /** User-configured sorters. */
  sorters: SortControl[];
  /** Always-applied sorters (prepended before user sorters). */
  forceSorters?: SortControl[];
  /** User-configured field filters. */
  filters: FieldFilters;
  /** Always-applied Uniquery filter (AND'd with user filters). */
  forceFilters?: FilterExpr;
  /** Full-text search term. */
  search?: string;
  /** Search index name for `$search:<index>`. */
  searchIndex?: string;
  /** Set `controls.$actions = true` to receive per-row `$actions: string[]`. */
  includeActions?: boolean;
}

function buildTableQuery(opts: BuildTableQueryOptions): Uniquery; // `Uniquery` from `@uniqu/core`
```

### `mergeSorters` / `mergeFilters`

Used by `buildTableQuery` to combine force + user controls; safe to call directly when composing presets / URL state.

```typescript
function mergeSorters(force: SortControl[], user: SortControl[]): SortControl[];

/** AND-merge two `FilterExpr` trees, producing a wire shape that survives the Uniquery parser collapse. */
function mergeFilters(
  force?: FilterExpr,
  user?: FilterExpr,
): FilterExpr | undefined;
```

## URL query bridge

Two-way bridge between table state and URL query strings. Per-aspect gates (`filters` / `sorters` / `search` / `pagination`) are honoured symmetrically by encoder and decoder — pass the same `sync` config to both so the round-trip matches.

```typescript
interface UrlQueryStateLike {
  filters: FieldFilters;
  sorters: SortControl[];
  /** 1-based page number; `1` is the default and is omitted from the URL. */
  page?: number;
  /** Per-page size; omitted from the URL when equal to `defaultItemsPerPage`. */
  itemsPerPage?: number;
  /** Full-text search term; omitted when empty. */
  searchTerm?: string;
}

interface UrlQueryStateSnapshot {
  filters: FieldFilters;
  sorters: SortControl[];
  /** Raw `$skip` offset when present (no page math — recipients divide by their own `itemsPerPage`). */
  skip?: number;
  searchTerm: string;
}

interface UrlQuerySync {
  /** `true` / `undefined` (default): all filters. `false` / `[]`: no filters in URL. `string[]`: allowlist of field paths. */
  filters?: boolean | string[];
  /** Same `boolean | string[]` semantics; allowlist matches `SortControl.field`. */
  sorters?: boolean | string[];
  /** Round-trip `searchTerm` as `$search`. Default `true`. */
  search?: boolean;
  /** Round-trip pagination (`$skip`). Default `true`. */
  pagination?: boolean;
}

interface UrlQueryDefaults {
  /** Consumer's `:limit` prop. Used to compute `$skip` and to suppress `$limit` writes. */
  defaultItemsPerPage: number;
  /** Per-aspect sync gates. Omitted = full sync. */
  sync?: UrlQuerySync;
}

interface UrlQueryParseOptions {
  /** Field paths the table knows about. Conditions on fields outside this set are silently dropped. */
  knownFields?: Iterable<string>;
  /** Per-aspect sync gates — must match the encoder's config. */
  sync?: UrlQuerySync;
}

/** Tri-state resolution of a per-aspect gate: `"all"` (pass-through), `"none"` (off), or an allowlist Set. */
type AspectGate = "all" | "none" | Set<string>;

function resolveAspectGate(value: boolean | string[] | undefined): AspectGate;

/** Returns the URL query string (no leading `?`). Returns `""` for the default view. */
function stateToUrlQueryString(state: UrlQueryStateLike, defaults: UrlQueryDefaults): string;

/** Robust by design — schema drift never breaks the recipient's view. */
function urlQueryStringToState(urlString: string, opts?: UrlQueryParseOptions): UrlQueryStateSnapshot;
```

See [URL State](/tables/url-state).

## Selection

```typescript
type SelectionMode = "none" | "single" | "multi";

function togglePk(set: unknown[], pk: unknown): unknown[];
function trimSelection(set: unknown[], pks: Iterable<unknown>): unknown[];
function rowsToPks(
  rows: Record<string, unknown>[],
  rowValueFn: (row: Record<string, unknown>) => unknown,
): unknown[];
```

`togglePk` returns a new array — never mutates. `trimSelection` drops any selected pk not present in `pks` (used when the row set narrows).

## State contracts

`ConfigTab`, `TableStateData`, and `TableStateMethods` are the framework-agnostic contracts that the Vue `ReactiveTableState` implements. Reuse them when writing a React/Svelte port so the rest of `@atscript/ui-table` keeps working.

```typescript
type ConfigTab = "columns" | "filters" | "sorters";

interface TableStateData {
  tableDef: TableDef | null;
  columnNames: string[];
  allColumns: ColumnDef[];
  columnWidths: ColumnWidthsMap;
  filterFields: string[];
  filters: FieldFilters;
  sorters: SortControl[];
  searchTerm: string;
  pagination: PaginationControl;
  selectedRows: unknown[];
  results: Record<string, unknown>[];
  totalCount: number;
  // ...
}

interface TableStateMethods {
  query(): Promise<void>;
  loadRange(from: number, to: number): Promise<void>;
  setColumnNames(names: string[]): void;
  setColumnWidths(widths: ColumnWidthsMap): void;
  setFilters(filters: FieldFilters, fields?: string[]): void;
  setSorters(sorters: SortControl[]): void;
  setSearchTerm(value: string): void;
  setPagination(p: PaginationControl): void;
  setSelectedRows(rows: unknown[]): void;
  applyUrlQuery(urlString: string): void;
  // ...
}
```

The full mutator list mirrors `ReactiveTableState` in [`@atscript/vue-table`](/api/vue-table) — see that page for the complete enumeration with reactive types.

## Window mode helpers

Used by `<AsWindowTable>` to compute page-aligned fetch ranges and merge incoming results into the universal cache.

```typescript
const DEFAULT_ROW_HEIGHT_PX: number;

interface PageAlignedBlock {
  /** 1-based page number, ready to pass to a server pagination param. */
  page: number;
  /** Index of the first row in the block. */
  firstIndex: number;
}

function pageAlignedBlocksFor(
  skip: number,
  limit: number,
  blockSize: number,
): PageAlignedBlock[];
function blockStartFor(absIdx: number, blockSize: number): number;
function clampTopIndex(topIndex: number, totalCount: number, viewport: number): number;

interface MergeResult { /* ... */ }
function walkForwardAbsorb(results: MergeResult): void;
function walkBackwardAbsorb(results: MergeResult): void;

/** `"jump"` — viewport sits in uncached territory; centre a fetch around it. `"steady"` — fetch one block at the edge that's running out. */
type FetchPlanMode = "jump" | "steady";

interface FetchPlan {
  skip: number;
  limit: number;
  mode: FetchPlanMode;
}

interface PlanFetchArgs {
  top: number;
  viewport: number;
  totalCount: number;
  cache: Map<number, unknown>;
  blockSize: number;
  /** Threshold below which a steady prefetch fires. Typically `blockSize / 4`. */
  buffer: number;
}

function planFetch(args: PlanFetchArgs): FetchPlan | null;
```

`planFetch` is the centerpiece: given the viewport and the universal-cache state, it returns the single fetch the renderer should issue next (or `null` when the cache already satisfies the visible range).

## Column widths

```typescript
interface ColumnWidthEntry {
  w: string; // current rendered width
  d: string; // computed default
}
type ColumnWidthsMap = Record<string, ColumnWidthEntry>;

const MAX_DEFAULT_COLUMN_WIDTH_PX: number;

function computeDefaultColumnWidth(column: ColumnDef): string;
function reconcileColumnWidthDefaults(
  current: ColumnWidthsMap,
  columns: ColumnDef[],
): ColumnWidthsMap;
```

`computeDefaultColumnWidth` prefers `@ui.table.width`, falls back to type + `@expect.maxLen`, clamps to `MAX_DEFAULT_COLUMN_WIDTH_PX`. `reconcileColumnWidthDefaults` is called whenever the column set changes so widths stay populated for every visible column.

## Utilities

```typescript
function debounce<T extends (...args: any[]) => unknown>(fn: T, ms: number): T & { cancel(): void };
function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean;
function sameColumnSet(a: readonly string[], b: readonly string[]): boolean;
function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean;
function sortersEqual(a: readonly SortControl[], b: readonly SortControl[]): boolean;

type ColumnReorderPosition = "before" | "after";

/** Pure — returns a new array. Returns input unchanged when paths are missing or the move is a no-op. */
function reorderColumnNames(
  names: string[],
  fromPath: string,
  toPath: string,
  position: ColumnReorderPosition,
): string[];
```

## Cross-links

- [Tables — Filtering](/tables/filtering)
- [Tables — Sorting](/tables/sorting)
- [Tables — Pagination & Virtualization](/tables/pagination)
- [Tables — Presets](/tables/presets)
- [Tables — URL State](/tables/url-state)
- [@atscript/vue-table](/api/vue-table) — Vue-side `ReactiveTableState`
- [@atscript/moost-ui-presets](/api/moost-ui-presets) — server endpoint
