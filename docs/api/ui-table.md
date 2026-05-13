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

Canonical operator names used in filter conditions and `columnFilterType` output.

```typescript
type FilterConditionType =
  | "eq" | "ne" | "gt" | "gte" | "lt" | "lte"
  | "contains" | "starts" | "ends" | "bw" | "between"
  | "null" | "notNull" | "regex";
```

### `FilterCondition`

A single per-field condition. `value` and `valueTo` carry the operands; `valueTo` is only used for the `bw` / `between` range operators.

```typescript
interface FilterCondition {
  type: FilterConditionType;
  value?: string | number | boolean | null;
  valueTo?: string | number | boolean | null;
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
function hasSecondValue(type: FilterConditionType): boolean;
function isSimpleEq(cond: FilterCondition): boolean;
function conditionLabel(cond: FilterCondition): string;
function filledFilterCount(filters: FieldFilters): number;
function filterTokenLabel(cond: FilterCondition): string;

const NULL_OPS: ReadonlySet<FilterConditionType>; // "null" | "notNull"
```

`isFilled` returns true when the condition has at least one operand bound (or uses a NULL_OPS operator). `filledFilterCount` is used by toolbar badges. `filterTokenLabel` formats one condition into a chip-friendly token.

### Conditions per type

```typescript
type ColumnFilterType = "text" | "number" | "boolean" | "date" | "enum" | "ref";

function conditionsForType(type: ColumnFilterType, opts?: { nullable?: boolean }): FilterConditionType[];
function columnFilterType(column: ColumnDef): ColumnFilterType;
```

`conditionsForType` returns the operator set the filter picker should offer for a given column type, dropping `null` / `notNull` for non-nullable columns.

## Filter input format

Tools for parsing and formatting filter values typed by the user.

```typescript
function parseFilterInput(raw: string, column: ColumnDef): FilterCondition | undefined;
function formatFilterCondition(cond: FilterCondition, column: ColumnDef): string;
function defaultCondition(column: ColumnDef): FilterCondition;

function escapeRegex(value: string): string;
function unescapeRegex(value: string): string;
```

`parseFilterInput` accepts shorthand like `> 100`, `not null`, `2025-01-01..2025-12-31`, and produces a normalised `FilterCondition`. `defaultCondition` is what the filter picker pre-fills when a user opens the dialog on a fresh column.

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

Pre-built date-range presets used by the date filter picker.

```typescript
interface DateShortcut {
  key: string;
  label: string;
  resolve(now: Date): { from: Date; to: Date };
}

const dateShortcuts: DateShortcut[]; // today, yesterday, last 7 days, this month, …
```

## Presets — wire types

### `PresetSnapshot`

Application-layer snapshot captured by `state.preset.captureSnapshot()`.

```typescript
interface PresetSnapshot {
  columns?: { columnNames: string[]; columnWidths?: ColumnWidthEntry[] };
  filters?: string[];
  filterOps?: PresetFilterOpEntry[];
  sorters?: PresetSorterEntry[];
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
  canPublish: boolean;
  presetLimit: number;
  user: string;
  userLabel?: string;
}

interface PresetLimitReachedBody {
  code: "preset-limit-reached";
  limit: number;
  current: number;
}

type AsPresetsErrorCode =
  | "preset-limit-reached"
  | "public-label-conflict"
  | "forbidden"
  | "not-found";
```

## Presets — id helpers

```typescript
const SYSTEM_PRESET_PREFIX: "sys:";
const USER_CONF_PREFIX: "user:";
const APP_CONF_PREFIX: "appconf:";
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

Wraps the [`AsPresetsController`](/api/moost-ui-presets) endpoint. Owns preset CRUD, userConf updates, and capability probing.

```typescript
interface PresetsClientConfig {
  url: string;
  app: string;
  tableKey: string;
  user?: string;
  fetch?: typeof fetch;
}

interface PresetsListResult {
  presets: AsPresetEntryRow[];
  userConf: AsPresetEntryRow | null;
  capabilities: PresetCapabilities | null;
}

interface PresetsSaveAsOptions {
  aspects?: AspectMask;
  public?: boolean;
}

interface PresetsSaveResult {
  id: string;
  row: AsPresetEntryRow;
}

class PresetsClient {
  constructor(config: PresetsClientConfig);
  list(): Promise<PresetsListResult>;
  saveActive(row: AsPresetEntryRow, snapshot: PresetSnapshot): Promise<void>;
  saveAs(label: string, snapshot: PresetSnapshot, opts?: PresetsSaveAsOptions): Promise<PresetsSaveResult>;
  rename(id: string, label: string): Promise<void>;
  remove(id: string): Promise<void>;
  togglePublic(id: string): Promise<void>;
  setDefault(id: string | null): Promise<void>;
  setFavorites(ids: string[]): Promise<void>;
}
```

### `PresetsHttpError` / `isAuthError`

```typescript
class PresetsHttpError extends Error {
  status: number;
  code?: AsPresetsErrorCode;
  body?: unknown;
}

function isAuthError(err: unknown): boolean; // status === 401 | 403
```

### `AppPrefsClient`

Loads the `appConf` row for `(user, app)` — app-wide preferences like density, locale, appearance.

```typescript
interface AppPrefsClientConfig {
  url: string;
  app: string;
  user?: string;
  fetch?: typeof fetch;
}

interface AppPrefsLoadResult {
  row: AsPresetEntryRow | null;
  data: AppConfData;
}

class AppPrefsClient {
  constructor(config: AppPrefsClientConfig);
  load(): Promise<AppPrefsLoadResult>;
  save(data: Partial<AppConfData>): Promise<void>;
}
```

See [Server-Side Presets](/tables/server-presets).

## Query builder

### `buildTableQuery(state, opts?)`

Translates a `TableStateData` snapshot into a Uniquery request the server consumes.

```typescript
interface BuildTableQueryOptions {
  includeActions?: boolean;
}

function buildTableQuery(
  state: TableStateData,
  opts?: BuildTableQueryOptions,
): Record<string, unknown>;
```

### `mergeSorters` / `mergeFilters`

Used when applying presets or URL state — combine the incoming aspect with the user's current state under aspect-aware rules.

```typescript
function mergeSorters(current: SortControl[], incoming?: SortControl[]): SortControl[];
function mergeFilters(
  current: FieldFilters,
  incoming?: FieldFilters,
  fields?: { current: string[]; incoming?: string[] },
): { filters: FieldFilters; filterFields: string[] };
```

## URL query bridge

Two-way bridge between table state and URL search strings — feature-gated by `availableAspects` so apps that don't use, say, `itemsPerPage` don't see it in the URL.

```typescript
interface UrlQueryStateLike {
  columnNames?: string[];
  filterFields?: string[];
  filters?: FieldFilters;
  sorters?: SortControl[];
  searchTerm?: string;
  pagination?: { page: number; itemsPerPage: number };
}

interface UrlQueryStateSnapshot extends UrlQueryStateLike { /* ... */ }

interface UrlQueryDefaults {
  columnNames?: string[];
  itemsPerPage?: number;
}

interface UrlQueryParseOptions {
  defaults?: UrlQueryDefaults;
  aspects?: AspectMask;
}

interface AspectGate {
  /** Aspects that this app accepts from the URL. */
  enabled: ReadonlySet<PresetAspect>;
}

interface UrlQuerySync {
  /** Read-only contract for the renderer's URL bridge. */
  push: (snapshot: UrlQueryStateSnapshot) => void;
  pull: () => UrlQueryStateSnapshot | undefined;
}

function resolveAspectGate(aspects?: AspectMask): AspectGate;
function stateToUrlQueryString(state: UrlQueryStateLike, opts?: UrlQueryParseOptions): string;
function urlQueryStringToState(query: string, opts?: UrlQueryParseOptions): UrlQueryStateSnapshot;
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
  firstIndex: number;
  size: number;
}

function pageAlignedBlocksFor(topIndex: number, viewportRows: number, pageSize: number, totalCount: number): PageAlignedBlock[];
function blockStartFor(absIndex: number, pageSize: number): number;
function clampTopIndex(top: number, viewportRows: number, totalCount: number): number;

interface MergeResult { /* ... */ }
function walkForwardAbsorb(results: MergeResult): void;
function walkBackwardAbsorb(results: MergeResult): void;

type FetchPlanMode = "results" | "cache" | "loading";
interface FetchPlan { firstIndex: number; mode: FetchPlanMode; }
interface PlanFetchArgs {
  topIndex: number;
  viewportRows: number;
  pageSize: number;
  totalCount: number;
  windowCache: Map<number, unknown>;
  windowLoading: Set<number>;
}
function planFetch(args: PlanFetchArgs): FetchPlan[];
```

`planFetch` is the centerpiece: given the viewport and the universal-cache state, it returns the minimal set of block fetches to satisfy the visible range without redundant overlap.

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

type ColumnReorderPosition = "before" | "after" | "start" | "end";
function reorderColumnNames(
  names: string[],
  source: string,
  target: string | null,
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
